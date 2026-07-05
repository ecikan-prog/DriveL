import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";

import { appRouter } from "../routers";
import { createContext } from "./context";

import { portalRouter } from "../portal";
import { excelProtectedRouter } from "../excel-protected";
import { exportRouter } from "../export-routes";
import { adminRouter } from "../admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────
// CSS Injection (unchanged - keep as-is)
// ─────────────────────────────────────────────
const CSS_INJECTION = `<style id="gnzl-styles">/* unchanged - keep your existing CSS */</style>`;

function injectCssIntoHtml(html: string): string {
  if (html.includes('id="gnzl-styles"')) return html;
  if (html.includes("</head>")) {
    return html.replace("</head>", `${CSS_INJECTION}</head>`);
  }
  return CSS_INJECTION + html;
}

// ─────────────────────────────────────────────
// Verification page (unchanged)
// ─────────────────────────────────────────────
function buildVerificationResultPage(success: boolean, message: string): string {
  const icon = success ? "✅" : "❌";
  const title = success ? "Email Verified" : "Verification Failed";
  const color = success ? "#22C55E" : "#EF4444";

  const APP_SCHEME = "manusguidednzlogbook";
  const APP_STORE_URL = "https://apps.apple.com/app/id6745786048";
  const deepLinkUrl = `${APP_SCHEME}://login`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>
<style>
body{margin:0;font-family:system-ui;background:#F0F4FF;display:flex;align-items:center;justify-content:center;height:100vh}
.card{background:white;padding:40px;border-radius:16px;text-align:center;max-width:420px}
h1{color:${color}}
a{display:inline-block;margin-top:16px;padding:12px 24px;background:#5980E9;color:white;text-decoration:none;border-radius:8px}
</style>
</head>
<body>
<div class="card">
<h1>${icon} ${title}</h1>
<p>${message}</p>
<a href="${deepLinkUrl}">Open App</a>
<p style="font-size:12px;color:#999;margin-top:12px;">
If app doesn’t open, <a href="${APP_STORE_URL}">download from App Store</a>
</p>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────
async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── CORS ───
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) res.header("Access-Control-Allow-Origin", origin);

    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") return res.sendStatus(200);
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // ─── Core services ───
  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── Routers ───
  app.use("/portal", portalRouter);
  app.use("/admin", adminRouter);
  app.use("/api/export/excel-protected", excelProtectedRouter);
  app.use("/api/export", exportRouter);

  // ─── TRPC ───
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // ─── STORAGE STATIC FILES (IMPORTANT FIX) ───
  const storagePath = path.join(process.cwd(), "storage");
  app.use("/storage", express.static(storagePath));

  // ─── LEGAL FILES ───
  const publicDir = path.join(__dirname, "../public");

  app.get("/terms", (_req, res) => {
    const filePath = path.join(publicDir, "DriveLegalTC.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  });

  app.get("/privacy", (_req, res) => {
    const filePath = path.join(publicDir, "DriveLegalPrivacy.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.sendFile(filePath);
  });

  // ─── HEALTH ───
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // ─── EMAIL VERIFY ───
  app.get("/verify-email", async (req, res) => {
    const token = req.query.token as string | undefined;

    if (!token) {
      return res
        .status(400)
        .send(buildVerificationResultPage(false, "Missing token"));
    }

    try {
      const {
        getEmailVerificationToken,
        markDriverEmailVerified,
        deleteEmailVerificationToken,
      } = await import("../db");

      const record = await getEmailVerificationToken(token);

      if (!record) {
        return res
          .status(400)
          .send(buildVerificationResultPage(false, "Invalid or expired link"));
      }

      await markDriverEmailVerified(record.email);
      await deleteEmailVerificationToken(token);

      res.send(
        buildVerificationResultPage(true, "Email verified successfully")
      );
    } catch (err) {
      console.error(err);
      res
        .status(500)
        .send(buildVerificationResultPage(false, "Server error"));
    }
  });

  // ─── STATIC WEB BUILD ───
  const webDistPath = path.resolve(__dirname, "web");

  app.use(
    express.static(webDistPath, {
      index: false,
    })
  );

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ error: "Not found" });
    }

    const indexPath = path.join(webDistPath, "index.html");

    if (!fs.existsSync(indexPath)) {
      return res
        .status(200)
        .send("<h1>Server running</h1><p>No web build found</p>");
    }

    const html = fs.readFileSync(indexPath, "utf8");
    res.setHeader("Content-Type", "text/html");
    res.send(injectCssIntoHtml(html));
  });

  // ─────────────────────────────────────────────
  // RAILWAY SAFE PORT (IMPORTANT FIX)
  // ─────────────────────────────────────────────
  const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  server.listen(port, "0.0.0.0", () => {
    console.log(`[server] running on port ${port}`);
  });
}

startServer().catch(console.error);