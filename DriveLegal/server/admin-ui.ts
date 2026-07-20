import { Express, Request, Response } from "express";
import {
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "crypto";
import { query } from "./db";

const COOKIE_NAME = "drivelegal_admin_session";
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;
const TRIAL_DAYS = 21;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type DriverRecord = {
  id: number;
  localUserId: string | null;
  name: string | null;
  email: string | null;
  licenceNumber: string | null;
  vehicleRegistration: string | null;
  driverType: string | null;
  emailVerified: number | boolean | null;
  trialStartDate: string | Date | null;
  createdAt: string | Date | null;
  shiftCount?: number | string | null;
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
  shortLabel: string;
  daysLeft: number | null;
  expired: boolean;
  started: boolean;
  expiryDate: Date | null;
  className: "trial" | "expired" | "neutral";
};

type FlashTone = "success" | "warning" | "error" | "info";

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

function getAdminKey(): string {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    throw new Error("ADMIN_KEY is not configured");
  }

  return adminKey;
}

function sign(value: string, purpose: string): string {
  return createHmac("sha256", getAdminKey())
    .update(`${purpose}:${value}`)
    .digest("base64url");
}

function createSessionCookieValue(): string {
  const payload = JSON.stringify({
    issuedAt: Date.now(),
    nonce: randomBytes(18).toString("base64url"),
  });

  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded, "admin-session")}`;
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

function getValidSessionValue(req: Request): string | null {
  const supplied = parseCookies(req)[COOKIE_NAME];

  if (!supplied) {
    return null;
  }

  const [encoded, signature, extra] = supplied.split(".");

  if (!encoded || !signature || extra) {
    return null;
  }

  if (!safeEqual(signature, sign(encoded, "admin-session"))) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    ) as { issuedAt?: unknown; nonce?: unknown };

    if (
      typeof payload.issuedAt !== "number" ||
      typeof payload.nonce !== "string"
    ) {
      return null;
    }

    const age = Date.now() - payload.issuedAt;

    if (
      age < 0 ||
      age > SESSION_MAX_AGE_SECONDS * 1000
    ) {
      return null;
    }

    return supplied;
  } catch {
    return null;
  }
}

function hasAdminSession(req: Request): boolean {
  return getValidSessionValue(req) !== null;
}

function createCsrfToken(req: Request): string {
  const session = getValidSessionValue(req);

  if (!session) {
    return "";
  }

  return sign(session, "admin-csrf");
}

function hasValidCsrf(req: Request): boolean {
  const supplied =
    typeof req.body?.csrfToken === "string"
      ? req.body.csrfToken
      : "";

  const expected = createCsrfToken(req);

  return Boolean(
    supplied && expected && safeEqual(supplied, expected)
  );
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!hasAdminSession(req)) {
    res.redirect("/admin/login");
    return false;
  }

  return true;
}

function rejectInvalidCsrf(req: Request, res: Response): boolean {
  if (!hasValidCsrf(req)) {
    res.status(403).send(
      renderSimplePage(
        "Request blocked",
        "The security token was missing or expired. Return to the dashboard and try again.",
        "/admin/dashboard"
      )
    );
    return true;
  }

  return false;
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

function formatDuration(
  startValue: unknown,
  endValue: unknown
): string {
  if (!startValue || !endValue) {
    return "In progress";
  }

  const start = new Date(String(startValue)).getTime();
  const end = new Date(String(endValue)).getTime();

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start
  ) {
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
      shortLabel: "Not started",
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
      shortLabel: "Not started",
      daysLeft: null,
      expired: false,
      started: false,
      expiryDate: null,
      className: "neutral",
    };
  }

  const expiryDate = new Date(
    trialStart.getTime() + TRIAL_DAYS * ONE_DAY_MS
  );
  const millisecondsRemaining = expiryDate.getTime() - Date.now();
  const expired = millisecondsRemaining <= 0;
  const daysLeft = expired
    ? 0
    : Math.ceil(millisecondsRemaining / ONE_DAY_MS);

  return {
    label: expired
      ? "Trial expired"
      : `Trial · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left`,
    shortLabel: expired
      ? "Expired"
      : `${daysLeft}d left`,
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
  return typeof req.query.message === "string"
    ? req.query.message
    : "";
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

/* ─────────────────────────────────────────────
   DESIGN SYSTEM
   ───────────────────────────────────────────── */

const adminStyles = `
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
    width: 224px;
    min-width: 224px;
    text-align: right;
    white-space: nowrap;
  }

  .actions-inline {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
  }

  .inline-form {
    display: inline;
    margin: 0;
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

  .button-success {
    background: #218b50;
    border-color: #51b77a;
  }

  .button-success:hover {
    background: #279b5b;
  }

  .button-danger {
    background: var(--danger);
    border-color: #ff7980;
  }

  .button-danger:hover {
    background: var(--danger-hover);
  }

  .button-ghost {
    background: transparent;
    border-color: var(--border);
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

  .danger-zone {
    display: flex;
    justify-content: flex-end;
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

  .summary-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
    padding: 15px 20px;
    border-bottom: 1px solid var(--border);
  }

  .summary-row:nth-child(odd) {
    border-right: 1px solid var(--border);
  }

  .summary-row:nth-last-child(-n + 2) {
    border-bottom: 0;
  }

  .summary-row span {
    color: var(--muted);
  }

  .summary-row strong {
    text-align: right;
  }

  .code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
    color: #c8d4e6;
  }

  .page-note {
    margin-top: 12px;
    color: var(--muted-2);
    font-size: 12px;
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
    margin-top: 17px;
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

    .hide-tablet {
      display: none;
    }

    .action-cell {
      width: 200px;
      min-width: 200px;
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
      min-width: 164px;
    }

    th,
    td {
      padding: 12px 11px;
    }

    .summary-list {
      grid-template-columns: 1fr;
    }

    .summary-row:nth-child(odd) {
      border-right: 0;
    }

    .summary-row:nth-last-child(-n + 2) {
      border-bottom: 1px solid var(--border);
    }

    .summary-row:last-child {
      border-bottom: 0;
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

    .toolbar-group,
    .danger-zone {
      width: 100%;
    }

    .toolbar-group .button,
    .danger-zone .button {
      flex: 1;
    }

    .actions-inline {
      align-items: stretch;
      flex-direction: column;
    }

    .actions-inline .button,
    .actions-inline form,
    .actions-inline form .button {
      width: 100%;
    }
  }
`;

function renderSidebar(
  activePage: "users" | "subscriptions" | "operators" | "compliance" | "support",
  csrfToken: string
): string {
  const active = (page: string) =>
    activePage === page ? "active" : "";

  return `
    <aside class="sidebar">
      <div class="brand">
        <strong>DRIVE <span>LEGAL</span></strong>
        <small>ADMIN DASHBOARD</small>
      </div>

      <nav class="nav" aria-label="Admin navigation">
        <a class="${active("users")}" href="/admin/dashboard">
          <span class="nav-icon">👥</span>
          <span>Users</span>
        </a>

        <a class="${active("subscriptions")}" href="/admin/subscriptions">
          <span class="nav-icon">💳</span>
          <span>Subscriptions</span>
        </a>

        <a class="${active("operators")}" href="/admin/operators">
          <span class="nav-icon">🏢</span>
          <span>Operators</span>
        </a>

        <a class="${active("compliance")}" href="/admin/compliance">
          <span class="nav-icon">🛡️</span>
          <span>Compliance</span>
        </a>

        <a class="${active("support")}" href="/admin/support">
          <span class="nav-icon">🔧</span>
          <span>Support</span>
        </a>
      </nav>

      <form class="logout" method="POST" action="/admin/logout">
        <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
        <button type="submit">Sign Out</button>
      </form>
    </aside>
  `;
}

function renderPage(options: {
  title: string;
  subtitle: string;
  activePage: "users" | "subscriptions" | "operators" | "compliance" | "support";
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
        <title>${escapeHtml(options.title)} — Drive Legal Admin</title>
        <style>${adminStyles}</style>
      </head>
      <body>
        <div class="layout">
          ${renderSidebar(options.activePage, options.csrfToken)}

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
        <title>${escapeHtml(title)} — Drive Legal Admin</title>
        <style>${adminStyles}</style>
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

function statusBadge(trial: TrialStatus): string {
  return `<span class="status ${trial.className}">${escapeHtml(trial.label)}</span>`;
}

function emailStatusBadge(value: unknown): string {
  return booleanValue(value)
    ? `<span class="status verified">Verified</span>`
    : `<span class="status unverified">Unverified</span>`;
}

/* ─────────────────────────────────────────────
   ROUTES
   ───────────────────────────────────────────── */

export function registerAdminUi(app: Express) {
  app.get("/admin", (_req: Request, res: Response) => {
    return res.redirect("/admin/login");
  });

  /* LOGIN */

  app.get("/admin/login", (req: Request, res: Response) => {
    if (hasAdminSession(req)) {
      return res.redirect("/admin/dashboard");
    }

    const showError = req.query.error === "1";

    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta name="robots" content="noindex,nofollow" />
          <title>Drive Legal Admin</title>
          <style>${adminStyles}</style>
        </head>
        <body>
          <main class="login-page">
            <section class="login-brand">
              <h1>DRIVE <span>LEGAL</span></h1>
              <p>
                Secure administration for driver accounts, trial access,
                shift records and compliance oversight.
              </p>
            </section>

            <section class="login-side">
              <div class="login-card">
                <h2>Administrator sign in</h2>
                <p>Enter the secure administrator key to continue.</p>

                ${showError ? `<div class="login-error">The administrator key was not accepted.</div>` : ""}

                <form method="POST" action="/admin/login">
                  <label class="field-label" for="adminKey">Administrator key</label>
                  <input
                    class="field-input"
                    id="adminKey"
                    name="adminKey"
                    type="password"
                    autocomplete="current-password"
                    required
                    autofocus
                  />
                  <button class="login-submit" type="submit">Sign in securely</button>
                </form>
              </div>
            </section>
          </main>
        </body>
      </html>
    `);
  });

  app.post("/admin/login", (req: Request, res: Response) => {
    const configuredKey = process.env.ADMIN_KEY;
    const submittedKey =
      typeof req.body?.adminKey === "string"
        ? req.body.adminKey
        : "";

    if (
      !configuredKey ||
      !submittedKey ||
      !safeEqual(submittedKey, configuredKey)
    ) {
      return res.redirect("/admin/login?error=1");
    }

    const cookieValue = createSessionCookieValue();

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(cookieValue)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_MAX_AGE_SECONDS}`
    );

    return res.redirect("/admin/dashboard");
  });

  /* USERS DASHBOARD */

  app.get("/admin/dashboard", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    try {
      const drivers = await query<DriverRecord>(`
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
          d.createdAt,
          COUNT(sl.id) AS shiftCount
        FROM drivers d
        LEFT JOIN shift_logs sl
          ON sl.driverLocalUserId = d.localUserId
        GROUP BY
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
        ORDER BY d.createdAt DESC
      `);

      const shiftCountRows = await query<{ count: number | string }>(`
        SELECT COUNT(*) AS count
        FROM shift_logs
      `);

      const totalDrivers = drivers.length;
      const activeTrials = drivers.filter((driver) => {
        const trial = getTrialStatus(driver.trialStartDate);
        return trial.started && !trial.expired;
      }).length;
      const expiredTrials = drivers.filter((driver) =>
        getTrialStatus(driver.trialStartDate).expired
      ).length;
      const totalShifts = Number(shiftCountRows[0]?.count ?? 0);
      const csrfToken = createCsrfToken(req);

      const driverRows = drivers
        .map((driver) => {
          const trial = getTrialStatus(driver.trialStartDate);
          const id = encodeURIComponent(String(driver.id));

          return `
            <tr>
              <td class="driver-cell">
                <div class="driver-summary">
                  <span class="avatar">${escapeHtml(initials(driver.name))}</span>
                  <span>
                    <strong>${escapeHtml(driver.name || "Unnamed driver")}</strong>
                    <span class="muted">${escapeHtml(driver.email || "No email")}</span>
                  </span>
                </div>
              </td>

              <td>${escapeHtml(driver.licenceNumber || "—")}</td>

              <td>${statusBadge(trial)}</td>

              <td class="hide-mobile">${escapeHtml(driver.driverType || "—")}</td>

              <td>${Number(driver.shiftCount ?? 0)}</td>

              <td class="hide-tablet">${formatDate(driver.createdAt)}</td>

              <td class="action-cell">
                <div class="actions-inline">
                  <a class="button button-primary button-compact" href="/admin/driver/${id}">View</a>

                  <form class="inline-form" method="POST" action="/admin/driver/${id}/reset-password">
                    <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
                    <button class="button button-secondary button-compact" type="submit">Reset PW</button>
                  </form>

                  <form
                    class="inline-form"
                    method="POST"
                    action="/admin/driver/${id}/delete"
                    onsubmit="return confirm('Permanently delete this driver and all linked shift records? This cannot be undone.');"
                  >
                    <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
                    <button class="button button-danger button-compact" type="submit">Delete</button>
                  </form>
                </div>
              </td>
            </tr>
          `;
        })
        .join("");

      const body = `
        <section class="cards" aria-label="User statistics">
          <div class="card">
            <div class="card-label">Total drivers</div>
            <div class="card-value">${totalDrivers}</div>
          </div>

          <div class="card">
            <div class="card-label">Active trials</div>
            <div class="card-value success">${activeTrials}</div>
          </div>

          <div class="card">
            <div class="card-label">Expired trials</div>
            <div class="card-value danger">${expiredTrials}</div>
          </div>

          <div class="card">
            <div class="card-label">Total shifts logged</div>
            <div class="card-value">${totalShifts}</div>
          </div>
        </section>

        <section class="panel">
          <div class="panel-header">
            <div>
              All Drivers
              <div class="panel-subtitle">Registered accounts and current access status</div>
            </div>
          </div>

          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Driver</th>
                  <th>Licence</th>
                  <th>Status</th>
                  <th class="hide-mobile">Type</th>
                  <th>Shifts</th>
                  <th class="hide-tablet">Registered</th>
                  <th class="action-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${driverRows || `<tr><td colspan="7"><div class="empty"><strong>No drivers registered</strong>New driver accounts will appear here.</div></td></tr>`}
              </tbody>
            </table>
          </div>
        </section>
      `;

      return res.status(200).send(
        renderPage({
          title: "User Management",
          subtitle: "Manage all registered Drive Legal drivers",
          activePage: "users",
          csrfToken,
          flash: renderFlash(req),
          body,
        })
      );
    } catch (error) {
      console.error("[ADMIN DASHBOARD ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Dashboard unavailable",
          "The dashboard could not load the Railway database.",
          "/admin/dashboard"
        )
      );
    }
  });

  /* DRIVER PROFILE */

  app.get("/admin/driver/:id", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send(
        renderSimplePage(
          "Invalid driver",
          "The requested driver ID is not valid.",
          "/admin/dashboard"
        )
      );
    }

    try {
      const driverRows = await query<DriverRecord>(
        `
          SELECT
            id,
            localUserId,
            name,
            email,
            licenceNumber,
            vehicleRegistration,
            driverType,
            emailVerified,
            trialStartDate,
            createdAt
          FROM drivers
          WHERE id = ?
          LIMIT 1
        `,
        [driverId]
      );

      const driver = driverRows[0];

      if (!driver) {
        return res.status(404).send(
          renderSimplePage(
            "Driver not found",
            "This driver account no longer exists.",
            "/admin/dashboard"
          )
        );
      }

      const shifts = driver.localUserId
        ? await query<ShiftRecord>(
            `
              SELECT
                id,
                logId,
                startTime,
                endTime,
                hash,
                previousHash,
                createdAt
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

        if (
          !Number.isFinite(start) ||
          !Number.isFinite(end) ||
          end < start
        ) {
          return sum;
        }

        return sum + Math.round((end - start) / 60000);
      }, 0);

      const trial = getTrialStatus(driver.trialStartDate);
      const csrfToken = createCsrfToken(req);
      const id = encodeURIComponent(String(driver.id));

      const shiftRows = shifts
        .map((shift) => `
          <tr>
            <td>${formatDate(shift.startTime)}</td>
            <td>${formatDateTime(shift.startTime)}</td>
            <td>${formatDateTime(shift.endTime)}</td>
            <td>${formatDuration(shift.startTime, shift.endTime)}</td>
            <td class="hide-mobile code">${shift.hash ? `${escapeHtml(String(shift.hash).slice(0, 16))}…` : "—"}</td>
          </tr>
        `)
        .join("");

      const body = `
        <section class="panel">
          <div class="panel-header">
            <div>
              Driver Profile
              <div class="panel-subtitle">Account, licence and trial information</div>
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
              <small>Subscription</small>
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
            <a class="button button-secondary" href="/admin/dashboard">← Back to Users</a>

            <form method="POST" action="/admin/driver/${id}/extend-trial">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
              <button class="button button-primary" type="submit">Extend trial</button>
            </form>

            ${
              booleanValue(driver.emailVerified)
                ? ""
                : `
                  <form method="POST" action="/admin/driver/${id}/verify-email">
                    <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
                    <button class="button button-success" type="submit">Verify email</button>
                  </form>
                `
            }

            <form method="POST" action="/admin/driver/${id}/reset-password">
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
              <button class="button button-secondary" type="submit">Reset password</button>
            </form>

            <a class="button button-secondary" href="/admin/driver/${id}/export.csv">Export CSV</a>
          </div>

          <div class="danger-zone">
            <form
              method="POST"
              action="/admin/driver/${id}/delete"
              onsubmit="return confirm('Permanently delete this driver and every linked shift record? This cannot be undone.');"
            >
              <input type="hidden" name="csrfToken" value="${escapeHtml(csrfToken)}" />
              <button class="button button-danger" type="submit">Delete account</button>
            </form>
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
            <a class="button button-primary button-compact" href="/admin/driver/${id}/export.csv">Export CSV</a>
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
          activePage: "users",
          csrfToken,
          flash: renderFlash(req),
          body,
        })
      );
    } catch (error) {
      console.error("[ADMIN DRIVER PROFILE ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Driver profile unavailable",
          "The driver or shift information could not be loaded.",
          "/admin/dashboard"
        )
      );
    }
  });

  /* SUBSCRIPTIONS */

  app.get("/admin/subscriptions", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    try {
      const drivers = await query<DriverRecord>(`
        SELECT id, name, email, trialStartDate, createdAt
        FROM drivers
        ORDER BY createdAt DESC
      `);

      const active = drivers.filter((driver) => {
        const trial = getTrialStatus(driver.trialStartDate);
        return trial.started && !trial.expired;
      });
      const expired = drivers.filter((driver) =>
        getTrialStatus(driver.trialStartDate).expired
      );
      const notStarted = drivers.filter(
        (driver) => !getTrialStatus(driver.trialStartDate).started
      );
      const csrfToken = createCsrfToken(req);

      const rows = drivers
        .map((driver) => {
          const trial = getTrialStatus(driver.trialStartDate);
          return `
            <tr>
              <td class="driver-cell">
                <strong>${escapeHtml(driver.name || "Unnamed driver")}</strong>
                <span class="muted">${escapeHtml(driver.email || "No email")}</span>
              </td>
              <td>${statusBadge(trial)}</td>
              <td>${trial.expiryDate ? formatDate(trial.expiryDate) : "—"}</td>
              <td>${formatDate(driver.createdAt)}</td>
              <td class="action-cell"><a class="button button-primary button-compact" href="/admin/driver/${encodeURIComponent(String(driver.id))}">Manage</a></td>
            </tr>
          `;
        })
        .join("");

      return res.status(200).send(
        renderPage({
          title: "Subscriptions",
          subtitle: "Trial access and subscription readiness",
          activePage: "subscriptions",
          csrfToken,
          flash: renderFlash(req),
          body: `
            <section class="cards">
              <div class="card"><div class="card-label">All accounts</div><div class="card-value">${drivers.length}</div></div>
              <div class="card"><div class="card-label">Active trials</div><div class="card-value success">${active.length}</div></div>
              <div class="card"><div class="card-label">Expired trials</div><div class="card-value danger">${expired.length}</div></div>
              <div class="card"><div class="card-label">Not started</div><div class="card-value">${notStarted.length}</div></div>
            </section>

            <section class="panel">
              <div class="panel-header">
                <div>Trial Accounts<div class="panel-subtitle">Live trial status calculated from each driver's trial start date</div></div>
              </div>
              <div class="table-scroll">
                <table>
                  <thead><tr><th>Driver</th><th>Status</th><th>Expiry</th><th>Registered</th><th class="action-cell">Action</th></tr></thead>
                  <tbody>${rows || `<tr><td colspan="5"><div class="empty"><strong>No accounts found</strong>Subscription records will appear here.</div></td></tr>`}</tbody>
                </table>
              </div>
            </section>
          `,
        })
      );
    } catch (error) {
      console.error("[ADMIN SUBSCRIPTIONS ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Subscriptions unavailable",
          "Subscription information could not be loaded.",
          "/admin/dashboard"
        )
      );
    }
  });

  /* OPERATORS */

  app.get("/admin/operators", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    try {
      const linkRows = await query<{ count: number | string }>(`
        SELECT COUNT(*) AS count
        FROM operator_drivers
      `);
      const driverRows = await query<{ count: number | string }>(`
        SELECT COUNT(*) AS count
        FROM drivers
      `);
      const csrfToken = createCsrfToken(req);

      return res.status(200).send(
        renderPage({
          title: "Operators",
          subtitle: "Operator and driver relationship overview",
          activePage: "operators",
          csrfToken,
          body: `
            <section class="cards">
              <div class="card"><div class="card-label">Operator-driver links</div><div class="card-value">${Number(linkRows[0]?.count ?? 0)}</div></div>
              <div class="card"><div class="card-label">Registered drivers</div><div class="card-value">${Number(driverRows[0]?.count ?? 0)}</div></div>
              <div class="card"><div class="card-label">Management status</div><div class="card-value text-value success">Connected</div></div>
              <div class="card"><div class="card-label">Data source</div><div class="card-value text-value">Railway</div></div>
            </section>

            <section class="panel">
              <div class="panel-header">Operator Management</div>
              <div class="summary-list">
                <div class="summary-row"><span>Relationship table</span><strong class="code">operator_drivers</strong></div>
                <div class="summary-row"><span>Linked records</span><strong>${Number(linkRows[0]?.count ?? 0)}</strong></div>
                <div class="summary-row"><span>Driver accounts</span><strong>${Number(driverRows[0]?.count ?? 0)}</strong></div>
                <div class="summary-row"><span>Portal status</span><strong>Operational</strong></div>
              </div>
            </section>

            <p class="page-note">This page deliberately avoids assuming operator table columns that are not present in the existing admin code. Add operator names and account controls once the operator schema is confirmed.</p>
          `,
        })
      );
    } catch (error) {
      console.error("[ADMIN OPERATORS ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Operators unavailable",
          "Operator relationship information could not be loaded.",
          "/admin/dashboard"
        )
      );
    }
  });

  /* COMPLIANCE */

  app.get("/admin/compliance", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    try {
      const totals = await query<{
        total: number | string;
        completed: number | string;
        openShifts: number | string;
        missingHash: number | string;
      }>(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN endTime IS NOT NULL THEN 1 ELSE 0 END) AS completed,
          SUM(CASE WHEN endTime IS NULL THEN 1 ELSE 0 END) AS openShifts,
          SUM(CASE WHEN hash IS NULL OR hash = '' THEN 1 ELSE 0 END) AS missingHash
        FROM shift_logs
      `);

      const recent = await query<ShiftRecord>(`
        SELECT id, logId, startTime, endTime, hash, previousHash, createdAt
        FROM shift_logs
        ORDER BY createdAt DESC
        LIMIT 25
      `);

      const summary = totals[0] ?? {
        total: 0,
        completed: 0,
        openShifts: 0,
        missingHash: 0,
      };
      const csrfToken = createCsrfToken(req);

      const rows = recent
        .map((shift) => `
          <tr>
            <td class="code">${escapeHtml(shift.logId || String(shift.id))}</td>
            <td>${formatDateTime(shift.startTime)}</td>
            <td>${formatDateTime(shift.endTime)}</td>
            <td>${shift.hash ? `<span class="status verified">Present</span>` : `<span class="status unverified">Missing</span>`}</td>
            <td class="hide-mobile code">${shift.previousHash ? `${escapeHtml(String(shift.previousHash).slice(0, 14))}…` : "—"}</td>
          </tr>
        `)
        .join("");

      return res.status(200).send(
        renderPage({
          title: "Compliance",
          subtitle: "Shift integrity and record completeness overview",
          activePage: "compliance",
          csrfToken,
          body: `
            <section class="cards">
              <div class="card"><div class="card-label">Shift records</div><div class="card-value">${Number(summary.total ?? 0)}</div></div>
              <div class="card"><div class="card-label">Completed</div><div class="card-value success">${Number(summary.completed ?? 0)}</div></div>
              <div class="card"><div class="card-label">Open shifts</div><div class="card-value ${Number(summary.openShifts ?? 0) ? "danger" : ""}">${Number(summary.openShifts ?? 0)}</div></div>
              <div class="card"><div class="card-label">Missing hashes</div><div class="card-value ${Number(summary.missingHash ?? 0) ? "danger" : "success"}">${Number(summary.missingHash ?? 0)}</div></div>
            </section>

            <section class="panel">
              <div class="panel-header"><div>Recent Record Integrity<div class="panel-subtitle">Latest 25 uploaded shift records</div></div></div>
              <div class="table-scroll">
                <table>
                  <thead><tr><th>Log ID</th><th>Start</th><th>End</th><th>Hash</th><th class="hide-mobile">Previous hash</th></tr></thead>
                  <tbody>${rows || `<tr><td colspan="5"><div class="empty"><strong>No shift records</strong>Compliance records will appear after drivers upload shifts.</div></td></tr>`}</tbody>
                </table>
              </div>
            </section>

            <p class="page-note">This is a record-integrity overview. It does not replace a full NZTA enforcement or breach assessment engine.</p>
          `,
        })
      );
    } catch (error) {
      console.error("[ADMIN COMPLIANCE ERROR]", error);
      return res.status(500).send(
        renderSimplePage(
          "Compliance unavailable",
          "Compliance information could not be loaded.",
          "/admin/dashboard"
        )
      );
    }
  });

  /* SUPPORT */

  app.get("/admin/support", (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    const csrfToken = createCsrfToken(req);

    return res.status(200).send(
      renderPage({
        title: "Support",
        subtitle: "Admin portal status and operational guidance",
        activePage: "support",
        csrfToken,
        body: `
          <section class="cards">
            <div class="card"><div class="card-label">Admin session</div><div class="card-value text-value success">Secure</div></div>
            <div class="card"><div class="card-label">Session length</div><div class="card-value text-value">8 hours</div></div>
            <div class="card"><div class="card-label">Database</div><div class="card-value text-value">Railway</div></div>
            <div class="card"><div class="card-label">Portal version</div><div class="card-value text-value">Professional UI</div></div>
          </section>

          <section class="panel">
            <div class="panel-header">Operational Notes</div>
            <div class="summary-list">
              <div class="summary-row"><span>Password reset</span><strong>Email delivery must be connected separately</strong></div>
              <div class="summary-row"><span>Driver deletion</span><strong>Deletes linked shifts and operator links</strong></div>
              <div class="summary-row"><span>Trial extension</span><strong>Adds a fresh 21-day period</strong></div>
              <div class="summary-row"><span>CSV export</span><strong>Available from each driver profile</strong></div>
              <div class="summary-row"><span>Security</span><strong>Signed expiring session and CSRF protection</strong></div>
              <div class="summary-row"><span>Responsive layout</span><strong>Desktop, iPad and mobile</strong></div>
            </div>
          </section>
        `,
      })
    );
  });

  /* ACTIONS */

  app.post("/admin/driver/:id/reset-password", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res) || rejectInvalidCsrf(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send("Invalid driver ID");
    }

    try {
      const rows = await query<{ email: string | null }>(
        `SELECT email FROM drivers WHERE id = ? LIMIT 1`,
        [driverId]
      );

      if (!rows[0]) {
        return res.status(404).send("Driver not found");
      }

      return redirectWithMessage(
        res,
        `/admin/driver/${encodeURIComponent(String(driverId))}`,
        "Password reset email is not connected yet. No password was changed.",
        "warning"
      );
    } catch (error) {
      console.error("[ADMIN RESET PASSWORD ERROR]", error);
      return res.status(500).send("Could not start password reset");
    }
  });

  app.post("/admin/driver/:id/verify-email", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res) || rejectInvalidCsrf(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send("Invalid driver ID");
    }

    try {
      await query(
        `UPDATE drivers SET emailVerified = 1 WHERE id = ?`,
        [driverId]
      );

      return redirectWithMessage(
        res,
        `/admin/driver/${encodeURIComponent(String(driverId))}`,
        "Email marked as verified."
      );
    } catch (error) {
      console.error("[ADMIN VERIFY EMAIL ERROR]", error);
      return res.status(500).send("Could not verify email");
    }
  });

  app.post("/admin/driver/:id/extend-trial", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res) || rejectInvalidCsrf(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send("Invalid driver ID");
    }

    try {
      const rows = await query<{ trialStartDate: string | Date | null }>(
        `SELECT trialStartDate FROM drivers WHERE id = ? LIMIT 1`,
        [driverId]
      );

      const driver = rows[0];

      if (!driver) {
        return res.status(404).send("Driver not found");
      }

      const current = getTrialStatus(driver.trialStartDate);
      const newStart =
        current.expiryDate && current.expiryDate.getTime() > Date.now()
          ? current.expiryDate
          : new Date();

      await query(
        `UPDATE drivers SET trialStartDate = ? WHERE id = ?`,
        [newStart.toISOString(), driverId]
      );

      return redirectWithMessage(
        res,
        `/admin/driver/${encodeURIComponent(String(driverId))}`,
        `Trial extended. New expiry: ${formatDate(new Date(newStart.getTime() + TRIAL_DAYS * ONE_DAY_MS))}.`
      );
    } catch (error) {
      console.error("[ADMIN EXTEND TRIAL ERROR]", error);
      return res.status(500).send("Could not extend trial");
    }
  });

  app.post("/admin/driver/:id/delete", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res) || rejectInvalidCsrf(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send("Invalid driver ID");
    }

    try {
      const driverRows = await query<{ localUserId: string | null }>(
        `SELECT localUserId FROM drivers WHERE id = ? LIMIT 1`,
        [driverId]
      );

      const driver = driverRows[0];

      if (!driver) {
        return res.status(404).send("Driver not found");
      }

      /*
       * One MySQL multi-table DELETE keeps the linked deletion atomic at
       * statement level and avoids depending on whether query() pins a
       * transaction to one pooled connection.
       */
      await query(
        `
          DELETE d, sl, od
          FROM drivers d
          LEFT JOIN shift_logs sl
            ON sl.driverLocalUserId = d.localUserId
          LEFT JOIN operator_drivers od
            ON od.driverLocalUserId = d.localUserId
          WHERE d.id = ?
        `,
        [driverId]
      );

      return redirectWithMessage(
        res,
        "/admin/dashboard",
        "Driver account and linked records deleted."
      );
    } catch (error) {
      console.error("[ADMIN DELETE DRIVER ERROR]", error);
      return res.status(500).send("Could not delete driver");
    }
  });

  app.get("/admin/driver/:id/export.csv", async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) {
      return;
    }

    const driverId = Number(req.params.id);

    if (!Number.isInteger(driverId) || driverId <= 0) {
      return res.status(400).send("Invalid driver ID");
    }

    try {
      const drivers = await query<DriverRecord>(
        `
          SELECT id, localUserId, name, email, licenceNumber
          FROM drivers
          WHERE id = ?
          LIMIT 1
        `,
        [driverId]
      );

      const driver = drivers[0];

      if (!driver) {
        return res.status(404).send("Driver not found");
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

      const csvCell = (value: unknown): string =>
        `"${String(value ?? "").replaceAll('"', '""')}"`;

      const lines = [
        [
          "Driver",
          "Email",
          "Licence",
          "Log ID",
          "Start",
          "End",
          "Duration",
          "Hash",
          "Previous Hash",
        ].map(csvCell).join(","),
        ...shifts.map((shift) =>
          [
            driver.name,
            driver.email,
            driver.licenceNumber,
            shift.logId || shift.id,
            shift.startTime,
            shift.endTime,
            formatDuration(shift.startTime, shift.endTime),
            shift.hash,
            shift.previousHash,
          ].map(csvCell).join(",")
        ),
      ];

      const safeName = String(driver.name || "driver")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "driver";

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeName}-shift-history.csv"`
      );

      return res.status(200).send(`\uFEFF${lines.join("\r\n")}`);
    } catch (error) {
      console.error("[ADMIN EXPORT CSV ERROR]", error);
      return res.status(500).send("Could not export shift history");
    }
  });

  /* LOGOUT */

  app.post("/admin/logout", (req: Request, res: Response) => {
    if (hasAdminSession(req) && rejectInvalidCsrf(req, res)) {
      return;
    }

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );

    return res.redirect("/admin/login");
  });
}
