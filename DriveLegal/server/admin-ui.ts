import { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { query } from "./db";

const COOKIE_NAME = "drivelegal_admin_session";

/* ─────────────────────────────────────────────
   SECURITY HELPERS
   ───────────────────────────────────────────── */

function safeEqual(a: string, b: string): boolean {
  const first = Buffer.from(a);
  const second = Buffer.from(b);

  return (
    first.length === second.length &&
    timingSafeEqual(first, second)
  );
}

function sessionValue(): string {
  const adminKey = process.env.ADMIN_KEY;

  if (!adminKey) {
    throw new Error("ADMIN_KEY is not configured");
  }

  return createHmac("sha256", adminKey)
    .update("drivelegal-admin-session")
    .digest("hex");
}

function hasAdminSession(req: Request): boolean {
  const cookies = req.headers.cookie ?? "";

  const sessionCookie = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) =>
      cookie.startsWith(`${COOKIE_NAME}=`)
    );

  if (!sessionCookie) {
    return false;
  }

  const supplied = decodeURIComponent(
    sessionCookie.substring(COOKIE_NAME.length + 1)
  );

  return safeEqual(supplied, sessionValue());
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
    return "—";
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

  const totalMinutes = Math.round(
    (end - start) / 60000
  );

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours}h ${minutes}m`;
}
const TRIAL_DAYS = 21;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

type TrialStatus = {
  label: string;
  daysLeft: number | null;
  expired: boolean;
  started: boolean;
  expiryDate: Date | null;
};

function getTrialStatus(
  trialStartValue: unknown
): TrialStatus {
  if (!trialStartValue) {
    return {
      label: "Trial not started",
      daysLeft: null,
      expired: false,
      started: false,
      expiryDate: null,
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
    };
  }

  const expiryDate = new Date(trialStart);
  expiryDate.setDate(
    expiryDate.getDate() + TRIAL_DAYS
  );

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (expiryDate.getTime() - Date.now()) /
        ONE_DAY_MS
    )
  );

  const expired =
    expiryDate.getTime() <= Date.now();

  return {
    label: expired
      ? "Trial Expired"
      : `Trial (${daysLeft}d left)`,
    daysLeft,
    expired,
    started: true,
    expiryDate,
  };
}

function formatTrialExpiry(
  trialStartValue: unknown
): string {
  const trial = getTrialStatus(
    trialStartValue
  );

  return trial.expiryDate
    ? formatDate(trial.expiryDate)
    : "—";
}

/* ─────────────────────────────────────────────
   SHARED PAGE STYLES
   ───────────────────────────────────────────── */

const adminStyles = `
  * {
    box-sizing: border-box;
  }

  html,
  body {
    margin: 0;
    min-height: 100%;
    background: #061d38;
    color: #ffffff;
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      Arial,
      sans-serif;
  }

  body {
    min-height: 100vh;
  }

  .layout {
    min-height: 100vh;
    display: grid;
    grid-template-columns: 260px minmax(0, 1fr);
  }

  aside {
    min-height: 100vh;
    background: #123d72;
    display: flex;
    flex-direction: column;
  }

  .brand {
    padding: 34px 28px 30px;
    border-bottom: 1px solid rgba(255,255,255,0.13);
  }

  .brand strong {
    display: block;
    font-size: 25px;
    letter-spacing: 0.5px;
  }

  .brand strong span {
    color: #46d171;
  }

  .brand small {
    display: block;
    margin-top: 7px;
    color: #cad6e8;
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 2px;
  }

  nav {
    flex: 1;
    padding-top: 28px;
  }

  nav a {
    display: block;
    padding: 18px 30px;
    border-left: 4px solid transparent;
    color: #ffffff;
    text-decoration: none;
    font-size: 17px;
    font-weight: 750;
  }

  nav a:hover {
    background: rgba(255,255,255,0.07);
  }

  nav a.active {
    background: #315a98;
    border-left-color: #708cff;
  }

  .logout {
    padding: 26px 30px;
    border-top: 1px solid rgba(255,255,255,0.13);
  }

  .logout button {
    padding: 0;
    border: 0;
    background: transparent;
    color: #ffffff;
    font-size: 16px;
    font-weight: 750;
    cursor: pointer;
  }

  main {
    min-width: 0;
    padding: 42px;
  }

  h1 {
    margin: 0;
    font-size: clamp(30px, 4vw, 42px);
    line-height: 1.1;
  }

  .subtitle {
    margin: 10px 0 34px;
    color: #b9c5d8;
    font-size: 18px;
  }

  .cards {
    display: grid;
    grid-template-columns:
      repeat(4, minmax(160px, 1fr));
    gap: 20px;
    margin-bottom: 38px;
  }

  .card,
  .panel {
    background: #172f4b;
    border: 1px solid #36506d;
    border-radius: 20px;
  }

  .card {
    min-height: 150px;
    padding: 27px;
  }

  .label {
    color: #d5dce8;
    font-size: 13px;
    font-weight: 850;
    letter-spacing: 1.5px;
  }

  .number {
    margin-top: 17px;
    color: #6486ff;
    font-size: 44px;
    font-weight: 850;
  }

  .panel {
    overflow: hidden;
  }

  .panel-header {
    padding: 23px 26px;
    font-size: 22px;
    font-weight: 850;
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
    padding: 18px 20px;
    border-top: 1px solid #36506d;
    text-align: left;
    vertical-align: middle;
  }

  th {
    background: #2a425e;
    color: #ffffff;
    font-size: 13px;
    font-weight: 850;
    letter-spacing: 1px;
    white-space: nowrap;
  }

  td {
    background: #172f4b;
  }

  td strong {
    font-size: 16px;
  }

  td .muted {
    display: inline-block;
    margin-top: 4px;
    color: #b8c4d6;
  }

  .status {
    display: inline-block;
    padding: 7px 13px;
    border-radius: 999px;
    font-weight: 850;
    white-space: nowrap;
  }

  .verified {
    background: #d9f8e2;
    color: #176b37;
  }

  .unverified {
    background: #ffe0e0;
    color: #a22323;
  }
  .trial {
  background: #fff2c7;
  color: #8a5a00;
}

.expired {
  background: #ffe0e0;
  color: #a22323;
}

  .action-cell {
  width: 240px;
  text-align: right;
  white-space: nowrap;
}

.action-cell .action-button,
.action-cell .secondary-button {
  margin-left: 6px;
}

  .action-button,
  .secondary-button {
    display: inline-block;
    padding: 9px 15px;
    border-radius: 10px;
    color: #ffffff;
    text-decoration: none;
    font-weight: 800;
    white-space: nowrap;
  }

  .action-button {
    background: #4d70d8;
    border: 1px solid #7893ed;
  }

  .secondary-button {
    background: #243d59;
    border: 1px solid #637a94;
  }

  .profile-grid {
    display: grid;
    grid-template-columns:
      repeat(3, minmax(180px, 1fr));
    gap: 26px;
    padding: 27px;
  }

  .profile-item small {
    display: block;
    margin-bottom: 8px;
    color: #aebbcf;
    font-size: 12px;
    font-weight: 850;
    letter-spacing: 1.3px;
  }

  .profile-item strong {
    display: block;
    font-size: 18px;
    overflow-wrap: anywhere;
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin: 26px 0 30px;
  }

  .empty {
    padding: 34px;
    color: #b8c4d6;
    text-align: center;
  }

  .error-box {
    max-width: 760px;
    margin: 50px auto;
    padding: 30px;
    background: #5b1f2a;
    border-radius: 18px;
  }

  @media (max-width: 1100px) {
    .cards {
      grid-template-columns: repeat(2, 1fr);
    }

    .profile-grid {
      grid-template-columns: repeat(2, 1fr);
    }

    th,
    td {
      padding: 16px 14px;
    }

    /*
     * Hide less important columns on iPad-sized screens.
     * Actions remain visible without horizontal scrolling.
     */
    .hide-tablet {
      display: none;
    }
  }

  @media (max-width: 760px) {
    .layout {
      display: block;
    }

    aside {
      min-height: auto;
    }

    .brand {
      padding: 22px 20px;
    }

    nav {
      display: flex;
      overflow-x: auto;
      padding: 0;
    }

    nav a {
      flex: 0 0 auto;
      padding: 15px 18px;
      border-left: 0;
      border-bottom: 4px solid transparent;
    }

    nav a.active {
      border-bottom-color: #708cff;
    }

    .logout {
      display: none;
    }

    main {
      padding: 25px 16px;
    }

    .cards,
    .profile-grid {
      grid-template-columns: 1fr;
    }

    .hide-mobile {
      display: none;
    }

    th,
    td {
      padding: 14px 11px;
    }

    .action-button {
      padding: 8px 11px;
    }
  }
`;

function renderSidebar(activePage: string): string {
  const active = (page: string) =>
    activePage === page ? "active" : "";

  return `
    <aside>
      <div class="brand">
        <strong>DRIVE <span>LEGAL</span></strong>
        <small>ADMIN DASHBOARD</small>
      </div>

      <nav>
        <a
          class="${active("users")}"
          href="/admin/dashboard"
        >
          👥 Users
        </a>

        <a href="#">
          💳 Subscriptions
        </a>

        <a href="#">
          🏢 Operators
        </a>

        <a href="#">
          🛡️ Compliance
        </a>

        <a href="#">
          🔧 Support
        </a>
      </nav>

      <form
        class="logout"
        method="POST"
        action="/admin/logout"
      >
        <button type="submit">
          Sign Out
        </button>
      </form>
    </aside>
  `;
}

/* ─────────────────────────────────────────────
   ADMIN ROUTES
   ───────────────────────────────────────────── */

export function registerAdminUi(app: Express) {
  app.get(
    "/admin",
    (_req: Request, res: Response) => {
      return res.redirect("/admin/login");
    }
  );

  /* ───────────────────────────────────────────
     LOGIN PAGE
     ─────────────────────────────────────────── */

  app.get(
    "/admin/login",
    (req: Request, res: Response) => {
      if (hasAdminSession(req)) {
        return res.redirect("/admin/dashboard");
      }

      const showError = req.query.error === "1";

      return res.status(200).send(`
        <!DOCTYPE html>
        <html lang="en">
          <head>
            <meta charset="UTF-8" />

            <meta
              name="viewport"
              content="width=device-width, initial-scale=1"
            />

            <title>Drive Legal Admin</title>

            <style>
              * {
                box-sizing: border-box;
              }

              body {
                margin: 0;
                min-height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 24px;
                background: #eef3ff;
                color: #12386e;
                font-family:
                  -apple-system,
                  BlinkMacSystemFont,
                  "Segoe UI",
                  Arial,
                  sans-serif;
              }

              .login-card {
                width: 100%;
                max-width: 430px;
                padding: 36px;
                border-radius: 25px;
                background: #ffffff;
                box-shadow:
                  0 18px 48px rgba(18,56,110,0.16);
              }

              h1 {
                margin: 0 0 8px;
                font-size: 32px;
              }

              p {
                margin: 0 0 26px;
                color: #63738e;
              }

              label {
                display: block;
                margin-bottom: 8px;
                font-weight: 800;
              }

              input {
                width: 100%;
                padding: 15px;
                border: 1px solid #ccd6e8;
                border-radius: 12px;
                font-size: 16px;
              }

              button {
                width: 100%;
                margin-top: 19px;
                padding: 15px;
                border: 0;
                border-radius: 12px;
                background: #145ddd;
                color: #ffffff;
                font-size: 17px;
                font-weight: 850;
                cursor: pointer;
              }

              .error {
                margin-bottom: 18px;
                padding: 12px;
                border-radius: 10px;
                background: #fff0f0;
                color: #a31515;
              }
            </style>
          </head>

          <body>
            <main class="login-card">
              <h1>Drive Legal</h1>
              <p>Administrator portal</p>

              ${
                showError
                  ? `
                    <div class="error">
                      Invalid administrator key.
                    </div>
                  `
                  : ""
              }

              <form
                method="POST"
                action="/admin/login"
              >
                <label for="adminKey">
                  Administrator key
                </label>

                <input
                  id="adminKey"
                  name="adminKey"
                  type="password"
                  autocomplete="current-password"
                  required
                />

                <button type="submit">
                  Sign in
                </button>
              </form>
            </main>
          </body>
        </html>
      `);
    }
  );

  app.post(
    "/admin/login",
    (req: Request, res: Response) => {
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

      res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=${encodeURIComponent(
          sessionValue()
        )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
      );

      return res.redirect("/admin/dashboard");
    }
  );

  /* ───────────────────────────────────────────
     USERS DASHBOARD
     ─────────────────────────────────────────── */

  app.get(
    "/admin/dashboard",
    async (req: Request, res: Response) => {
      if (!hasAdminSession(req)) {
        return res.redirect("/admin/login");
      }

      try {
        const drivers = await query<any>(`
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

        const shiftCountRows = await query<any>(`
          SELECT COUNT(*) AS count
          FROM shift_logs
        `);

        const totalDrivers = drivers.length;

        const activeTrials = drivers.filter(
  (driver: any) =>
    getTrialStatus(driver.trialStartDate).started &&
    !getTrialStatus(driver.trialStartDate).expired
).length;

const expiredTrials = drivers.filter(
  (driver: any) =>
    getTrialStatus(driver.trialStartDate).expired
).length;

        const totalShifts = Number(
          shiftCountRows[0]?.count ?? 0
        );

        const driverRows = drivers
          .map((driver: any) => {
             const trial = getTrialStatus(driver.trialStartDate);
            return `
              <tr>
                <td>
                  <strong>
                    ${escapeHtml(driver.name)}
                  </strong>

                  <br />

                  <span class="muted">
                    ${escapeHtml(driver.email)}
                  </span>
                </td>

                <td>
                  ${escapeHtml(driver.licenceNumber)}
                </td>

                <td>
  <span
    class="status ${
      !trial.started
        ? "unverified"
        : trial.expired
          ? "expired"
          : "trial"
    }"
  >
    ${escapeHtml(trial.label)}
  </span>
</td>
                <td class="hide-mobile">
                  ${escapeHtml(driver.driverType)}
                </td>
                <td>
  ${Number(driver.shiftCount ?? 0)}
</td>

                <td class="action-cell">
  <a
    class="action-button"
    href="/admin/driver/${encodeURIComponent(
      String(driver.id)
    )}"
  >
    View
  </a>

  <form
    method="POST"
    action="/admin/driver/${encodeURIComponent(
      String(driver.id)
    )}/reset-password"
    style="display:inline"
  >
    <button
      class="secondary-button"
      type="submit"
    >
      Reset PW
    </button>
  </form>

  <form
    method="POST"
    action="/admin/driver/${encodeURIComponent(
      String(driver.id)
    )}/delete"
    style="display:inline"
    onsubmit="return confirm('Delete this driver and all linked shift logs?');"
  >
    <button
      class="secondary-button"
      type="submit"
    >
      Delete
    </button>
  </form>
</td>
          .join("");

        return res.status(200).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
              />

              <title>
                Users — Drive Legal Admin
              </title>

              <style>
                ${adminStyles}
              </style>
            </head>

            <body>
              <div class="layout">
                ${renderSidebar("users")}

                <main>
                  <h1>User Management</h1>

                  <p class="subtitle">
                    Manage all registered Drive Legal drivers
                  </p>

                  <section class="cards">
                    <div class="card">
                      <div class="label">
                        TOTAL DRIVERS
                      </div>

                      <div class="number">
                        ${totalDrivers}
                      </div>
                    </div>

                  
                    <div class="card">
                      <div class="label">
                        TOTAL SHIFTS
                      </div>

                      <div class="number">
                        ${totalShifts}
                      </div>
                    </div>
                  </section>

                  <section class="panel">
                    <div class="panel-header">
                      All Drivers
                    </div>

                    <div class="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>DRIVER</th>
                            <th>LICENCE</th>
                            <th>STATUS</th>

                            <th class="hide-mobile">
  TYPE
</th>

<th>
  SHIFTS
</th>

<th class="hide-tablet">
  REGISTERED
</th>

                            <th class="action-cell">
                              ACTION
                            </th>
                          </tr>
                        </thead>

                        <tbody>
                          ${
                            driverRows ||
                            `
                              <tr>
                                <td colspan="7">
                                  No drivers registered
                                </td>
                              </tr>
                            `
                          }
                        </tbody>
                      </table>
                    </div>
                  </section>
                </main>
              </div>
            </body>
          </html>
        `);
      } catch (error) {
        console.error(
          "[ADMIN DASHBOARD ERROR]",
          error
        );

        return res.status(500).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <title>Dashboard Error</title>

              <style>
                ${adminStyles}
              </style>
            </head>

            <body>
              <div class="error-box">
                <h1>Dashboard unavailable</h1>

                <p>
                  The dashboard could not load the
                  Railway database.
                </p>

                <a
                  class="secondary-button"
                  href="/admin/dashboard"
                >
                  Try again
                </a>
              </div>
            </body>
          </html>
        `);
      }
    }
  );

  /* ───────────────────────────────────────────
     DRIVER PROFILE
     ─────────────────────────────────────────── */

  app.get(
    "/admin/driver/:id",
    async (req: Request, res: Response) => {
      if (!hasAdminSession(req)) {
        return res.redirect("/admin/login");
      }

      const driverId = Number(req.params.id);

      if (
        !Number.isInteger(driverId) ||
        driverId <= 0
      ) {
        return res.status(400).send(
          "Invalid driver ID"
        );
      }

      try {
        const driverRows = await query<any>(
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
              createdAt
            FROM drivers
            WHERE id = ?
            LIMIT 1
          `,
          [driverId]
        );

        const driver = driverRows[0];

        if (!driver) {
          return res.status(404).send(`
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8" />
                <title>Driver Not Found</title>

                <style>
                  ${adminStyles}
                </style>
              </head>

              <body>
                <div class="error-box">
                  <h1>Driver not found</h1>

                  <a
                    class="secondary-button"
                    href="/admin/dashboard"
                  >
                    Back to Users
                  </a>
                </div>
              </body>
            </html>
          `);
        }

        const shifts = driver.localUserId
          ? await query<any>(
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

        const completedShifts = shifts.filter(
          (shift: any) => shift.endTime
        );

        const totalMinutes =
          completedShifts.reduce(
            (sum: number, shift: any) => {
              const start = new Date(
                String(shift.startTime)
              ).getTime();

              const end = new Date(
                String(shift.endTime)
              ).getTime();

              if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end < start
              ) {
                return sum;
              }

              return (
                sum +
                Math.round((end - start) / 60000)
              );
            },
            0
          );

        const totalHours =
          Math.round((totalMinutes / 60) * 10) /
          10;

        const shiftRows = shifts
          .map((shift: any) => {
            return `
              <tr>
                <td>
                  ${formatDate(shift.startTime)}
                </td>

                <td>
                  ${formatDateTime(shift.startTime)}
                </td>

                <td>
                  ${formatDateTime(shift.endTime)}
                </td>

                <td>
                  ${formatDuration(
                    shift.startTime,
                    shift.endTime
                  )}
                </td>

                <td class="hide-mobile">
                  ${
                    shift.hash
                      ? escapeHtml(
                          String(shift.hash).slice(
                            0,
                            14
                          )
                        ) + "…"
                      : "—"
                  }
                </td>
              </tr>
            `;
          })
          .join("");

        return res.status(200).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
              />

              <title>
                ${escapeHtml(driver.name)}
                — Drive Legal Admin
              </title>

              <style>
                ${adminStyles}
              </style>
            </head>

            <body>
              <div class="layout">
                ${renderSidebar("users")}

                <main>
                  <h1>
                    ${escapeHtml(driver.name)}
                  </h1>

                  <p class="subtitle">
                    ${escapeHtml(driver.email)}
                    · Licence:
                    ${escapeHtml(
                      driver.licenceNumber
                    )}
                  </p>

                  <section class="panel">
                    <div class="panel-header">
                      Driver Profile
                    </div>

                    <div class="profile-grid">
                      <div class="profile-item">
                        <small>FULL NAME</small>
                        <strong>
                          ${escapeHtml(driver.name)}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>EMAIL</small>
                        <strong>
                          ${escapeHtml(driver.email)}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>LICENCE NUMBER</small>
                        <strong>
                          ${escapeHtml(
                            driver.licenceNumber
                          )}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>VEHICLE REGO</small>
                        <strong>
                          ${escapeHtml(
                            driver.vehicleRegistration
                          )}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>DRIVER TYPE</small>
                        <strong>
                          ${escapeHtml(
                            driver.driverType
                          )}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>REGISTERED</small>
                        <strong>
                          ${formatDate(
                            driver.createdAt
                          )}
                        </strong>
                      </div>

                      <div class="profile-item">
                        <small>EMAIL STATUS</small>

                        <strong>
                          ${
                            driver.emailVerified
                              ? `
                                <span
                                  class="status verified"
                                >
                                  Verified
                                </span>
                              `
                              : `
                                <span
                                  class="status unverified"
                                >
                                  Unverified
                                </span>
                              `
                          }
                        </strong>
                      </div>
                    </div>
                  </section>

                  <div class="toolbar">
                    <a
                      class="secondary-button"
                      href="/admin/dashboard"
                    >
                      ← Back to Users
                    </a>
                  </div>

                  <section class="cards">
                    <div class="card">
                      <div class="label">
                        TOTAL SHIFTS
                      </div>

                      <div class="number">
                        ${shifts.length}
                      </div>
                    </div>

                    <div class="card">
                      <div class="label">
                        COMPLETED SHIFTS
                      </div>

                      <div class="number">
                        ${completedShifts.length}
                      </div>
                    </div>

                    <div class="card">
                      <div class="label">
                        TOTAL SHIFT HOURS
                      </div>

                      <div class="number">
                        ${totalHours}
                      </div>
                    </div>

                    <div class="card">
                      <div class="label">
                        DRIVER TYPE
                      </div>

                      <div
                        style="
                          margin-top:18px;
                          font-size:20px;
                          font-weight:850;
                        "
                      >
                        ${escapeHtml(
                          driver.driverType
                        )}
                      </div>
                    </div>
                  </section>

                  <section class="panel">
                    <div class="panel-header">
                      Shift History
                    </div>

                    ${
                      shiftRows
                        ? `
                          <div class="table-scroll">
                            <table>
                              <thead>
                                <tr>
                                  <th>DATE</th>
                                  <th>START</th>
                                  <th>END</th>
                                  <th>DURATION</th>

                                  <th class="hide-mobile">
                                    HASH
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                ${shiftRows}
                              </tbody>
                            </table>
                          </div>
                        `
                        : `
                          <div class="empty">
                            No shifts logged
                          </div>
                        `
                    }
                  </section>
                </main>
              </div>
            </body>
          </html>
        `);
      } catch (error) {
        console.error(
          "[ADMIN DRIVER PROFILE ERROR]",
          error
        );

        return res.status(500).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <title>Driver Profile Error</title>

              <style>
                ${adminStyles}
              </style>
            </head>

            <body>
              <div class="error-box">
                <h1>
                  Driver profile unavailable
                </h1>

                <p>
                  The driver or shift data could
                  not be loaded.
                </p>

                <a
                  class="secondary-button"
                  href="/admin/dashboard"
                >
                  Back to Users
                </a>
              </div>
            </body>
          </html>
        `);
      }
    }
  );

  /* ───────────────────────────────────────────
     LOGOUT
     ─────────────────────────────────────────── */

  app.post(
    "/admin/logout",
    (_req: Request, res: Response) => {
      res.setHeader(
        "Set-Cookie",
        `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
      );

      return res.redirect("/admin/login");
    }
  );
}
