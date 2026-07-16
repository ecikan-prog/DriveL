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


const app = express();
const server = createServer(app);


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
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verified — Drive Legal</title>
        </head>
        <body style="
          margin:0;
          min-height:100vh;
          display:flex;
          align-items:center;
          justify-content:center;
          background:#F0F4FF;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;
          padding:24px;
        ">
          <div style="
            max-width:480px;
            background:#FFFFFF;
            border-radius:20px;
            padding:40px 28px;
            text-align:center;
            box-shadow:0 10px 30px rgba(0,51,102,0.10);
          ">
            <div style="font-size:56px;margin-bottom:16px;">✅</div>
            <h1 style="color:#12386E;margin:0 0 12px;">
              Email Verified
            </h1>
            <p style="color:#71809F;line-height:1.6;margin:0;">
              Your email address has been verified successfully.
              You can now return to Drive Legal and sign in.
            </p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error(
      "[Email Verification] GET route failed:",
      error
    );

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
