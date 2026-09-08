import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  processAppStoreServerNotification,
  syncDriverSubscriptionRecord,
  validateSubscriptionWithApple,
} from "../server/apple-subscriptions";

function makeSignedPayload(payload: unknown): string {
  return [
    Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("apple subscription server validation", () => {
  const originalEnv = {
    issuerId: process.env.APPLE_APP_STORE_ISSUER_ID,
    keyId: process.env.APPLE_APP_STORE_KEY_ID,
    privateKey: process.env.APPLE_APP_STORE_PRIVATE_KEY,
    bundleId: process.env.APPLE_APP_STORE_BUNDLE_ID,
    nodeEnv: process.env.NODE_ENV,
  };

  beforeEach(() => {
    const { privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });

    process.env.APPLE_APP_STORE_ISSUER_ID =
      "00000000-0000-0000-0000-000000000001";
    process.env.APPLE_APP_STORE_KEY_ID = "ABC123DEFG";
    process.env.APPLE_APP_STORE_PRIVATE_KEY = privateKey.export({
      type: "pkcs8",
      format: "pem",
    }) as string;
    process.env.APPLE_APP_STORE_BUNDLE_ID = "app.drivelegal.mobile";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env.APPLE_APP_STORE_ISSUER_ID = originalEnv.issuerId;
    process.env.APPLE_APP_STORE_KEY_ID = originalEnv.keyId;
    process.env.APPLE_APP_STORE_PRIVATE_KEY = originalEnv.privateKey;
    process.env.APPLE_APP_STORE_BUNDLE_ID = originalEnv.bundleId;
    process.env.NODE_ENV = originalEnv.nodeEnv;
  });

  it("downgrades a client-reported active subscription when Apple says expired", async () => {
    const queryFn = vi.fn(async () => []);
    const result = await syncDriverSubscriptionRecord(
      {
        localUserId: "driver-1",
        requestedStatus: "active",
        requestedPlan: "monthly",
        requestedSubscriptionId: "orig-1",
        requestedCurrentPeriodEnd: "2026-10-01T00:00:00.000Z",
      },
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "expired",
          subscriptionPlan: "monthly",
          subscriptionId: "orig-1",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.monthly",
          environment: "Production",
          rawStatus: 2,
        }),
      },
    );

    expect(result).toEqual({
      success: true,
      subscriptionStatus: "expired",
      subscriptionPlan: "monthly",
      subscriptionId: "orig-1",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect((queryFn.mock.calls[0] as any[] | undefined)?.[1]).toEqual([
      "expired",
      "monthly",
      "orig-1",
      "2026-09-01T00:00:00.000Z",
      "driver-1",
    ]);
  });

  it("keeps legitimate active purchase syncs active after Apple validation", async () => {
    const queryFn = vi.fn(async () => []);
    const result = await syncDriverSubscriptionRecord(
      {
        localUserId: "driver-1",
        requestedStatus: "active",
        requestedPlan: "annual",
        requestedSubscriptionId: "orig-annual",
        requestedCurrentPeriodEnd: "2027-09-01T00:00:00.000Z",
      },
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "active",
          subscriptionPlan: "annual",
          subscriptionId: "orig-annual",
          currentPeriodEnd: "2027-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.annual",
          environment: "Production",
          rawStatus: 1,
        }),
      },
    );

    expect(result).toEqual({
      success: true,
      subscriptionStatus: "active",
      subscriptionPlan: "annual",
      subscriptionId: "orig-annual",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("updates stored status from an App Store notification without client involvement", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT localUserId")) {
        return [{ localUserId: "driver-1" }];
      }

      return [];
    });

    const result = await processAppStoreServerNotification(
      makeSignedPayload({
        notificationType: "EXPIRED",
        subtype: null,
        data: {
          signedTransactionInfo: makeSignedPayload({
            originalTransactionId: "orig-1",
          }),
        },
      }),
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "expired",
          subscriptionPlan: "monthly",
          subscriptionId: "orig-1",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.monthly",
          environment: "Production",
          rawStatus: 2,
        }),
      },
    );

    expect(result).toEqual({
      ok: true,
      processed: true,
      notificationType: "EXPIRED",
      subtype: null,
      originalTransactionId: "orig-1",
      subscriptionStatus: "expired",
    });
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect((queryFn.mock.calls[1] as any[] | undefined)?.[1]).toEqual([
      "expired",
      "monthly",
      "orig-1",
      "2026-09-01T00:00:00.000Z",
      "driver-1",
    ]);
  });

  it("falls back to the sandbox App Store endpoint after a production 401", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          environment: "Sandbox",
          bundleId: "app.drivelegal.mobile",
          data: [
            {
              lastTransactions: [
                {
                  originalTransactionId: "orig-sandbox",
                  status: 1,
                  signedTransactionInfo: makeSignedPayload({
                    originalTransactionId: "orig-sandbox",
                    productId: "com.drivelegal.app.monthly",
                    expiresDate: Date.now() + 86_400_000,
                    signedDate: Date.now(),
                  }),
                  signedRenewalInfo: makeSignedPayload({
                    autoRenewProductId: "com.drivelegal.app.monthly",
                  }),
                },
              ],
            },
          ],
        }),
      } as Response);

    const result = await validateSubscriptionWithApple("orig-sandbox");

    expect(result.subscriptionStatus).toBe("active");
    expect(result.subscriptionPlan).toBe("monthly");
    expect(result.subscriptionId).toBe("orig-sandbox");
    expect(result.environment).toBe("Sandbox");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(
      "https://api.storekit.itunes.apple.com",
    );
    expect(fetchMock.mock.calls[1]?.[0]).toContain(
      "https://api.storekit-sandbox.itunes.apple.com",
    );
  });

  it("surfaces Apple errorCode and errorMessage from failed lookups", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            errorCode: 4001001,
            errorMessage: "Invalid JWT signature",
          }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () =>
          JSON.stringify({
            errorCode: 4001001,
            errorMessage: "Invalid JWT signature",
          }),
      } as Response);

    await expect(validateSubscriptionWithApple("orig-fail")).rejects.toThrow(
      /errorCode=4001001, errorMessage=Invalid JWT signature/,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("sends an App Store JWT with the exact protected header Apple requires", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        environment: "Production",
        bundleId: "app.drivelegal.mobile",
        data: [],
      }),
    } as Response);

    await validateSubscriptionWithApple("orig-header");

    const request = fetchMock.mock.calls[0]?.[1] as
      | { headers?: Record<string, string> }
      | undefined;
    const authHeader = request?.headers?.Authorization;
    expect(authHeader).toMatch(/^Bearer\s+\S+\.\S+\.\S+$/);

    const token = authHeader?.slice("Bearer ".length) ?? "";
    const [encodedHeader] = token.split(".");
    const header = JSON.parse(
      Buffer.from(encodedHeader ?? "", "base64url").toString("utf8"),
    );

    expect(header).toEqual({
      alg: "ES256",
      kid: "ABC123DEFG",
      typ: "JWT",
    });
  });

  it("logs safe JWT header diagnostics without logging the JWT itself", async () => {
    vi.resetModules();
    process.env.NODE_ENV = "development";

    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        environment: "Production",
        bundleId: "app.drivelegal.mobile",
        data: [],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const module = await import("../server/apple-subscriptions");
    await module.validateSubscriptionWithApple("orig-diagnostics");

    const jwtDiagnosticsCall = consoleInfo.mock.calls.find(
      ([message]) => message === "[AppleSubscription] JWT diagnostics",
    );
    expect(jwtDiagnosticsCall).toBeTruthy();

    const diagnostics = JSON.parse(String(jwtDiagnosticsCall?.[1] ?? "{}"));
    expect(diagnostics.jwtHeaderTyp).toBe("JWT");
    expect(diagnostics.jwtHeaderKidMatches).toBe(true);
    expect(diagnostics).not.toHaveProperty("jwt");
    expect(diagnostics).not.toHaveProperty("privateKey");
  });
});
