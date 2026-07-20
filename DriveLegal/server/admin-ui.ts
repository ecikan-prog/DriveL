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
              req.query.error
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
