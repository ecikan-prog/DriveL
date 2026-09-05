import {
  createHash,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "crypto";
import { NextFunction, Request, Response } from "express";

import { query } from "./db";

export const ADMIN_COOKIE_NAME = "drivelegal_admin_session";
export const ADMIN_DEFAULT_SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
export const ADMIN_REMEMBER_ME_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
export const ADMIN_PASSWORD_RESET_EXPIRY_MINUTES = 30;

const ADMIN_PASSWORD_HASH_PREFIX = "a1";
const ADMIN_PASSWORD_SALT_BYTES = 16;
const ADMIN_PASSWORD_KEY_BYTES = 32;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 5;
const RESET_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RESET_RATE_LIMIT_MAX_ATTEMPTS = 3;

type RateLimitState = {
  count: number;
  resetAt: number;
};

type AdminSessionPayload = {
  adminId: number;
  role: string;
  sessionVersion: number;
  issuedAt: number;
  maxAgeSeconds: number;
  nonce: string;
};

type ParsedAdminSession = {
  rawCookie: string;
  payload: AdminSessionPayload;
};

type AdminAuthRow = {
  id: number;
  name: string;
  email: string;
  role: string;
  isActive: number | boolean | null;
  sessionVersion: number | null;
};

type LoginAdminRow = AdminAuthRow & {
  passwordHash: string;
  lastLogin: string | Date | null;
  passwordResetTokenHash: string | null;
  passwordResetRequestedAt: string | Date | null;
  passwordResetExpiresAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type AuthenticatedAdmin = {
  id: number;
  name: string;
  email: string;
  role: string;
  sessionVersion: number;
};

const loginRateLimit = new Map<string, RateLimitState>();
const resetRateLimit = new Map<string, RateLimitState>();

function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function getSessionSecret(): string {
  const secret =
    process.env.ADMIN_SESSION_SECRET?.trim() ||
    process.env.ADMIN_KEY?.trim();

  if (!secret) {
    throw new Error(
      "ADMIN_SESSION_SECRET (or legacy ADMIN_KEY) is not configured",
    );
  }

  return secret;
}

function sign(value: string, purpose: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

function parseCookies(req: Request): Record<string, string> {
  const result: Record<string, string> = {};
  const raw = req.headers.cookie ?? "";

  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    const name = trimmed.slice(0, separator);
    const value = trimmed.slice(separator + 1);

    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }

  return result;
}

function buildCookieAttributes(req: Request, maxAgeSeconds: number): string {
  const forwardedProto = req.get("x-forwarded-proto");
  const secure =
    process.env.NODE_ENV === "production" ||
    req.secure ||
    forwardedProto === "https";

  return `Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSeconds}${
    secure ? "; Secure" : ""
  }`;
}

function parseAdminSessionCookie(req: Request): ParsedAdminSession | null {
  const rawCookie = parseCookies(req)[ADMIN_COOKIE_NAME];

  if (!rawCookie) {
    return null;
  }

  const [encoded, signature, extra] = rawCookie.split(".");

  if (!encoded || !signature || extra) {
    return null;
  }

  if (!safeEqual(signature, sign(encoded, "admin-session"))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<AdminSessionPayload>;

    if (
      typeof payload.adminId !== "number" ||
      !Number.isInteger(payload.adminId) ||
      payload.adminId <= 0 ||
      typeof payload.role !== "string" ||
      typeof payload.sessionVersion !== "number" ||
      !Number.isInteger(payload.sessionVersion) ||
      payload.sessionVersion < 0 ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.maxAgeSeconds !== "number" ||
      !Number.isFinite(payload.maxAgeSeconds) ||
      payload.maxAgeSeconds <= 0 ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    const age = Date.now() - payload.issuedAt;

    if (age < 0 || age > payload.maxAgeSeconds * 1000) {
      return null;
    }

    return {
      rawCookie,
      payload: payload as AdminSessionPayload,
    };
  } catch {
    return null;
  }
}

function rateLimitKey(req: Request, email: string): string {
  const ip = String(req.ip || req.socket.remoteAddress || "unknown");
  return `${email}|${ip}`;
}

function consumeRateLimit(
  store: Map<string, RateLimitState>,
  key: string,
  maxAttempts: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    store.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return true;
  }

  if (current.count >= maxAttempts) {
    return false;
  }

  current.count += 1;
  return true;
}

function clearRateLimit(
  store: Map<string, RateLimitState>,
  key: string,
): void {
  store.delete(key);
}

export function normaliseAdminEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateAdminPassword(password: string): string | null {
  if (password.length < 12) {
    return "Password must be at least 12 characters.";
  }

  if (password.length > 128) {
    return "Password must be 128 characters or fewer.";
  }

  if (!/[a-z]/.test(password)) {
    return "Password must include a lowercase letter.";
  }

  if (!/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }

  if (!/[0-9]/.test(password)) {
    return "Password must include a number.";
  }

  return null;
}

export function hashAdminPassword(password: string): string {
  const salt = randomBytes(ADMIN_PASSWORD_SALT_BYTES);
  const derivedKey = scryptSync(password, salt, ADMIN_PASSWORD_KEY_BYTES);

  return `${ADMIN_PASSWORD_HASH_PREFIX}$${salt.toString(
    "base64url",
  )}$${derivedKey.toString("base64url")}`;
}

export function verifyAdminPassword(
  password: string,
  storedHash: string | null | undefined,
): boolean {
  if (!password || !storedHash) {
    return false;
  }

  const [prefix, encodedSalt, encodedHash] = storedHash.split("$");

  if (
    prefix !== ADMIN_PASSWORD_HASH_PREFIX ||
    !encodedSalt ||
    !encodedHash
  ) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedHash = Buffer.from(encodedHash, "base64url");
    const derivedKey = scryptSync(password, salt, expectedHash.length);

    return timingSafeEqual(derivedKey, expectedHash);
  } catch {
    return false;
  }
}

export function generateAdminPasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256")
    .update(rawToken)
    .digest("hex");
  const expiresAt = new Date(
    Date.now() + ADMIN_PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
  );

  return {
    rawToken,
    tokenHash,
    expiresAt,
  };
}

export function hashAdminPasswordResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAdminSessionCookieValue(input: {
  adminId: number;
  role: string;
  sessionVersion: number;
  maxAgeSeconds?: number;
  issuedAt?: number;
  nonce?: string;
}): string {
  const payload: AdminSessionPayload = {
    adminId: input.adminId,
    role: input.role,
    sessionVersion: input.sessionVersion,
    issuedAt: input.issuedAt ?? Date.now(),
    maxAgeSeconds:
      input.maxAgeSeconds ?? ADMIN_DEFAULT_SESSION_MAX_AGE_SECONDS,
    nonce: input.nonce ?? randomBytes(18).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");

  return `${encoded}.${sign(encoded, "admin-session")}`;
}

export function createAdminSessionCookieHeader(
  req: Request,
  input: {
    adminId: number;
    role: string;
    sessionVersion: number;
    maxAgeSeconds?: number;
  },
): string {
  const maxAgeSeconds =
    input.maxAgeSeconds ?? ADMIN_DEFAULT_SESSION_MAX_AGE_SECONDS;
  const cookieValue = createAdminSessionCookieValue({
    ...input,
    maxAgeSeconds,
  });

  return `${ADMIN_COOKIE_NAME}=${encodeURIComponent(
    cookieValue,
  )}; ${buildCookieAttributes(req, maxAgeSeconds)}`;
}

export function createExpiredAdminSessionCookie(req: Request): string {
  return `${ADMIN_COOKIE_NAME}=; ${buildCookieAttributes(req, 0)}`;
}

export function createAdminCsrfToken(req: Request): string {
  const parsed = parseAdminSessionCookie(req);

  if (!parsed) {
    return "";
  }

  return sign(parsed.rawCookie, "admin-csrf");
}

export function hasValidAdminCsrf(req: Request): boolean {
  const supplied =
    typeof req.body?.csrfToken === "string" ? req.body.csrfToken : "";
  const expected = createAdminCsrfToken(req);

  return Boolean(supplied && expected && safeEqual(supplied, expected));
}

export function hasAdminSessionCookie(req: Request): boolean {
  return parseAdminSessionCookie(req) !== null;
}

export function getAdminAppUrl(): string {
  return (
    process.env.ADMIN_APP_URL?.trim().replace(/\/+$/, "") ||
    "https://admin.drivelegal.app"
  );
}

export async function getAdminByEmail(
  email: string,
): Promise<LoginAdminRow | null> {
  const rows = await query<LoginAdminRow>(
    `
      SELECT
        id,
        name,
        email,
        passwordHash,
        role,
        isActive,
        sessionVersion,
        lastLogin,
        passwordResetTokenHash,
        passwordResetRequestedAt,
        passwordResetExpiresAt,
        createdAt,
        updatedAt
      FROM admin_accounts
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
}

export async function authenticateAdminRequest(
  req: Request,
): Promise<AuthenticatedAdmin | null> {
  const parsed = parseAdminSessionCookie(req);

  if (!parsed || parsed.payload.role !== "admin") {
    return null;
  }

  const rows = await query<AdminAuthRow>(
    `
      SELECT id, name, email, role, isActive, sessionVersion
      FROM admin_accounts
      WHERE id = ?
      LIMIT 1
    `,
    [parsed.payload.adminId],
  );

  const admin = rows[0];

  if (
    !admin ||
    admin.role !== "admin" ||
    !booleanValue(admin.isActive) ||
    Number(admin.sessionVersion ?? 0) !== parsed.payload.sessionVersion
  ) {
    return null;
  }

  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    sessionVersion: Number(admin.sessionVersion ?? 0),
  };
}

export function consumeAdminLoginRateLimit(
  req: Request,
  email: string,
): boolean {
  return consumeRateLimit(
    loginRateLimit,
    rateLimitKey(req, email),
    LOGIN_RATE_LIMIT_MAX_ATTEMPTS,
    LOGIN_RATE_LIMIT_WINDOW_MS,
  );
}

export function clearAdminLoginRateLimit(
  req: Request,
  email: string,
): void {
  clearRateLimit(loginRateLimit, rateLimitKey(req, email));
}

export function consumeAdminResetRateLimit(
  req: Request,
  email: string,
): boolean {
  return consumeRateLimit(
    resetRateLimit,
    rateLimitKey(req, email),
    RESET_RATE_LIMIT_MAX_ATTEMPTS,
    RESET_RATE_LIMIT_WINDOW_MS,
  );
}

export async function requireAdminUiAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const publicPaths = new Set([
    "/",
    "/login",
    "/forgot-password",
    "/reset-password",
  ]);

  if (publicPaths.has(req.path)) {
    next();
    return;
  }

  try {
    const admin = await authenticateAdminRequest(req);

    if (!admin) {
      res.redirect("/admin/login");
      return;
    }

    res.locals.authenticatedAdmin = admin;
    next();
  } catch (error) {
    console.error("[ADMIN AUTH ERROR]", error);
    res.status(500).send("Administrator authentication is unavailable.");
  }
}
