import { Express, NextFunction, Request, Response } from "express";
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { query } from "./db";

/* ─────────────────────────────────────────────
   CONSTANTS
   ───────────────────────────────────────────── */

const COOKIE_NAME = "drivelegal_operator_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const TRIAL_DAYS = 21;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_EXPIRY_MINUTES = 30;

/**
 * Sends an email through Brevo's transactional email HTTP API. Requires
 * BREVO_API_KEY to be set in the environment, plus BREVO_FROM_EMAIL (a
 * verified sender address on the drivelegal.app domain in Brevo).
 * BREVO_FROM_NAME is optional and defaults to "Drive Legal".
 */
async function sendBrevoEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured");
  }

  const fromEmail = process.env.BREVO_FROM_EMAIL;

  if (!fromEmail) {
    throw new Error("BREVO_FROM_EMAIL is not configured");
  }

  const fromName = process.env.BREVO_FROM_NAME || "Drive Legal";

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Brevo request failed (${response.status}): ${body.slice(0, 300)}`
    );
  }
}

function generatePasswordResetToken(): {
  rawToken: string;
  tokenHash: string;
  expiresAt: Date;
} {
  const rawToken = randomBytes(PASSWORD_RESET_TOKEN_BYTES).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(
    Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000
  );

  return { rawToken, tokenHash, expiresAt };
}

/* ─────────────────────────────────────────────
   TYPES
   ───────────────────────────────────────────── */

type OperatorAccountRow = {
  id: number;
  email: string;
  passwordHash: string;
  companyName: string;
  contactName: string;
};

type OperatorProfileRow = {
  id: number;
  email: string;
  companyName: string;
  contactName: string;
};

type OperatorDriverRow = {
  id: number;
  localUserId: string;
  name: string | null;
  email: string | null;
  licenceNumber: string | null;
  vehicleRegistration: string | null;
  driverType: string | null;
  emailVerified: number | boolean | null;
  trialStartDate: string | Date | null;
  shiftCount: number | string | null;
  activeShiftCount: number | string | null;
};

type LinkedDriverDetailRow = {
  id: number;
  localUserId: string;
  name: string | null;
  email: string | null;
  licenceNumber: string | null;
  vehicleRegistration: string | null;
  driverType: string | null;
  emailVerified: number | boolean | null;
  trialStartDate: string | Date | null;
  createdAt: string | Date | null;
};

type ShiftRecord = {
  id: number;
  logId: string | null;
  startTime: string | Date | null;
  endTime: string | Date | null;
  hash: string | null;
  previousHash: string | null;
  createdAt: string | Date | null;
};

type TrialStatus = {
  label: string;
  daysLeft: number | null;
  expired: boolean;
  started: boolean;
  expiryDate: Date | null;
  className: "trial" | "expired" | "neutral";
};

type FlashTone = "success" | "warning" | "error" | "info";

type OperatorSessionPayload = {
  operatorId: number;
  issuedAt: number;
  nonce: string;
};

/* ─────────────────────────────────────────────
   SECURITY
   ───────────────────────────────────────────── */

function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}

/**
 * The operator session cookie is HMAC-signed with a dedicated secret.
 * OPERATOR_SESSION_SECRET is preferred; if it has not been configured on
 * Railway yet this falls back to ADMIN_KEY (already required by
 * admin-ui.ts) so this feature works without any Railway/env changes.
 * Nothing here touches server/index.ts, Railway settings, or the admin
 * portal's own cookie/secret handling.
 */
function getSessionSecret(): string {
  const secret =
    process.env.OPERATOR_SESSION_SECRET || process.env.ADMIN_KEY;

  if (!secret) {
    throw new Error(
      "OPERATOR_SESSION_SECRET (or ADMIN_KEY) is not configured"
    );
  }

  return secret;
}

function sign(value: string, purpose: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

function createSessionCookieValue(operatorId: number): string {
  const payload: OperatorSessionPayload = {
    operatorId,
    issuedAt: Date.now(),
    nonce: randomBytes(18).toString("base64url"),
  };

  const encoded = Buffer.from(JSON.stringify(payload)).toString(
    "base64url"
  );

  return `${encoded}.${sign(encoded, "operator-session")}`;
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

function getValidSession(req: Request): OperatorSessionPayload | null {
  const supplied = parseCookies(req)[COOKIE_NAME];

  if (!supplied) {
    return null;
  }

  const [encoded, signature, extra] = supplied.split(".");

  if (!encoded || !signature || extra) {
    return null;
  }

  if (!safeEqual(signature, sign(encoded, "operator-session"))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as Partial<OperatorSessionPayload>;

    if (
      typeof payload.operatorId !== "number" ||
      !Number.isInteger(payload.operatorId) ||
      payload.operatorId <= 0 ||
      typeof payload.issuedAt !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    const age = Date.now() - payload.issuedAt;

    if (age < 0 || age > SESSION_MAX_AGE_SECONDS * 1000) {
      return null;
    }

    return payload as OperatorSessionPayload;
  } catch {
    return null;
  }
}

function getRawSessionCookie(req: Request): string | null {
  return parseCookies(req)[COOKIE_NAME] ?? null;
}

function hasOperatorSession(req: Request): boolean {
  return getValidSession(req) !== null;
}

function createCsrfToken(req: Request): string {
  const raw = getRawSessionCookie(req);

  if (!raw || !getValidSession(req)) {
    return "";
  }

  return sign(raw, "operator-csrf");
}

function hasValidCsrf(req: Request): boolean {
  const supplied =
    typeof req.body?.csrfToken === "string" ? req.body.csrfToken : "";

  const expected = createCsrfToken(req);

  return Boolean(supplied && expected && safeEqual(supplied, expected));
}

/**
 * Guards a route: requires a valid operator session and returns the
 * authenticated operator's ID. Redirects to the login page and returns
 * null if there is no valid session.
 */
function requireOperator(req: Request, res: Response): number | null {
  const session = getValidSession(req);

  if (!session) {
    res.redirect("/operator/login");
    return null;
  }

  return session.operatorId;
}

function rejectInvalidCsrf(req: Request, res: Response): boolean {
  if (!hasValidCsrf(req)) {
    res.status(403).send(
      renderSimplePage(
        "Request blocked",
        "The security token was missing or expired. Return to the dashboard and try again.",
        "/operator/dashboard"
      )
    );
    return true;
  }

  return false;
}

/**
 * SHA-256 hex-digest password verification. This intentionally matches
 * the unsalted SHA-256 scheme admin-ui.ts uses when creating an
 * operator's passwordHash, so operators can log in with the password
 * an administrator issued them.
 */
function verifyPassword(
  submittedPassword: string,
  storedHash: string | null | undefined
): boolean {
  if (!submittedPassword || !storedHash) {
    return false;
  }

  const candidateHash = createHash("sha256")
    .update(submittedPassword)
    .digest("hex");

  return safeEqual(candidateHash, storedHash);
}

/* ─────────────────────────────────────────────
   DISPLAY HELPERS
   ───────────────────────────────────────────── */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-NZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("en-NZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatDuration(startValue: unknown, endValue: unknown): string {
  if (!startValue || !endValue) {
    return "In progress";
  }

  const start = new Date(String(startValue)).getTime();
  const end = new Date(String(endValue)).getTime();

  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
    return "—";
  }

  const totalMinutes = Math.round((end - start) / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}

function formatHoursFromMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "0h 00m";
  }

  const wholeMinutes = Math.round(minutes);
  const hours = Math.floor(wholeMinutes / 60);
  const remainder = wholeMinutes % 60;

  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

function getTrialStatus(trialStartValue: unknown): TrialStatus {
  if (!trialStartValue) {
    return {
      label: "Trial not started",
      daysLeft: null,
      expired: false,
      started: false,
      expiryDate: null,
      className: "neutral",
    };
  }

  const trialStart = new Date(String(trialStartValue));

  if (Number.isNaN(trialStart.getTime())) {
    return {
      label: "Trial not started",
      daysLeft: null,
      expired: false,
      started: false,
      expiryDate: null,
      className: "neutral",
    };
  }

  const expiryDate = new Date(trialStart.getTime() + TRIAL_DAYS * ONE_DAY_MS);
  const millisecondsRemaining = expiryDate.getTime() - Date.now();
  const expired = millisecondsRemaining <= 0;
  const daysLeft = expired
    ? 0
    : Math.ceil(millisecondsRemaining / ONE_DAY_MS);

  return {
    label: expired
      ? "Trial expired"
      : `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    daysLeft,
    expired,
    started: true,
    expiryDate,
    className: expired ? "expired" : "trial",
  };
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function initials(name: unknown): string {
  const parts = String(name ?? "Driver")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);

  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "DL";
}

function queryMessage(req: Request): string {
  return typeof req.query.message === "string" ? req.query.message : "";
}

function queryTone(req: Request): FlashTone {
  const tone = req.query.tone;

  if (
    tone === "success" ||
    tone === "warning" ||
    tone === "error" ||
    tone === "info"
  ) {
    return tone;
  }

  return "info";
}

function redirectWithMessage(
  res: Response,
  path: string,
  message: string,
  tone: FlashTone = "success"
): Response {
  const separator = path.includes("?") ? "&" : "?";

  return res.redirect(
    `${path}${separator}message=${encodeURIComponent(
      message
    )}&tone=${encodeURIComponent(tone)}`
  );
}

function renderFlash(req: Request): string {
  const message = queryMessage(req);

  if (!message) {
    return "";
  }

  return `
    <div class="flash flash-${queryTone(req)}" role="status">
      <span>${escapeHtml(message)}</span>
      <button type="button" aria-label="Dismiss message" onclick="this.parentElement.remove()">×</button>
    </div>
  `;
}

function statusBadge(trial: TrialStatus): string {
  return `<span class="status ${trial.className}">${escapeHtml(trial.label)}</span>`;
}

function emailStatusBadge(value: unknown): string {
  return booleanValue(value)
    ? `<span class="status verified">Verified</span>`
    : `<span class="status unverified">Unverified</span>`;
}

/* ─────────────────────────────────────────────
   DESIGN SYSTEM (mirrors admin-ui.ts)
   ───────────────────────────────────────────── */

const operatorStyles = `
  :root {
    --page: #061a31;
    --page-deep: #041426;
    --sidebar: #0b4177;
    --sidebar-active: #245796;
    --panel: #142d48;
    --panel-2: #1a3552;
    --panel-3: #284560;
    --border: #34516e;
    --border-soft: rgba(255,255,255,0.10);
    --text: #f8fbff;
    --muted: #aebdd0;
    --muted-2: #8296ae;
    --primary: #5d7fe7;
    --primary-hover: #6f8ef0;
    --success: #2ac769;
    --success-soft: #d9f8e2;
    --warning: #f1c55f;
    --warning-soft: #fff1c4;
    --danger: #ef4d55;
    --danger-hover: #ff5a63;
    --danger-soft: #ffe0e0;
    --radius-lg: 16px;
    --radius-md: 11px;
    --shadow: 0 18px 45px rgba(0,0,0,0.16);
  }

  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background: var(--page);
    color: var(--text);
    font-family:
      Inter,
      ui-sans-serif,
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Arial,
      sans-serif;
  }

  body {
    min-height: 100vh;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
  }

  a {
    color: inherit;
  }

  .layout {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 224px minmax(0, 1fr);
  }

  .sidebar {
    min-height: 100vh;
    position: sticky;
    top: 0;
    align-self: start;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #0b4177 0%, #0a3b6d 100%);
    border-right: 1px solid rgba(255,255,255,0.08);
  }

  .brand {
    min-height: 122px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 26px 24px;
    border-bottom: 1px solid rgba(255,255,255,0.13);
  }

  .brand strong {
    display: block;
    font-size: 22px;
    line-height: 1;
    letter-spacing: 0.7px;
  }

  .brand strong span {
    color: #43d070;
  }

  .brand small {
    display: block;
    margin-top: 9px;
    color: #cad8e9;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 2.1px;
  }

  .nav {
    flex: 1;
    padding: 22px 0;
  }

  .nav a {
    min-height: 50px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 20px;
    border-left: 4px solid transparent;
    color: #f8fbff;
    text-decoration: none;
    font-size: 15px;
    font-weight: 750;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .nav a:hover {
    background: rgba(255,255,255,0.07);
  }

  .nav a.active {
    background: var(--sidebar-active);
    border-left-color: #7892ff;
  }

  .nav-icon {
    width: 22px;
    display: inline-grid;
    place-items: center;
    font-size: 17px;
  }

  .logout {
    padding: 20px 22px;
    border-top: 1px solid rgba(255,255,255,0.13);
  }

  .logout button {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid rgba(255,255,255,0.18);
    border-radius: 9px;
    background: rgba(255,255,255,0.06);
    color: #ffffff;
    font-size: 14px;
    font-weight: 750;
    cursor: pointer;
  }

  .logout button:hover {
    background: rgba(255,255,255,0.11);
  }

  .content {
    min-width: 0;
    padding: 30px 32px 42px;
  }

  .page-shell {
    width: 100%;
    max-width: 1450px;
    margin: 0 auto;
  }

  .page-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    margin-bottom: 24px;
  }

  h1 {
    margin: 0;
    font-size: clamp(28px, 3vw, 36px);
    line-height: 1.1;
    letter-spacing: -0.6px;
  }

  .subtitle {
    margin: 7px 0 0;
    color: var(--muted);
    font-size: 16px;
    line-height: 1.5;
  }

  .header-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 9px;
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(4, minmax(145px, 1fr));
    gap: 14px;
    margin-bottom: 24px;
  }

  .card,
  .panel {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: 0 1px 0 rgba(255,255,255,0.02) inset;
  }

  .card {
    min-height: 112px;
    padding: 19px 20px;
  }

  .card-label {
    color: #d5deea;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 1.25px;
    text-transform: uppercase;
  }

  .card-value {
    margin-top: 11px;
    color: #6f8cff;
    font-size: 34px;
    font-weight: 850;
    line-height: 1;
  }

  .card-value.success {
    color: var(--success);
  }

  .card-value.danger {
    color: var(--danger);
  }

  .card-value.text-value {
    font-size: 18px;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .card-note {
    margin-top: 8px;
    color: var(--muted-2);
    font-size: 12px;
  }

  .panel {
    overflow: hidden;
  }

  .panel + .panel {
    margin-top: 20px;
  }

  .panel-header {
    min-height: 58px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border);
    font-size: 18px;
    font-weight: 850;
  }

  .panel-subtitle {
    margin-top: 4px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 500;
  }

  .table-scroll {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  th,
  td {
    padding: 13px 16px;
    border-bottom: 1px solid var(--border);
    text-align: left;
    vertical-align: middle;
  }

  tbody tr:last-child td {
    border-bottom: 0;
  }

  tbody tr:hover td {
    background: #183451;
  }

  th {
    background: var(--panel-3);
    color: #f7fbff;
    font-size: 11px;
    font-weight: 850;
    letter-spacing: 0.95px;
    white-space: nowrap;
    text-transform: uppercase;
  }

  td {
    background: var(--panel);
    color: #f5f8fc;
    font-size: 14px;
  }

  td strong {
    font-size: 14px;
  }

  .driver-cell {
    min-width: 190px;
  }

  .driver-summary {
    display: flex;
    align-items: center;
    gap: 11px;
  }

  .avatar {
    width: 34px;
    height: 34px;
    flex: 0 0 34px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    background: #31527b;
    color: #ffffff;
    font-size: 12px;
    font-weight: 850;
  }

  .muted {
    display: block;
    margin-top: 3px;
    color: var(--muted);
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 850;
    line-height: 1.1;
    white-space: nowrap;
  }

  .status::before {
    content: "";
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: currentColor;
    opacity: 0.8;
  }

  .verified {
    background: var(--success-soft);
    color: #176b37;
  }

  .unverified,
  .expired {
    background: var(--danger-soft);
    color: #a22323;
  }

  .trial {
    background: var(--warning-soft);
    color: #805514;
  }

  .neutral {
    background: #dfe8f3;
    color: #40536b;
  }

  .action-cell {
    width: 176px;
    min-width: 176px;
    text-align: right;
    white-space: nowrap;
  }

  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 34px;
    padding: 7px 11px;
    border: 1px solid transparent;
    border-radius: 8px;
    color: #ffffff;
    text-decoration: none;
    font-size: 12px;
    font-weight: 800;
    line-height: 1.1;
    cursor: pointer;
    white-space: nowrap;
  }

  .button-primary {
    background: var(--primary);
    border-color: #8198ec;
  }

  .button-primary:hover {
    background: var(--primary-hover);
  }

  .button-secondary {
    background: #203b57;
    border-color: #5e7590;
  }

  .button-secondary:hover {
    background: #294762;
  }

  .button-compact {
    min-height: 30px;
    padding: 6px 9px;
    font-size: 11px;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin: 18px 0;
  }

  .toolbar-group {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .profile-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(160px, 1fr));
    gap: 0;
  }

  .profile-item {
    min-height: 88px;
    padding: 18px 20px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
  }

  .profile-item:nth-child(3n) {
    border-right: 0;
  }

  .profile-item:nth-last-child(-n + 3) {
    border-bottom: 0;
  }

  .profile-item small {
    display: block;
    margin-bottom: 7px;
    color: var(--muted);
    font-size: 10px;
    font-weight: 850;
    letter-spacing: 1.05px;
    text-transform: uppercase;
  }

  .profile-item strong {
    display: block;
    font-size: 15px;
    overflow-wrap: anywhere;
  }

  .empty {
    padding: 34px 24px;
    color: var(--muted);
    text-align: center;
  }

  .empty strong {
    display: block;
    margin-bottom: 6px;
    color: #ffffff;
    font-size: 16px;
  }

  .flash {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    margin-bottom: 18px;
    padding: 12px 15px;
    border: 1px solid transparent;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 700;
  }

  .flash button {
    border: 0;
    background: transparent;
    color: inherit;
    font-size: 21px;
    line-height: 1;
    cursor: pointer;
  }

  .flash-success {
    background: rgba(42,199,105,0.14);
    border-color: rgba(42,199,105,0.38);
    color: #b8f5ce;
  }

  .flash-warning {
    background: rgba(241,197,95,0.14);
    border-color: rgba(241,197,95,0.38);
    color: #ffe3a0;
  }

  .flash-error {
    background: rgba(239,77,85,0.15);
    border-color: rgba(239,77,85,0.42);
    color: #ffc1c4;
  }

  .flash-info {
    background: rgba(93,127,231,0.16);
    border-color: rgba(93,127,231,0.42);
    color: #c8d3ff;
  }

  .code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #c8d4e6;
  }

  .error-page {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .error-box {
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid #7f3543;
    border-radius: 16px;
    background: #50202b;
    box-shadow: var(--shadow);
  }

  .error-box h1 {
    font-size: 28px;
  }

  .error-box p {
    color: #ffd7dd;
    line-height: 1.6;
  }

  .login-page {
    min-height: 100vh;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(380px, 0.9fr);
    background: #eef3ff;
    color: #12386e;
  }

  .login-brand {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: clamp(40px, 8vw, 110px);
    background:
      radial-gradient(circle at 20% 20%, rgba(92,126,231,0.28), transparent 36%),
      linear-gradient(145deg, #061a31, #0c4277);
    color: #ffffff;
  }

  .login-brand h1 {
    font-size: clamp(42px, 6vw, 72px);
  }

  .login-brand h1 span {
    color: #43d070;
  }

  .login-brand p {
    max-width: 560px;
    margin-top: 18px;
    color: #c6d5e6;
    font-size: 18px;
    line-height: 1.6;
  }

  .login-side {
    display: grid;
    place-items: center;
    padding: 28px;
  }

  .login-card {
    width: min(430px, 100%);
    padding: 34px;
    border-radius: 18px;
    background: #ffffff;
    box-shadow: 0 20px 54px rgba(18,56,110,0.18);
  }

  .login-card h2 {
    margin: 0 0 8px;
    font-size: 30px;
  }

  .login-card > p {
    margin: 0 0 24px;
    color: #677893;
  }

  .field-label {
    display: block;
    margin-bottom: 8px;
    font-weight: 800;
  }

  .field-group + .field-group {
    margin-top: 18px;
  }

  .field-input {
    width: 100%;
    padding: 13px 14px;
    border: 1px solid #ccd6e8;
    border-radius: 10px;
    outline: none;
    font-size: 16px;
  }

  .field-input:focus {
    border-color: #5d7fe7;
    box-shadow: 0 0 0 3px rgba(93,127,231,0.14);
  }

  .login-submit {
    width: 100%;
    margin-top: 24px;
    padding: 13px;
    border: 0;
    border-radius: 10px;
    background: #145ddd;
    color: #ffffff;
    font-size: 16px;
    font-weight: 850;
    cursor: pointer;
  }

  .login-error {
    margin-bottom: 16px;
    padding: 11px 12px;
    border-radius: 9px;
    background: #fff0f0;
    color: #a31515;
    font-size: 14px;
    font-weight: 700;
  }

  .login-banner {
    margin-bottom: 16px;
    padding: 11px 12px;
    border-radius: 9px;
    font-size: 14px;
    font-weight: 700;
  }

  .login-banner-success {
    background: #e3f9ec;
    color: #146c3c;
  }

  .login-banner-warning {
    background: #fff4dc;
    color: #7a520c;
  }

  .login-banner-info {
    background: #e9eefc;
    color: #1d3d8f;
  }

  .login-banner-error {
    background: #fff0f0;
    color: #a31515;
  }

  .login-card a {
    color: #145ddd;
    font-weight: 750;
    text-decoration: underline;
  }

  .login-note {
    margin-top: 18px;
    color: #677893;
    font-size: 13px;
    line-height: 1.5;
    text-align: center;
  }

  .login-field-footer {
    display: flex;
    justify-content: flex-end;
    margin-top: 8px;
  }

  .login-field-footer a {
    font-size: 13px;
  }

  @media (max-width: 1120px) {
    .layout {
      grid-template-columns: 198px minmax(0, 1fr);
    }

    .content {
      padding: 26px 24px 36px;
    }

    .cards {
      grid-template-columns: repeat(2, minmax(150px, 1fr));
    }

    .action-cell {
      width: 150px;
      min-width: 150px;
    }

    .profile-grid {
      grid-template-columns: repeat(2, minmax(160px, 1fr));
    }

    .profile-item:nth-child(3n) {
      border-right: 1px solid var(--border);
    }

    .profile-item:nth-child(2n) {
      border-right: 0;
    }

    .profile-item:nth-last-child(-n + 3) {
      border-bottom: 1px solid var(--border);
    }

    .profile-item:nth-last-child(-n + 2) {
      border-bottom: 0;
    }
  }

  @media (max-width: 820px) {
    .layout {
      display: block;
    }

    .sidebar {
      min-height: auto;
      position: static;
    }

    .brand {
      min-height: auto;
      padding: 18px 20px;
    }

    .nav {
      display: flex;
      overflow-x: auto;
      padding: 0;
    }

    .nav a {
      min-height: 48px;
      flex: 0 0 auto;
      padding: 12px 16px;
      border-left: 0;
      border-bottom: 3px solid transparent;
    }

    .nav a.active {
      border-bottom-color: #7892ff;
    }

    .logout {
      display: none;
    }

    .content {
      padding: 22px 16px 34px;
    }

    .page-header {
      display: block;
    }

    .header-actions {
      justify-content: flex-start;
      margin-top: 14px;
    }

    .hide-mobile {
      display: none;
    }

    .action-cell {
      width: auto;
      min-width: 120px;
    }

    th,
    td {
      padding: 12px 11px;
    }

    .login-page {
      display: block;
      min-height: 100vh;
    }

    .login-brand {
      padding: 38px 24px;
    }

    .login-brand h1 {
      font-size: 40px;
    }

    .login-brand p {
      font-size: 15px;
    }
  }

  @media (max-width: 580px) {
    .cards,
    .profile-grid {
      grid-template-columns: 1fr;
    }

    .profile-item,
    .profile-item:nth-child(2n),
    .profile-item:nth-child(3n) {
      border-right: 0;
      border-bottom: 1px solid var(--border);
    }

    .profile-item:last-child {
      border-bottom: 0;
    }

    .toolbar {
      align-items: stretch;
    }

    .toolbar-group {
      width: 100%;
    }

    .toolbar-group .button {
      flex: 1;
    }
  }
`;

/* ─────────────────────────────────────────────
   PAGE SHELL
   ───────────────────────────────────────────── */

function renderSidebar(csrfToken: string): string {
  return `
    <aside class="sidebar">
      <div class="brand">
        <strong>DRIVE <span>LEGAL</span></strong>
        <small>OPERATOR PORTAL</small>
      </div>

      <nav class="nav" aria-label="Operator navigation">
        <a class="active" href="/operator/dashboard">
          <span class="nav-icon">🚚</span>
          <span>Dashboard</span>
        </a>
      </nav>

      <form class="logout" method="POST" action="/operator/logout">
        <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
        <button type="submit">Sign Out</button>
      </form>
    </aside>
  `;
}

function renderPage(options: {
  title: string;
  subtitle: string;
  csrfToken: string;
  body: string;
  headerActions?: string;
  flash?: string;
}): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>${escapeHtml(options.title)} — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <div class="layout">
          ${renderSidebar(options.csrfToken)}

          <main class="content">
            <div class="page-shell">
              <header class="page-header">
                <div>
                  <h1>${escapeHtml(options.title)}</h1>
                  <p class="subtitle">${escapeHtml(options.subtitle)}</p>
                </div>
                ${options.headerActions ? `<div class="header-actions">${options.headerActions}</div>` : ""}
              </header>

              ${options.flash ?? ""}
              ${options.body}
            </div>
          </main>
        </div>
      </body>
    </html>
  `;
}

function renderSimplePage(
  title: string,
  message: string,
  backHref: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(title)} — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="error-page">
          <section class="error-box">
            <h1>${escapeHtml(title)}</h1>
            <p>${escapeHtml(message)}</p>
            <a class="button button-secondary" href="${escapeHtml(backHref)}">Go back</a>
          </section>
        </main>
      </body>
    </html>
  `;
}

function renderLoginPage(
  showError: boolean,
  flashMessage?: string,
  flashTone: FlashTone = "success"
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="login-page">
          <section class="login-brand">
            <h1>DRIVE <span>LEGAL</span></h1>
            <p>
              Secure operator access to your linked drivers, trial status
              and shift records.
            </p>
          </section>

          <section class="login-side">
            <div class="login-card">
              <h2>Operator sign in</h2>
              <p>Enter your email and password to continue.</p>

              ${showError ? `<div class="login-error">Incorrect email or password.</div>` : ""}
              ${flashMessage ? `<div class="login-banner login-banner-${flashTone}">${escapeHtml(flashMessage)}</div>` : ""}

              <form method="POST" action="/operator/login">
                <div class="field-group">
                  <label class="field-label" for="email">Email</label>
                  <input
                    class="field-input"
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="username"
                    required
                    autofocus
                  />
                </div>

                <div class="field-group">
                  <label class="field-label" for="password">Password</label>
                  <input
                    class="field-input"
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    required
                  />
                  <div class="login-field-footer">
                    <a href="/operator/forgot-password">Forgot password?</a>
                  </div>
                </div>

                <button class="login-submit" type="submit">Sign in securely</button>
              </form>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

function renderForgotPasswordPage(errorMessage?: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Reset your password — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="login-page">
          <section class="login-brand">
            <h1>DRIVE <span>LEGAL</span></h1>
            <p>
              Secure operator access to your linked drivers, trial status
              and shift records.
            </p>
          </section>

          <section class="login-side">
            <div class="login-card">
              <h2>Reset your password</h2>
              <p>Enter your account email and we'll send you a reset link.</p>

              ${errorMessage ? `<div class="login-error">${escapeHtml(errorMessage)}</div>` : ""}

              <form method="POST" action="/operator/forgot-password">
                <div class="field-group">
                  <label class="field-label" for="email">Email</label>
                  <input
                    class="field-input"
                    id="email"
                    name="email"
                    type="email"
                    autocomplete="username"
                    required
                    autofocus
                  />
                </div>

                <button class="login-submit" type="submit">Send reset link</button>
              </form>

              <p class="login-note"><a href="/operator/login">Back to sign in</a></p>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

function renderForgotPasswordSentPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Check your email — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="login-page">
          <section class="login-brand">
            <h1>DRIVE <span>LEGAL</span></h1>
            <p>
              Secure operator access to your linked drivers, trial status
              and shift records.
            </p>
          </section>

          <section class="login-side">
            <div class="login-card">
              <h2>Check your email</h2>
              <p>
                If an account exists for that email address, we've sent a
                link to reset the password. The link expires in
                ${PASSWORD_RESET_EXPIRY_MINUTES} minutes.
              </p>

              <p class="login-note"><a href="/operator/login">Back to sign in</a></p>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

function renderResetPasswordPage(
  token: string,
  errorMessage?: string
): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Set a new password — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="login-page">
          <section class="login-brand">
            <h1>DRIVE <span>LEGAL</span></h1>
            <p>
              Secure operator access to your linked drivers, trial status
              and shift records.
            </p>
          </section>

          <section class="login-side">
            <div class="login-card">
              <h2>Set a new password</h2>
              <p>Choose a new password for your operator account.</p>

              ${errorMessage ? `<div class="login-error">${escapeHtml(errorMessage)}</div>` : ""}

              <form method="POST" action="/operator/reset-password">
                <input type="hidden" name="token" value="${escapeHtml(token)}" />

                <div class="field-group">
                  <label class="field-label" for="password">New password</label>
                  <input
                    class="field-input"
                    id="password"
                    name="password"
                    type="password"
                    autocomplete="new-password"
                    minlength="8"
                    required
                    autofocus
                  />
                </div>

                <div class="field-group">
                  <label class="field-label" for="confirmPassword">Confirm new password</label>
                  <input
                    class="field-input"
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autocomplete="new-password"
                    minlength="8"
                    required
                  />
                </div>

                <button class="login-submit" type="submit">Set new password</button>
              </form>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

function renderResetInvalidPage(): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>Link expired — Drive Legal Operator Portal</title>
        <style>${operatorStyles}</style>
      </head>
      <body>
        <main class="login-page">
          <section class="login-brand">
            <h1>DRIVE <span>LEGAL</span></h1>
            <p>
              Secure operator access to your linked drivers, trial status
              and shift records.
            </p>
          </section>

          <section class="login-side">
            <div class="login-card">
              <h2>This link has expired</h2>
              <p>
                Password reset links are only valid for
                ${PASSWORD_RESET_EXPIRY_MINUTES} minutes. Request a new one
                below.
              </p>

              <p class="login-note">
                <a href="/operator/forgot-password">Request a new reset link</a>
              </p>
            </div>
          </section>
        </main>
      </body>
    </html>
  `;
}

/* ─────────────────────────────────────────────
   ROUTES
   ───────────────────────────────────────────── */

export function registerOperatorUi(app: Express) {
  /* ROOT — only redirect on the operators.* hostname; otherwise let any
     other handler registered in index.ts handle "/" as normal. */

  app.get("/", (req: Request, res: Response, next: NextFunction) => {
    const host = (req.hostname || "").toLowerCase();

    if (host.startsWith("operators")) {
      return res.redirect("/operator/login");
    }

    return next();
  });

  app.get("/operator", (_req: Request, res: Response) => {
    return res.redirect("/operator/login");
  });

  /* LOGIN */

  app.get("/operator/login", (req: Request, res: Response) => {
    if (hasOperatorSession(req)) {
      return res.redirect("/operator/dashboard");
    }

    const showError = req.query.error === "1";
    const flashMessage = queryMessage(req);
    const flashTone = queryTone(req);

    return res.status(200).send(
      renderLoginPage(showError, flashMessage || undefined, flashTone)
    );
  });

  app.post("/operator/login", async (req: Request, res: Response) => {
    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";
    const password =
      typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password) {
      return res.redirect("/operator/login?error=1");
    }

    try {
      const rows = await query<OperatorAccountRow>(
        `
          SELECT id, email, passwordHash, companyName, contactName
          FROM operators
          WHERE email = ?
          LIMIT 1
        `,
        [email]
      );

      const operator = rows[0];

      if (!operator || !verifyPassword(password, operator.passwordHash)) {
        return res.redirect("/operator/login?error=1");
      }

      const cookieValue = createSessionCookieValue(operator.id);

      res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`
      );

      return res.redirect("/operator/dashboard");
    } catch (error) {
      console.error("[OPERATOR LOGIN ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Sign in unavailable",
          "We could not process your sign-in request. Please try again shortly.",
          "/operator/login"
        )
      );
    }
  });

  /* FORGOT PASSWORD */

  app.get("/operator/forgot-password", (req: Request, res: Response) => {
    if (hasOperatorSession(req)) {
      return res.redirect("/operator/dashboard");
    }

    return res.status(200).send(renderForgotPasswordPage());
  });

  app.post(
    "/operator/forgot-password",
    async (req: Request, res: Response) => {
      const email =
        typeof req.body?.email === "string"
          ? req.body.email.trim().toLowerCase()
          : "";

      if (!email) {
        return res.status(200).send(
          renderForgotPasswordPage("Please enter your email address.")
        );
      }

      // Always show the same confirmation regardless of whether the
      // email matches an account, so this endpoint can't be used to
      // discover which emails have operator accounts.
      try {
        const rows = await query<{ id: number; companyName: string }>(
          `SELECT id, companyName FROM operators WHERE email = ? LIMIT 1`,
          [email]
        );

        const operator = rows[0];

        if (operator) {
          const { rawToken, tokenHash, expiresAt } =
            generatePasswordResetToken();

          await query(
            `
              UPDATE operators
              SET passwordResetTokenHash = ?,
                  passwordResetExpiresAt = ?
              WHERE id = ?
            `,
            [tokenHash, expiresAt, operator.id]
          );

          const resetLink = `${req.protocol}://${req.get("host")}/operator/reset-password?token=${rawToken}`;

          await sendBrevoEmail({
            to: email,
            subject: "Reset your Drive Legal operator password",
            html: `
              <p>Hi ${escapeHtml(operator.companyName)},</p>
              <p>We received a request to reset the password for your Drive Legal operator account.</p>
              <p><a href="${resetLink}">Click here to set a new password</a></p>
              <p>This link expires in ${PASSWORD_RESET_EXPIRY_MINUTES} minutes. If you didn't request this, you can safely ignore this email.</p>
            `,
          });
        }
      } catch (error) {
        console.error("[OPERATOR FORGOT PASSWORD ERROR]", error);
        // Deliberately fall through to the same confirmation page — a
        // send failure here (e.g. Resend not configured yet) should not
        // reveal anything different to the person requesting the reset.
      }

      return res.status(200).send(renderForgotPasswordSentPage());
    }
  );

  /* RESET PASSWORD */

  app.get("/operator/reset-password", async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : "";

    if (!token) {
      return res.status(400).send(renderResetInvalidPage());
    }

    try {
      const tokenHash = createHash("sha256").update(token).digest("hex");

      const rows = await query<{ id: number }>(
        `
          SELECT id
          FROM operators
          WHERE passwordResetTokenHash = ?
            AND passwordResetExpiresAt > NOW()
          LIMIT 1
        `,
        [tokenHash]
      );

      if (!rows[0]) {
        return res.status(400).send(renderResetInvalidPage());
      }

      return res.status(200).send(renderResetPasswordPage(token));
    } catch (error) {
      console.error("[OPERATOR RESET PASSWORD GET ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Reset unavailable",
          "This reset link could not be verified. Please try again shortly.",
          "/operator/forgot-password"
        )
      );
    }
  });

  app.post(
    "/operator/reset-password",
    async (req: Request, res: Response) => {
      const token =
        typeof req.body?.token === "string" ? req.body.token : "";
      const password =
        typeof req.body?.password === "string" ? req.body.password : "";
      const confirmPassword =
        typeof req.body?.confirmPassword === "string"
          ? req.body.confirmPassword
          : "";

      if (!token) {
        return res.status(400).send(renderResetInvalidPage());
      }

      if (password.length < 8) {
        return res.status(200).send(
          renderResetPasswordPage(
            token,
            "Password must be at least 8 characters."
          )
        );
      }

      if (password !== confirmPassword) {
        return res.status(200).send(
          renderResetPasswordPage(token, "Passwords do not match.")
        );
      }

      try {
        const tokenHash = createHash("sha256").update(token).digest("hex");

        const rows = await query<{ id: number }>(
          `
            SELECT id
            FROM operators
            WHERE passwordResetTokenHash = ?
              AND passwordResetExpiresAt > NOW()
            LIMIT 1
          `,
          [tokenHash]
        );

        const operator = rows[0];

        if (!operator) {
          return res.status(400).send(renderResetInvalidPage());
        }

        const newPasswordHash = createHash("sha256")
          .update(password)
          .digest("hex");

        await query(
          `
            UPDATE operators
            SET passwordHash = ?,
                passwordResetTokenHash = NULL,
                passwordResetExpiresAt = NULL,
                updatedAt = NOW()
            WHERE id = ?
          `,
          [newPasswordHash, operator.id]
        );

        return redirectWithMessage(
          res,
          "/operator/login",
          "Your password has been reset. Please sign in.",
          "success"
        );
      } catch (error) {
        console.error("[OPERATOR RESET PASSWORD POST ERROR]", error);
        return res.status(500).send(
          renderSimplePage(
            "Reset unavailable",
            "Your password could not be reset. Please try again shortly.",
            "/operator/forgot-password"
          )
        );
      }
    }
  );

  /* DASHBOARD */

  app.get("/operator/dashboard", async (req: Request, res: Response) => {
    const operatorId = requireOperator(req, res);

    if (operatorId === null) {
      return;
    }

    try {
      const operatorRows = await query<OperatorProfileRow>(
        `
          SELECT id, email, companyName, contactName
          FROM operators
          WHERE id = ?
          LIMIT 1
        `,
        [operatorId]
      );

      const operator = operatorRows[0];

      if (!operator) {
        return res.status(404).send(
          renderSimplePage(
            "Operator account not found",
            "This operator account no longer exists.",
            "/operator/login"
          )
        );
      }

      const drivers = await query<OperatorDriverRow>(
        `
          SELECT
            d.id,
            d.localUserId,
            d.name,
            d.email,
            d.licenceNumber,
            d.vehicleRegistration,
            d.driverType,
            d.emailVerified,
            d.trialStartDate,
            COUNT(sl.id) AS shiftCount,
            SUM(CASE WHEN sl.endTime IS NULL THEN 1 ELSE 0 END) AS activeShiftCount
          FROM operator_drivers od
          INNER JOIN drivers d
            ON d.localUserId = od.driverLocalUserId
          LEFT JOIN shift_logs sl
            ON sl.driverLocalUserId = d.localUserId
          WHERE od.operatorId = ?
          GROUP BY
            d.id,
            d.localUserId,
            d.name,
            d.email,
            d.licenceNumber,
            d.vehicleRegistration,
            d.driverType,
            d.emailVerified,
            d.trialStartDate
          ORDER BY d.name ASC, d.email ASC
        `,
        [operatorId]
      );

      const linkedDriverCount = drivers.length;
      const totalShifts = drivers.reduce(
        (sum, driver) => sum + Number(driver.shiftCount ?? 0),
        0
      );
      const activeShifts = drivers.reduce(
        (sum, driver) => sum + Number(driver.activeShiftCount ?? 0),
        0
      );

      const driverRows = drivers
        .map((driver) => {
          const trial = getTrialStatus(driver.trialStartDate);
          const driverId = encodeURIComponent(String(driver.id));

          return `
            <tr>
              <td class="driver-cell">
                <div class="driver-summary">
                  <span class="avatar">${escapeHtml(initials(driver.name))}</span>

                  <span>
                    <strong>${escapeHtml(driver.name || "—")}</strong>
                    <span class="muted">${escapeHtml(driver.email || "—")}</span>
                  </span>
                </div>
              </td>

              <td>${escapeHtml(driver.licenceNumber || "—")}</td>

              <td>${escapeHtml(driver.vehicleRegistration || "—")}</td>

              <td class="hide-mobile">${escapeHtml(driver.driverType || "—")}</td>

              <td>${statusBadge(trial)}</td>

              <td>${Number(driver.shiftCount ?? 0)}</td>

              <td class="action-cell">
                <a class="button button-primary button-compact" href="/operator/driver/${driverId}">
                  View Driver
                </a>
              </td>
            </tr>
          `;
        })
        .join("");

      const body = `
        <section class="cards" aria-label="Operator statistics">
          <div class="card">
            <div class="card-label">Company name</div>
            <div class="card-value text-value">${escapeHtml(operator.companyName)}</div>
          </div>

          <div class="card">
            <div class="card-label">Contact name</div>
            <div class="card-value text-value">${escapeHtml(operator.contactName)}</div>
          </div>

          <div class="card">
            <div class="card-label">Linked drivers</div>
            <div class="card-value">${linkedDriverCount}</div>
          </div>

          <div class="card">
            <div class="card-label">Total uploaded shifts</div>
            <div class="card-value">${totalShifts}</div>
          </div>
        </section>

        <section class="cards" aria-label="Shift statistics">
          <div class="card">
            <div class="card-label">Active / open shifts</div>
            <div class="card-value ${activeShifts ? "danger" : ""}">${activeShifts}</div>
            <div class="card-note">Shifts that have started but not yet ended</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              Linked Drivers
              <div class="panel-subtitle">Drivers linked to your company account</div>
            </div>
          </div>

          ${
            driverRows
              ? `
                <div class="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Licence</th>
                        <th>Vehicle rego</th>
                        <th class="hide-mobile">Type</th>
                        <th>Trial status</th>
                        <th>Shifts</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>${driverRows}</tbody>
                  </table>
                </div>
              `
              : `<div class="empty"><strong>No drivers linked yet</strong>Drivers linked to your account by Drive Legal will appear here.</div>`
          }
        </section>
      `;

      return res.status(200).send(
        renderPage({
          title: operator.companyName || "Operator Dashboard",
          subtitle: `Signed in as ${operator.contactName} · ${operator.email}`,
          csrfToken: createCsrfToken(req),
          flash: renderFlash(req),
          body,
        })
      );
    } catch (error) {
      console.error("[OPERATOR DASHBOARD ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Dashboard unavailable",
          "Your dashboard could not be loaded. Please try again shortly.",
          "/operator/login"
        )
      );
    }
  });

  /* DRIVER DETAIL */

  app.get("/operator/driver/:id", async (req: Request, res: Response) => {
    const operatorId = requireOperator(req, res);

    if (operatorId === null) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send(
        renderSimplePage(
          "Invalid driver",
          "The requested driver ID is not valid.",
          "/operator/dashboard"
        )
      );
    }

    try {
      // The join against operator_drivers ensures this driver is actually
      // linked to the signed-in operator — an operator can never view a
      // driver that is not theirs, even by guessing an ID.
      const driverRows = await query<LinkedDriverDetailRow>(
        `
          SELECT
            d.id,
            d.localUserId,
            d.name,
            d.email,
            d.licenceNumber,
            d.vehicleRegistration,
            d.driverType,
            d.emailVerified,
            d.trialStartDate,
            d.createdAt
          FROM operator_drivers od
          INNER JOIN drivers d
            ON d.localUserId = od.driverLocalUserId
          WHERE od.operatorId = ?
            AND d.id = ?
          LIMIT 1
        `,
        [operatorId, driverId]
      );

      const driver = driverRows[0];

      if (!driver) {
        return res.status(404).send(
          renderSimplePage(
            "Driver not found",
            "This driver does not exist or is not linked to your account.",
            "/operator/dashboard"
          )
        );
      }

      const shifts = driver.localUserId
        ? await query<ShiftRecord>(
            `
              SELECT id, logId, startTime, endTime, hash, previousHash, createdAt
              FROM shift_logs
              WHERE driverLocalUserId = ?
              ORDER BY startTime DESC
            `,
            [driver.localUserId]
          )
        : [];

      const completedShifts = shifts.filter((shift) => shift.endTime);
      const activeShifts = shifts.filter((shift) => !shift.endTime);
      const totalMinutes = completedShifts.reduce((sum, shift) => {
        const start = new Date(String(shift.startTime)).getTime();
        const end = new Date(String(shift.endTime)).getTime();

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return sum;
        }

        return sum + Math.round((end - start) / 60000);
      }, 0);

      const trial = getTrialStatus(driver.trialStartDate);

      const shiftRows = shifts
        .map(
          (shift) => `
            <tr>
              <td>${formatDate(shift.startTime)}</td>
              <td>${formatDateTime(shift.startTime)}</td>
              <td>${formatDateTime(shift.endTime)}</td>
              <td>${formatDuration(shift.startTime, shift.endTime)}</td>
              <td class="hide-mobile code">${shift.hash ? `${escapeHtml(String(shift.hash).slice(0, 16))}…` : "—"}</td>
            </tr>
          `
        )
        .join("");

      const body = `
        <section class="panel">
          <div class="panel-header">
            <div>
              Driver Profile
              <div class="panel-subtitle">Licence, vehicle and trial information</div>
            </div>
          </div>

          <div class="profile-grid">
            <div class="profile-item">
              <small>Full name</small>
              <strong>${escapeHtml(driver.name || "—")}</strong>
            </div>

            <div class="profile-item">
              <small>Email</small>
              <strong>${escapeHtml(driver.email || "—")}</strong>
            </div>

            <div class="profile-item">
              <small>Licence number</small>
              <strong>${escapeHtml(driver.licenceNumber || "—")}</strong>
            </div>

            <div class="profile-item">
              <small>Vehicle rego</small>
              <strong>${escapeHtml(driver.vehicleRegistration || "—")}</strong>
            </div>

            <div class="profile-item">
              <small>Driver type</small>
              <strong>${escapeHtml(driver.driverType || "—")}</strong>
            </div>

            <div class="profile-item">
              <small>Registered</small>
              <strong>${formatDate(driver.createdAt)}</strong>
            </div>

            <div class="profile-item">
              <small>Trial status</small>
              <strong>${statusBadge(trial)}</strong>
            </div>

            <div class="profile-item">
              <small>Trial expiry</small>
              <strong>${trial.expiryDate ? formatDate(trial.expiryDate) : "—"}</strong>
            </div>

            <div class="profile-item">
              <small>Email status</small>
              <strong>${emailStatusBadge(driver.emailVerified)}</strong>
            </div>
          </div>
        </section>

        <div class="toolbar">
          <div class="toolbar-group">
            <a class="button button-secondary" href="/operator/dashboard">← Back to Dashboard</a>
          </div>
        </div>

        <section class="cards" aria-label="Driver statistics">
          <div class="card">
            <div class="card-label">Total shifts</div>
            <div class="card-value">${shifts.length}</div>
          </div>

          <div class="card">
            <div class="card-label">Completed shifts</div>
            <div class="card-value success">${completedShifts.length}</div>
          </div>

          <div class="card">
            <div class="card-label">Open shifts</div>
            <div class="card-value ${activeShifts.length ? "danger" : ""}">${activeShifts.length}</div>
          </div>

          <div class="card">
            <div class="card-label">Recorded shift time</div>
            <div class="card-value text-value">${formatHoursFromMinutes(totalMinutes)}</div>
            <div class="card-note">Elapsed time between shift start and end</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              Shift History
              <div class="panel-subtitle">Most recent records first</div>
            </div>
          </div>

          ${
            shiftRows
              ? `
                <div class="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Start</th>
                        <th>End</th>
                        <th>Duration</th>
                        <th class="hide-mobile">Hash</th>
                      </tr>
                    </thead>
                    <tbody>${shiftRows}</tbody>
                  </table>
                </div>
              `
              : `<div class="empty"><strong>No shifts logged</strong>This driver has not uploaded any shift records.</div>`
          }
        </section>
      `;

      return res.status(200).send(
        renderPage({
          title: driver.name || "Driver Profile",
          subtitle: `${driver.email || "No email"} · Licence: ${driver.licenceNumber || "—"}`,
          csrfToken: createCsrfToken(req),
          flash: renderFlash(req),
          body,
        })
      );
    } catch (error) {
      console.error("[OPERATOR DRIVER PROFILE ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Driver profile unavailable",
          "The driver or shift information could not be loaded.",
          "/operator/dashboard"
        )
      );
    }
  });

  /* LOGOUT */

  app.post("/operator/logout", (req: Request, res: Response) => {
    if (hasOperatorSession(req) && rejectInvalidCsrf(req, res)) {
      return;
    }

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );

    return res.redirect("/operator/login");
  });
}
