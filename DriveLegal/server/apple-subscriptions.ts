import crypto from "crypto";
import type {
  Express,
  Request,
  Response as ExpressResponse,
} from "express";

import {
  planFromProductId,
  type SubscriptionPlan,
} from "../lib/subscription-products";
import { query } from "./db";

type QueryFn = typeof query;

type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";
type AppleEnvironment = "Production" | "Sandbox";

type AppleTransactionPayload = {
  originalTransactionId?: string;
  productId?: string;
  expiresDate?: number | string;
  revocationDate?: number | string;
  signedDate?: number | string;
  purchaseDate?: number | string;
};

type AppleRenewalPayload = {
  autoRenewProductId?: string;
};

type AppleLastTransaction = {
  originalTransactionId?: string;
  status?: number;
  signedTransactionInfo?: string;
  signedRenewalInfo?: string;
};

type AppleSubscriptionResponse = {
  environment?: string;
  bundleId?: string;
  data?: Array<{
    lastTransactions?: AppleLastTransaction[];
  }>;
};

type AppleErrorResponse = {
  errorCode?: number | string;
  errorMessage?: string;
};

const APPLE_EXPECTED_BUNDLE_ID = "app.drivelegal.mobile";
const APPLE_EXPECTED_KEY_ID = "F9FB3L2DDZ";
const APPLE_EXPECTED_AUDIENCE = "appstoreconnect-v1";
const APPLE_JWT_MAX_TTL_SECONDS = 60 * 60;

let appleKeyDiagnosticsLogged = false;
let appleJwtDiagnosticsLogged = false;

type AppStoreNotificationPayload = {
  notificationType?: string;
  subtype?: string;
  data?: {
    signedTransactionInfo?: string;
  };
};

export type ValidatedSubscriptionState = {
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan | null;
  subscriptionId: string | null;
  currentPeriodEnd: string | null;
  productId: string | null;
  environment: string | null;
  rawStatus: number | null;
};

export async function syncDriverSubscriptionRecord(
  params: {
    localUserId: string;
    requestedStatus: SubscriptionStatus;
    requestedPlan?: SubscriptionPlan | null;
    requestedSubscriptionId?: string | null;
    requestedCurrentPeriodEnd?: string | null;
  },
  deps?: {
    queryFn?: QueryFn;
    validateSubscription?: (
      originalTransactionId: string,
    ) => Promise<ValidatedSubscriptionState>;
  },
): Promise<
  | ({
      success: true;
    } & Pick<
      ValidatedSubscriptionState,
      "subscriptionStatus" | "subscriptionPlan" | "subscriptionId" | "currentPeriodEnd"
    >)
  | { success: false; error: string }
> {
  const queryFn = deps?.queryFn ?? query;
  const validateSubscription =
    deps?.validateSubscription ?? validateSubscriptionWithApple;

  let persistedState: ValidatedSubscriptionState;

  if (params.requestedStatus === "active") {
    const originalTransactionId = normaliseValue(params.requestedSubscriptionId);

    if (!originalTransactionId) {
      return {
        success: false,
        error:
          "Drive Legal could not verify this App Store subscription because the original transaction ID was missing.",
      };
    }

    try {
      persistedState = await validateSubscription(originalTransactionId);
    } catch (error) {
      console.error("[AppleSubscription] Validation failed:", error);
      return {
        success: false,
        error:
          "Drive Legal could not verify your App Store subscription with Apple right now. Please try Restore Purchases again shortly.",
      };
    }
  } else {
    persistedState = {
      subscriptionStatus: params.requestedStatus,
      subscriptionPlan: params.requestedPlan ?? null,
      subscriptionId: normaliseValue(params.requestedSubscriptionId),
      currentPeriodEnd: normaliseValue(params.requestedCurrentPeriodEnd),
      productId: null,
      environment: null,
      rawStatus: null,
    };
  }

  await persistDriverSubscriptionState({
    localUserId: params.localUserId,
    state: persistedState,
    queryFn,
  });

  return {
    success: true,
    subscriptionStatus: persistedState.subscriptionStatus,
    subscriptionPlan: persistedState.subscriptionPlan,
    subscriptionId: persistedState.subscriptionId,
    currentPeriodEnd: persistedState.currentPeriodEnd,
  };
}

export async function processAppStoreServerNotification(
  signedPayload: string,
  deps?: {
    queryFn?: QueryFn;
    validateSubscription?: (
      originalTransactionId: string,
    ) => Promise<ValidatedSubscriptionState>;
  },
): Promise<{
  ok: boolean;
  processed: boolean;
  notificationType: string | null;
  subtype: string | null;
  originalTransactionId: string | null;
  subscriptionStatus?: SubscriptionStatus;
}> {
  const queryFn = deps?.queryFn ?? query;
  const validateSubscription =
    deps?.validateSubscription ?? validateSubscriptionWithApple;
  const payload = decodeJwsPayload<AppStoreNotificationPayload>(signedPayload);
  const signedTransactionInfo = payload.data?.signedTransactionInfo;
  const transactionPayload = signedTransactionInfo
    ? decodeJwsPayload<AppleTransactionPayload>(signedTransactionInfo)
    : null;
  const originalTransactionId = normaliseValue(
    transactionPayload?.originalTransactionId,
  );

  if (!originalTransactionId) {
    return {
      ok: true,
      processed: false,
      notificationType: payload.notificationType ?? null,
      subtype: payload.subtype ?? null,
      originalTransactionId: null,
    };
  }

  const drivers = await queryFn<{ localUserId: string }>(
    `
    SELECT localUserId
    FROM drivers
    WHERE subscriptionId = ?
      AND deletedAt IS NULL
    `,
    [originalTransactionId],
  );

  if (drivers.length === 0) {
    return {
      ok: true,
      processed: false,
      notificationType: payload.notificationType ?? null,
      subtype: payload.subtype ?? null,
      originalTransactionId,
    };
  }

  const validatedState = await validateSubscription(originalTransactionId);

  for (const driver of drivers) {
    await persistDriverSubscriptionState({
      localUserId: driver.localUserId,
      state: validatedState,
      queryFn,
    });
  }

  return {
    ok: true,
    processed: true,
    notificationType: payload.notificationType ?? null,
    subtype: payload.subtype ?? null,
    originalTransactionId,
    subscriptionStatus: validatedState.subscriptionStatus,
  };
}

export function registerAppleSubscriptionRoutes(app: Express): void {
  app.post(
    "/webhooks/apple/app-store-server-notifications",
    async (req: Request, res: ExpressResponse) => {
      const signedPayload =
        typeof req.body?.signedPayload === "string"
          ? req.body.signedPayload.trim()
          : "";

      if (!signedPayload) {
        return res.status(400).json({
          ok: false,
          error: "Missing signedPayload.",
        });
      }

      try {
        const result = await processAppStoreServerNotification(signedPayload);
        return res.status(200).json(result);
      } catch (error) {
        console.error("[AppleSubscription] Notification processing failed:", error);
        return res.status(500).json({
          ok: false,
          error: "Notification processing failed.",
        });
      }
    },
  );
}

export async function validateSubscriptionWithApple(
  originalTransactionId: string,
): Promise<ValidatedSubscriptionState> {
  const bundleId = getAppleBundleId();
  const environments: AppleEnvironment[] = ["Production", "Sandbox"];

  for (const environment of environments) {
    const response = await fetchAppleSubscriptionStatus({
      environment,
      originalTransactionId,
    });

    if (!response) {
      continue;
    }

    const validatedState = extractValidatedSubscriptionState({
      response,
      originalTransactionId,
      bundleId,
    });

    if (validatedState) {
      return validatedState;
    }
  }

  return {
    subscriptionStatus: "expired",
    subscriptionPlan: null,
    subscriptionId: originalTransactionId,
    currentPeriodEnd: null,
    productId: null,
    environment: null,
    rawStatus: null,
  };
}

export function decodeJwsPayload<T>(token: string): T {
  const [, payload] = token.split(".");

  if (!payload) {
    throw new Error("Invalid JWS payload");
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
}

async function fetchAppleSubscriptionStatus(params: {
  environment: AppleEnvironment;
  originalTransactionId: string;
}): Promise<AppleSubscriptionResponse | null> {
  const authToken = createAppStoreConnectToken();
  const response = await requestAppleSubscriptionStatus({
    environment: params.environment,
    originalTransactionId: params.originalTransactionId,
    authToken,
  });
  const failureBody = !response.ok ? await readAppleErrorBody(response) : null;

  if (failureBody) {
    console.error("[AppleSubscription] Apple API lookup failed", {
      environment: params.environment,
      status: response.status,
      errorCode: failureBody.errorCode,
      errorMessage: failureBody.errorMessage,
      responseBody: failureBody.bodyText,
      originalTransactionId: maskValue(params.originalTransactionId),
    });
  }

  if (response.status === 401 && params.environment === "Production") {
    return await fetchAppleSubscriptionStatus({
      environment: "Sandbox",
      originalTransactionId: params.originalTransactionId,
    });
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `Apple subscription lookup failed (${params.environment}) with status ${response.status}${
        failureBody?.errorCode !== null && failureBody?.errorCode !== undefined
          ? `, errorCode=${failureBody.errorCode}`
          : ""
      }${
        failureBody?.errorMessage
          ? `, errorMessage=${failureBody.errorMessage}`
          : ""
      }`,
    );
  }

  const payload = (await response.json()) as AppleSubscriptionResponse;
  return {
    ...payload,
    environment: payload.environment ?? params.environment,
  };
}

async function requestAppleSubscriptionStatus(params: {
  environment: AppleEnvironment;
  originalTransactionId: string;
  authToken: string;
}): Promise<globalThis.Response> {
  const baseUrl =
    params.environment === "Sandbox"
      ? "https://api.storekit-sandbox.itunes.apple.com"
      : "https://api.storekit.itunes.apple.com";

  return fetch(
    `${baseUrl}/inApps/v1/subscriptions/${encodeURIComponent(params.originalTransactionId)}`,
    {
      headers: {
        Authorization: "Bearer " + params.authToken,
      },
    },
  );
}

function extractValidatedSubscriptionState(params: {
  response: AppleSubscriptionResponse;
  originalTransactionId: string;
  bundleId: string;
}): ValidatedSubscriptionState | null {
  if (params.response.bundleId && params.response.bundleId !== params.bundleId) {
    throw new Error("Apple bundle ID mismatch during subscription validation.");
  }

  const lastTransactions = (params.response.data ?? []).flatMap(
    (group) => group.lastTransactions ?? [],
  );
  const candidates = lastTransactions
    .map((transaction) => buildValidatedCandidate(transaction, params.response))
    .filter(
      (
        candidate,
      ): candidate is ValidatedSubscriptionState & { sortKey: number } =>
        Boolean(candidate) &&
        candidate.subscriptionId === params.originalTransactionId,
    )
    .sort((a, b) => b.sortKey - a.sortKey);

  if (candidates.length === 0) {
    return null;
  }

  const [best] = candidates;
  return {
    subscriptionStatus: best.subscriptionStatus,
    subscriptionPlan: best.subscriptionPlan,
    subscriptionId: best.subscriptionId,
    currentPeriodEnd: best.currentPeriodEnd,
    productId: best.productId,
    environment: best.environment,
    rawStatus: best.rawStatus,
  };
}

function buildValidatedCandidate(
  transaction: AppleLastTransaction,
  response: AppleSubscriptionResponse,
):
  | (ValidatedSubscriptionState & {
      sortKey: number;
    })
  | null {
  const transactionInfo = transaction.signedTransactionInfo
    ? decodeJwsPayload<AppleTransactionPayload>(transaction.signedTransactionInfo)
    : null;
  const renewalInfo = transaction.signedRenewalInfo
    ? decodeJwsPayload<AppleRenewalPayload>(transaction.signedRenewalInfo)
    : null;
  const subscriptionId =
    normaliseValue(transactionInfo?.originalTransactionId) ??
    normaliseValue(transaction.originalTransactionId);

  if (!subscriptionId) {
    return null;
  }

  const productId =
    normaliseValue(transactionInfo?.productId) ??
    normaliseValue(renewalInfo?.autoRenewProductId);
  const rawStatus = typeof transaction.status === "number" ? transaction.status : null;
  const currentPeriodEnd = toIsoString(transactionInfo?.expiresDate);
  const subscriptionStatus = mapAppleStatus({
    rawStatus,
    currentPeriodEnd,
    revocationDate: transactionInfo?.revocationDate,
  });

  return {
    subscriptionStatus,
    subscriptionPlan: planFromProductId(productId),
    subscriptionId,
    currentPeriodEnd,
    productId,
    environment: response.environment ?? null,
    rawStatus,
    sortKey:
      toTimestamp(transactionInfo?.expiresDate) ??
      toTimestamp(transactionInfo?.signedDate) ??
      toTimestamp(transactionInfo?.purchaseDate) ??
      0,
  };
}

function mapAppleStatus(params: {
  rawStatus: number | null;
  currentPeriodEnd: string | null;
  revocationDate?: number | string;
}): SubscriptionStatus {
  if (toTimestamp(params.revocationDate)) {
    return "cancelled";
  }

  switch (params.rawStatus) {
    case 1:
    case 4:
      if (params.currentPeriodEnd) {
        const expiresAt = new Date(params.currentPeriodEnd).getTime();
        if (Number.isFinite(expiresAt) && expiresAt <= Date.now()) {
          return "expired";
        }
      }
      return "active";
    case 3:
    case 5:
      return "cancelled";
    case 2:
    default:
      return "expired";
  }
}

async function persistDriverSubscriptionState(params: {
  localUserId: string;
  state: Pick<
    ValidatedSubscriptionState,
    "subscriptionStatus" | "subscriptionPlan" | "subscriptionId" | "currentPeriodEnd"
  >;
  queryFn: QueryFn;
}): Promise<void> {
  await params.queryFn(
    `
    UPDATE drivers
    SET
      subscriptionStatus = ?,
      subscriptionPlan = ?,
      subscriptionId = ?,
      currentPeriodEnd = ?,
      updatedAt = NOW()
    WHERE localUserId = ?
    LIMIT 1
    `,
    [
      params.state.subscriptionStatus,
      params.state.subscriptionPlan,
      params.state.subscriptionId,
      params.state.currentPeriodEnd,
      params.localUserId,
    ],
  );
}

function createAppStoreConnectToken(): string {
  logApplePrivateKeyDiagnosticsAtStartup();
  const issuerId = requiredEnv("APPLE_APP_STORE_ISSUER_ID");
  const keyId = requiredEnv("APPLE_APP_STORE_KEY_ID");
  const privateKey = normaliseApplePrivateKey(
    requiredEnv("APPLE_APP_STORE_PRIVATE_KEY"),
  );
  const now = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + 300,
    aud: APPLE_EXPECTED_AUDIENCE,
    bid: getAppleBundleId(),
  };

  logJwtDiagnosticsOnce({
    keyId,
    issuerId,
    header,
    payload,
  });

  const encodedHeader = base64UrlJson(header);
  const encodedPayload = base64UrlJson(payload);
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const signer = crypto.createSign("sha256");

  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign(privateKey).toString("base64url");
  return `${unsignedToken}.${signature}`;
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is not configured`);
  }

  return value;
}

function getAppleBundleId(): string {
  return process.env.APPLE_APP_STORE_BUNDLE_ID?.trim() || APPLE_EXPECTED_BUNDLE_ID;
}

function normaliseApplePrivateKey(value: string): string {
  return value.includes("\\n") ? value.replace(/\\n/g, "\n") : value;
}

function normaliseValue(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTimestamp(value?: number | string | null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric;
    }
  }

  return null;
}

function toIsoString(value?: number | string | null): string | null {
  const timestamp = toTimestamp(value);

  if (timestamp === null) {
    return null;
  }

  const date = new Date(timestamp);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function readAppleErrorBody(response: globalThis.Response): Promise<{
  bodyText: string | null;
  errorCode: number | string | null;
  errorMessage: string | null;
}> {
  const bodyText = await readResponseTextSafely(response);

  if (!bodyText) {
    return {
      bodyText: null,
      errorCode: null,
      errorMessage: null,
    };
  }

  try {
    const parsed = JSON.parse(bodyText) as AppleErrorResponse;
    const parsedErrorCode =
      typeof parsed.errorCode === "number" || typeof parsed.errorCode === "string"
        ? parsed.errorCode
        : null;
    const parsedErrorMessage =
      typeof parsed.errorMessage === "string" ? parsed.errorMessage : null;

    return {
      bodyText,
      errorCode: parsedErrorCode,
      errorMessage: parsedErrorMessage,
    };
  } catch {
    return {
      bodyText,
      errorCode: null,
      errorMessage: null,
    };
  }
}

async function readResponseTextSafely(
  response: globalThis.Response,
): Promise<string | null> {
  try {
    if (typeof response.clone === "function") {
      return await response.clone().text();
    }

    if (typeof response.text === "function") {
      return await response.text();
    }
  } catch (error) {
    console.error("[AppleSubscription] Failed to read Apple API error body", error);
  }

  return null;
}

function maskValue(value: string): string {
  if (value.length <= 10) {
    return value;
  }

  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function maskSecretForLogs(value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 12) {
    return compact;
  }

  return `${compact.slice(0, 8)}...${compact.slice(-8)}`;
}

function countNewLines(value: string): number {
  return (value.match(/\n/g) ?? []).length;
}

function logApplePrivateKeyDiagnosticsAtStartup(): void {
  if (appleKeyDiagnosticsLogged || process.env.NODE_ENV === "test") {
    return;
  }
  appleKeyDiagnosticsLogged = true;

  const rawValue = process.env.APPLE_APP_STORE_PRIVATE_KEY;
  if (!rawValue) {
    console.warn(
      "[AppleSubscription] APPLE_APP_STORE_PRIVATE_KEY is missing at startup.",
    );
    return;
  }

  const normalisedValue = normaliseApplePrivateKey(rawValue);
  const fingerprint = crypto
    .createHash("sha256")
    .update(normalisedValue)
    .digest("hex");

  console.info("[AppleSubscription] Private key diagnostics", {
    rawMasked: maskSecretForLogs(rawValue),
    normalisedMasked: maskSecretForLogs(normalisedValue),
    hasEscapedNewlines: rawValue.includes("\\n"),
    rawNewlineCount: countNewLines(rawValue),
    normalisedNewlineCount: countNewLines(normalisedValue),
    hasPemBegin: normalisedValue.includes("BEGIN PRIVATE KEY"),
    hasPemEnd: normalisedValue.includes("END PRIVATE KEY"),
    sha256Prefix: fingerprint.slice(0, 12),
    sha256Suffix: fingerprint.slice(-12),
  });
}

function logJwtDiagnosticsOnce(params: {
  keyId: string;
  issuerId: string;
  header: {
    alg: string;
    kid: string;
    typ: string;
  };
  payload: {
    iss: string;
    iat: number;
    exp: number;
    aud: string;
    bid: string;
  };
}): void {
  if (appleJwtDiagnosticsLogged || process.env.NODE_ENV === "test") {
    return;
  }
  appleJwtDiagnosticsLogged = true;

  const ttlSeconds = params.payload.exp - params.payload.iat;
  const diagnostics = {
    keyId: params.keyId,
    keyIdMatchesEnv: params.header.kid === params.keyId,
    keyIdMatchesExpected: params.header.kid === APPLE_EXPECTED_KEY_ID,
    jwtHeaderTyp: params.header.typ,
    jwtHeaderKidMatches: params.header.kid === params.keyId,
    issuerIdMasked: maskValue(params.issuerId),
    issuerMatchesEnv: params.payload.iss === params.issuerId,
    bundleId: params.payload.bid,
    bundleIdMatchesExpected: params.payload.bid === APPLE_EXPECTED_BUNDLE_ID,
    audience: params.payload.aud,
    audienceMatchesExpected: params.payload.aud === APPLE_EXPECTED_AUDIENCE,
    algorithm: params.header.alg,
    algorithmIsES256: params.header.alg === "ES256",
    iat: params.payload.iat,
    exp: params.payload.exp,
    iatIso: new Date(params.payload.iat * 1000).toISOString(),
    expIso: new Date(params.payload.exp * 1000).toISOString(),
    ttlSeconds,
    ttlWithinLimit: ttlSeconds > 0 && ttlSeconds <= APPLE_JWT_MAX_TTL_SECONDS,
  };

  console.info(
    "[AppleSubscription] JWT diagnostics",
    JSON.stringify(diagnostics),
  );
}
