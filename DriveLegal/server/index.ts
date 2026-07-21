import "dotenv/config";
import { query } from "./db";
import express from "express";
import { createServer } from "http";
import path from "path";

import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";

import { appRouter } from "./routers";
import { createContext } from "./context";

import { portalRouter } from "./portal";
import { excelProtectedRouter } from "./excel-protected";
import { exportRouter } from "./export-routes";
import { adminRouter } from "./admin";
import { registerAdminUi } from "./admin-ui";
import { registerOperatorUi } from "./operator-ui";


const app = express();
const server = createServer(app);

app.set("trust proxy", 1);


// Body parsing
app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "50mb",
  })
);


// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,DELETE,OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});


// Routes
registerStorageProxy(app);
registerOAuthRoutes(app);

portalRouter(app);
adminRouter(app);
registerOperatorUi(app);
registerAdminUi(app);
excelProtectedRouter(app);
exportRouter(app);


// tRPC
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);


// Static storage
const storagePath = path.join(process.cwd(), "storage");

app.use(
  "/storage",
  express.static(storagePath)
);


// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    time: Date.now(),
  });
});


// Email verification
app.get("/verify-email", async (req, res) => {
  const token =
    typeof req.query.token === "string"
      ? req.query.token.trim()
      : "";

  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
          <h2>Missing verification token</h2>
          <p>Please open the complete verification link from your email.</p>
        </body>
      </html>
    `);
  }

  try {
    const tokenRows = await query<any[]>(
      `
      SELECT email, expiresAt
      FROM email_verification_tokens
      WHERE token = ?
      LIMIT 1
      `,
      [token]
    );

    if (tokenRows.length === 0) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
            <h2>Invalid verification link</h2>
            <p>This link is invalid or has already been used.</p>
          </body>
        </html>
      `);
    }

    const record = tokenRows[0];
    const expiresAt = new Date(record.expiresAt).getTime();

    if (
      !Number.isFinite(expiresAt) ||
      expiresAt <= Date.now()
    ) {
      await query(
        `
        DELETE FROM email_verification_tokens
        WHERE token = ?
        `,
        [token]
      );

      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
            <h2>Verification link expired</h2>
            <p>Please return to Drive Legal and request a new verification email.</p>
          </body>
        </html>
      `);
    }

    await query(
      `
      UPDATE drivers
      SET emailVerified = true
      WHERE email = ?
      `,
      [record.email]
    );

    await query(
      `
      DELETE FROM email_verification_tokens
      WHERE email = ?
      `,
      [record.email]
    );

    console.log(
      `[Email Verification] Verified ${record.email}`
    );

    return res.status(200).send(`
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"
      />
      <title>Email Verified — Drive Legal</title>

      <style>
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          min-height: 100vh;
          padding: 28px 20px;
          background: #eef3ff;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
            Roboto, Helvetica, Arial, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #12386e;
        }

        .card {
          width: 100%;
          max-width: 520px;
          background: #ffffff;
          border-radius: 28px;
          padding: 38px 26px;
          text-align: center;
          box-shadow: 0 16px 45px rgba(18, 56, 110, 0.12);
        }

        .app-icon {
          width: 92px;
          height: 92px;
          margin: 0 auto 24px;
          border-radius: 22px;
          background: #3156d3;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 10px 24px rgba(49, 86, 211, 0.25);
        }

        .app-icon span {
          color: #ffffff;
          font-size: 52px;
          font-weight: 900;
          line-height: 1;
        }

        .success-icon {
          width: 64px;
          height: 64px;
          margin: 0 auto 22px;
          border-radius: 50%;
          background: #22c55e;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 38px;
          font-weight: 900;
        }

        h1 {
          margin: 0 0 14px;
          color: #12386e;
          font-size: 34px;
          line-height: 1.15;
          font-weight: 900;
        }

        p {
          margin: 0 auto;
          max-width: 410px;
          color: #71809f;
          font-size: 18px;
          line-height: 1.55;
        }

        .open-button {
          display: block;
          width: 100%;
          margin-top: 30px;
          padding: 17px 20px;
          border-radius: 15px;
          background: #3156d3;
          color: #ffffff;
          text-decoration: none;
          font-size: 18px;
          font-weight: 800;
          box-shadow: 0 8px 20px rgba(49, 86, 211, 0.24);
        }

        .open-button:active {
          opacity: 0.85;
        }

        .help {
          margin-top: 18px;
          color: #8793aa;
          font-size: 13px;
          line-height: 1.5;
        }

        .brand {
          margin-top: 28px;
          color: #12386e;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 1.5px;
        }

        .brand span {
          color: #22c55e;
        }
      </style>
    </head>

    <body>
      <main class="card">
        <div class="app-icon" aria-label="Drive Legal app icon">
          <span>D</span>
        </div>

        <div class="success-icon">✓</div>

        <h1>Email Verified</h1>

        <p>
          Your email address has been verified successfully.
          Tap the button below to return to Drive Legal and sign in.
        </p>

        <a class="open-button" href="drivelegal://login">
          Open Drive Legal App
        </a>

        <div class="help">
          If the app does not open automatically, return to Drive Legal manually
          and sign in with your verified email address.
        </div>

        <div class="brand">
          DRIVE <span>LEGAL</span>
        </div>
      </main>
    </body>
  </html>
`);
  } catch (error) {
    console.error("[verify-email] Verification failed:", error);
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <body style="font-family:Arial,sans-serif;padding:40px;text-align:center;">
          <h2>Verification could not be completed</h2>
          <p>Please return to Drive Legal and request a new verification email.</p>
        </body>
      </html>
    `);
  }
});


// Start server
const port = Number(process.env.PORT || 3000);

server.listen(port, "0.0.0.0", () => {
  console.log(`[server] running on port ${port}`);
});
