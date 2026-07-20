import { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { query } from "./db";

const COOKIE_NAME = "drivelegal_admin_session";

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
    .find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`));

  if (!sessionCookie) {
    return false;
  }

  const supplied = decodeURIComponent(
    sessionCookie.substring(COOKIE_NAME.length + 1)
  );

  return safeEqual(supplied, sessionValue());
}

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

  return date.toLocaleDateString("en-NZ");
}

export function registerAdminUi(app: Express) {
  app.get("/admin", (_req: Request, res: Response) => {
    res.redirect("/admin/login");
  });

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
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                Arial, sans-serif;
            }

            .card {
              width: 100%;
              max-width: 420px;
              padding: 34px;
              border-radius: 24px;
              background: white;
              box-shadow: 0 18px 45px rgba(18, 56, 110, 0.15);
            }

            h1 {
              margin: 0 0 8px;
              font-size: 30px;
            }

            p {
              margin: 0 0 24px;
              color: #63738e;
            }

            label {
              display: block;
              margin-bottom: 8px;
              font-weight: 700;
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
              margin-top: 18px;
              padding: 15px;
              border: 0;
              border-radius: 12px;
              background: #145ddd;
              color: white;
              font-size: 17px;
              font-weight: 800;
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
          <main class="card">
            <h1>Drive Legal</h1>
            <p>Administrator portal</p>

            ${
              showError
                ? '<div class="error">Invalid administrator key.</div>'
                : ""
            }

            <form method="POST" action="/admin/login">
              <label for="adminKey">Administrator key</label>

              <input
                id="adminKey"
                name="adminKey"
                type="password"
                autocomplete="current-password"
                required
              />

              <button type="submit">Sign in</button>
            </form>
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

    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=${encodeURIComponent(
        sessionValue()
      )}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`
    );

    return res.redirect("/admin/dashboard");
  });

  app.get(
    "/admin/dashboard",
    async (req: Request, res: Response) => {
      if (!hasAdminSession(req)) {
        return res.redirect("/admin/login");
      }

      try {
        const drivers = await query<any>(`
          SELECT
            id,
            name,
            email,
            licenceNumber,
            vehicleRegistration,
            driverType,
            emailVerified,
            createdAt
          FROM drivers
          ORDER BY createdAt DESC
        `);

        const shiftCountRows = await query<any>(`
          SELECT COUNT(*) AS count
          FROM shift_logs
        `);

        const totalDrivers = drivers.length;

        const verifiedEmails = drivers.filter(
          (driver: any) => Boolean(driver.emailVerified)
        ).length;

        const unverifiedEmails = totalDrivers - verifiedEmails;

        const totalShifts = Number(
          shiftCountRows[0]?.count ?? 0
        );

        const driverRows = drivers
          .map((driver: any) => {
            return `
              <tr>
                <td>
                  <strong>${escapeHtml(driver.name)}</strong><br />
                  <span>${escapeHtml(driver.email)}</span>
                </td>

                <td>${escapeHtml(driver.licenceNumber)}</td>

                <td>
                  ${
                    driver.emailVerified
                      ? '<span class="verified">Verified</span>'
                      : '<span class="unverified">Unverified</span>'
                  }
                </td>

                <td>${escapeHtml(driver.driverType)}</td>

                <td>${formatDate(driver.createdAt)}</td>

                <td>
                  <a
                    class="action-button"
                    href="/admin/driver/${encodeURIComponent(
                      String(driver.id)
                    )}"
                  >
                    View
                  </a>
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

              <title>Users — Drive Legal Admin</title>

              <style>
                * {
                  box-sizing: border-box;
                }

                body {
                  margin: 0;
                  background: #061d38;
                  color: #ffffff;
                  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
                    Arial, sans-serif;
                }

                .layout {
                  min-height: 100vh;
                  display: grid;
                  grid-template-columns: 260px 1fr;
                }

                aside {
                  background: #123d72;
                  padding: 30px 0;
                  display: flex;
                  flex-direction: column;
                }

                .brand {
                  padding: 0 28px 28px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
                }

                .brand strong {
                  font-size: 24px;
                }

                .brand span {
                  color: #46d171;
                }

                .brand small {
                  display: block;
                  margin-top: 6px;
                  letter-spacing: 2px;
                  color: #c7d4e8;
                }

                nav {
                  padding-top: 24px;
                  flex: 1;
                }

                nav a {
                  display: block;
                  padding: 17px 28px;
                  color: white;
                  text-decoration: none;
                  font-weight: 700;
                }

                nav a.active {
                  background: #2d5592;
                  border-left: 4px solid #6c8fff;
                }

                .logout {
                  padding: 24px 28px 0;
                  border-top: 1px solid rgba(255, 255, 255, 0.12);
                }

                .logout button {
                  border: 0;
                  background: transparent;
                  color: white;
                  font-size: 16px;
                  font-weight: 700;
                  cursor: pointer;
                }

                main {
                  padding: 42px;
                  overflow-x: auto;
                }

                h1 {
                  margin: 0;
                  font-size: 36px;
                }

                .subtitle {
                  margin: 8px 0 34px;
                  color: #b9c5d8;
                  font-size: 18px;
                }

                .cards {
                  display: grid;
                  grid-template-columns: repeat(
                    4,
                    minmax(180px, 1fr)
                  );
                  gap: 18px;
                  margin-bottom: 34px;
                }

                .card {
                  background: #172f4b;
                  border: 1px solid #36506d;
                  border-radius: 20px;
                  padding: 26px;
                }

                .label {
                  color: #d2d9e6;
                  font-size: 13px;
                  font-weight: 800;
                  letter-spacing: 1.5px;
                }

                .number {
                  margin-top: 14px;
                  font-size: 42px;
                  font-weight: 800;
                  color: #6486ff;
                }

                .table-card {
                  background: #172f4b;
                  border: 1px solid #36506d;
                  border-radius: 20px;
                  overflow: hidden;
                }

                .table-title {
                  padding: 22px 26px;
                  font-size: 22px;
                  font-weight: 800;
                }

                table {
  width: 1100px;
  min-width: 1100px;
  border-collapse: collapse;
}

                th,
                td {
                  padding: 18px 20px;
                  text-align: left;
                  border-top: 1px solid #36506d;
                }

                th {
                  background: #2a425e;
                  font-size: 13px;
                  letter-spacing: 1px;
                }

                td span {
                  color: #b8c4d6;
                }

                .verified,
                .unverified {
                  display: inline-block;
                  padding: 7px 12px;
                  border-radius: 999px;
                  font-weight: 800;
                }

                .verified {
                  background: #d9f8e2;
                  color: #176b37;
                }

                .unverified {
                  background: #ffe0e0;
                  color: #a22323;
                }

                .action-button {
                  display: inline-block;
                  padding: 8px 14px;
                  border: 1px solid #69809b;
                  border-radius: 10px;
                  color: white;
                  text-decoration: none;
                  font-weight: 700;
                }

                .error-card {
                  padding: 24px;
                  border-radius: 16px;
                  background: #5b1f2a;
                  color: white;
                }

                @media (max-width: 900px) {
                  .layout {
                    grid-template-columns: 1fr;
                  }

                  aside {
                    display: none;
                  }

                  main {
                    padding: 24px 16px;
                  }

                  .cards {
                    grid-template-columns: repeat(2, 1fr);
                  }

                  table {
                    min-width: 850px;
                  }
                }

                @media (max-width: 520px) {
                  .cards {
                    grid-template-columns: 1fr;
                  }
                }
              </style>
            </head>

            <body>
              <div class="layout">
                <aside>
                  <div class="brand">
                    <strong>
                      DRIVE <span>LEGAL</span>
                    </strong>

                    <small>ADMIN DASHBOARD</small>
                  </div>

                  <nav>
                    <a
                      class="active"
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
                        VERIFIED EMAILS
                      </div>

                      <div class="number">
                        ${verifiedEmails}
                      </div>
                    </div>

                    <div class="card">
                      <div class="label">
                        UNVERIFIED EMAILS
                      </div>

                      <div class="number">
                        ${unverifiedEmails}
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

                  <section class="table-card">
                    <div class="table-title">
                      All Drivers
                    </div>
                    <div class="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>DRIVER</th>
                          <th>LICENCE</th>
                          <th>EMAIL STATUS</th>
                          <th>TYPE</th>
                          <th>REGISTERED</th>
                          <th>ACTIONS</th>
                        </tr>
                      </thead>

                      <tbody>
                        ${
                          driverRows ||
                          `
                            <tr>
                              <td colspan="6">
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
        console.error("[ADMIN DASHBOARD ERROR]", error);

        return res.status(500).send(`
          <!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />

              <meta
                name="viewport"
                content="width=device-width, initial-scale=1"
              />

              <title>Admin Dashboard Error</title>
            </head>

            <body
              style="
                margin:0;
                padding:30px;
                background:#061d38;
                color:white;
                font-family:Arial,sans-serif;
              "
            >
              <div
                style="
                  max-width:700px;
                  margin:40px auto;
                  padding:28px;
                  background:#5b1f2a;
                  border-radius:16px;
                "
              >
                <h1>Dashboard unavailable</h1>

                <p>
                  The admin dashboard could not load the database.
                </p>

                <a
                  href="/admin/dashboard"
                  style="color:white"
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
