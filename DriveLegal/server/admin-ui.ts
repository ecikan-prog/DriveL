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

  if (!sessionCookie) return false;

  const supplied = decodeURIComponent(
    sessionCookie.substring(COOKIE_NAME.length + 1)
  );

  return safeEqual(supplied, sessionValue());
}

export function registerAdminUi(app: Express) {
  app.get("/admin", (_req, res) => {
    res.redirect("/admin/login");
  });

  app.get("/admin/dashboard", async (req, res) => {
  if (!hasAdminSession(req)) {
    return res.redirect("/admin/login");
  }

  const drivers = await query(`
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

 const totalDrivers = drivers.length;

const driverRows = drivers
  .map((driver: any) => {
    const registered = driver.createdAt
      ? new Date(driver.createdAt).toLocaleDateString("en-NZ")
      : "—";

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
        <td>${registered}</td>
      </tr>
    `;
  })
  .join("");

    res.status(200).send(`
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
          border-bottom: 1px solid rgba(255,255,255,0.12);
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
          border-top: 1px solid rgba(255,255,255,0.12);
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
          grid-template-columns: repeat(4, minmax(180px, 1fr));
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
          width: 100%;
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
            min-width: 760px;
          }
        }
      </style>
    </head>

    <body>
      <div class="layout">
        <aside>
          <div class="brand">
            <strong>DRIVE <span>LEGAL</span></strong>
            <small>ADMIN DASHBOARD</small>
          </div>

          <nav>
            <a class="active" href="/admin/dashboard">👥 Users</a>
            <a href="#">💳 Subscriptions</a>
            <a href="#">🏢 Operators</a>
            <a href="#">🛡️ Compliance</a>
            <a href="#">🔧 Support</a>
          </nav>

          <form class="logout" method="POST" action="/admin/logout">
            <button type="submit">Sign Out</button>
          </form>
        </aside>

        <main>
          <h1>User Management</h1>
          <p class="subtitle">
            Manage all registered Drive Legal drivers
          </p>

          <section class="cards">
            <div class="card">
              <div class="label">TOTAL DRIVERS</div>
              <div class="number">${totalDrivers}</div>
            </div>

            <div class="card">
              <div class="label">VERIFIED EMAILS</div>
              <div class="number">
                ${
                  drivers.filter(
                    (driver: any) => Boolean(driver.emailVerified)
                  ).length
                }
              </div>
            </div>

            <div class="card">
              <div class="label">UNVERIFIED EMAILS</div>
              <div class="number">
                ${
                  drivers.filter(
                    (driver: any) => !Boolean(driver.emailVerified)
                  ).length
                }
              </div>
            </div>

            <div class="card">
              <div class="label">TOTAL SHIFTS</div>
              <div class="number">—</div>
            </div>
          </section>

          <section class="table-card">
            <div class="table-title">All Drivers</div>

            <table>
              <thead>
                <tr>
                  <th>DRIVER</th>
                  <th>LICENCE</th>
                  <th>EMAIL STATUS</th>
                  <th>TYPE</th>
                  <th>REGISTERED</th>
                </tr>
              </thead>

              <tbody>
                ${
                  driverRows ||
                  '<tr><td colspan="5">No drivers registered</td></tr>'
                }
              </tbody>
            </table>
          </section>
        </main>
      </div>
    </body>
  </html>
`);

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

  app.get("/admin/dashboard", (req, res) => {
    if (!hasAdminSession(req)) {
      return res.redirect("/admin/login");
    }

    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
          />
          <title>Drive Legal Dashboard</title>
        </head>

        <body style="font-family:Arial,sans-serif;padding:30px">
          <h1>Drive Legal Admin Dashboard</h1>
          <p>Authentication successful.</p>
        </body>
      </html>
    `);
  });

  app.post("/admin/logout", (_req, res) => {
    res.setHeader(
      "Set-Cookie",
      `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`
    );

    res.redirect("/admin/login");
  });
}
