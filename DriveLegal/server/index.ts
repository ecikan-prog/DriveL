import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
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

// ─── CSS injection ────────────────────────────────────────────────────────────
// Injected into every HTML page at request time so it works regardless of
// whether the build script ran the post-build CSS injection step.
const CSS_INJECTION = `<style id="gnzl-styles">
/* ── CSS Variables ── */
:root {
  --color-primary: #003366;
  --color-secondary: #5980E9;
  --color-background: #ffffff;
  --color-surface: #F0F4FF;
  --color-foreground: #0D1B2A;
  --color-muted: #6B7A99;
  --color-border: #D1DCF0;
  --color-success: #22C55E;
  --color-warning: #F59E0B;
  --color-error: #EF4444;
}
/* ── Resets ── */
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  background: #ffffff;
}
/* ── Layout utilities ── */
.flex-1 { flex: 1; }
.flex-row { flex-direction: row; }
.items-center { align-items: center; }
.justify-center { justify-content: center; }
.justify-between { justify-content: space-between; }
.self-center { align-self: center; }
.overflow-hidden { overflow: hidden; }
/* ── Spacing ── */
.p-4 { padding: 16px; } .p-6 { padding: 24px; } .p-3 { padding: 12px; }
.px-4 { padding-left: 16px; padding-right: 16px; }
.px-5 { padding-left: 20px; padding-right: 20px; }
.px-6 { padding-left: 24px; padding-right: 24px; }
.py-2 { padding-top: 8px; padding-bottom: 8px; }
.py-3 { padding-top: 12px; padding-bottom: 12px; }
.py-4 { padding-top: 16px; padding-bottom: 16px; }
.pt-2 { padding-top: 8px; } .pt-12 { padding-top: 48px; }
.pb-4 { padding-bottom: 16px; } .pb-6 { padding-bottom: 24px; }
.mb-1 { margin-bottom: 4px; } .mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; } .mb-4 { margin-bottom: 16px; }
.mb-5 { margin-bottom: 20px; } .mb-6 { margin-bottom: 24px; }
.mt-1 { margin-top: 4px; } .mt-2 { margin-top: 8px; }
.mt-4 { margin-top: 16px; } .mt-6 { margin-top: 24px; }
.ml-8 { margin-left: 32px; }
.gap-2 { gap: 8px; } .gap-3 { gap: 12px; } .gap-4 { gap: 16px; }
/* ── Sizing ── */
.w-full { width: 100%; } .h-full { height: 100%; }
.w-20 { width: 80px; } .h-20 { height: 80px; }
.w-24 { width: 96px; } .h-24 { height: 96px; }
.w-5 { width: 20px; } .h-5 { height: 20px; }
.min-h-screen { min-height: 100vh; }
/* ── Border radius ── */
.rounded { border-radius: 4px; }
.rounded-lg { border-radius: 8px; }
.rounded-xl { border-radius: 12px; }
.rounded-2xl { border-radius: 16px; }
.rounded-3xl { border-radius: 24px; }
.rounded-full { border-radius: 9999px; }
.rounded-t-3xl { border-top-left-radius: 24px; border-top-right-radius: 24px; }
/* ── Text ── */
.text-xs { font-size: 12px; line-height: 16px; }
.text-sm { font-size: 14px; line-height: 20px; }
.text-base { font-size: 16px; line-height: 24px; }
.text-lg { font-size: 18px; line-height: 28px; }
.text-xl { font-size: 20px; line-height: 28px; }
.text-2xl { font-size: 24px; line-height: 32px; }
.text-3xl { font-size: 30px; line-height: 36px; }
.text-4xl { font-size: 36px; line-height: 40px; }
.text-5xl { font-size: 48px; line-height: 1; }
.font-medium { font-weight: 500; }
.font-semibold { font-weight: 600; }
.font-bold { font-weight: 700; }
.font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
.text-center { text-align: center; }
.uppercase { text-transform: uppercase; }
.tracking-wide { letter-spacing: 0.025em; }
.tracking-widest { letter-spacing: 0.1em; }
.leading-relaxed { line-height: 1.625; }
/* ── Colors ── */
.text-white { color: #ffffff; }
.text-black { color: #000000; }
.bg-white { background-color: #ffffff; }
.bg-black { background-color: #000000; }
.bg-transparent { background-color: transparent; }
/* Brand */
.text-blue-200 { color: #bfdbfe; }
.text-blue-300 { color: #93c5fd; }
.text-green-300 { color: #86efac; }
.text-green-400 { color: #4ade80; }
.text-amber-600 { color: #d97706; }
.text-amber-700 { color: #b45309; }
.text-red-600 { color: #dc2626; }
.bg-red-50 { background-color: #fef2f2; }
.bg-amber-50 { background-color: #fffbeb; }
.bg-amber-500 { background-color: #f59e0b; }
.border-red-200 { border-color: #fecaca; }
.border-amber-200 { border-color: #fde68a; }
/* ── Borders ── */
.border { border-width: 1px; border-style: solid; }
.border-b { border-bottom-width: 1px; border-bottom-style: solid; }
.border-t { border-top-width: 1px; border-top-style: solid; }
/* ── Shadow ── */
.shadow-sm { box-shadow: 0 1px 2px 0 rgba(0,0,0,0.05); }
.shadow { box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1); }
/* ── Active states ── */
.active\\:opacity-75:active { opacity: 0.75; }
.active\\:opacity-80:active { opacity: 0.80; }
/* ── Opacity ── */
.opacity-50 { opacity: 0.5; }
.opacity-70 { opacity: 0.7; }
</style>`;

function injectCssIntoHtml(html: string): string {
  // If already injected, skip
  if (html.includes('id="gnzl-styles"')) return html;
  // Inject right before </head>
  if (html.includes("</head>")) {
    return html.replace("</head>", `${CSS_INJECTION}</head>`);
  }
  // Fallback: prepend
  return CSS_INJECTION + html;
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

function buildVerificationResultPage(success: boolean, message: string): string {
  const icon = success ? "✅" : "❌";
  const title = success ? "Email Verified" : "Verification Failed";
  const color = success ? "#22C55E" : "#EF4444";
  // manusguidednzlogbook is the scheme auto-derived from bundle ID com.app.guidednzlogbook
  // drivelegal:// is registered as a secondary scheme but manus scheme is what EAS builds use
  const APP_SCHEME = "manusguidednzlogbook";
  // App Store link as fallback if the app is not installed
  const APP_STORE_URL = "https://apps.apple.com/app/id6745786048";
  const deepLinkUrl = `${APP_SCHEME}://login`;
  const successButton = `
    <a href="${deepLinkUrl}" class="btn" id="openBtn">Open Drive Legal</a>
    <p style="margin-top:12px;font-size:13px;color:#9BA8C0;">
      If the app doesn't open, <a href="${APP_STORE_URL}" style="color:#5980E9;">download it from the App Store</a>.
    </p>
    <script>
      // Attempt deep link; if app not installed, redirect to App Store after 2.5s
      document.getElementById('openBtn').addEventListener('click', function(e) {
        e.preventDefault();
        window.location.href = '${deepLinkUrl}';
        setTimeout(function() {
          // Only redirect if the page is still visible (app didn't open)
          if (!document.hidden) {
            window.location.href = '${APP_STORE_URL}';
          }
        }, 2500);
      });
    </script>`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — Drive Legal</title>
  <style>
    body { margin:0; padding:0; background:#F0F4FF; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; display:flex; align-items:center; justify-content:center; min-height:100vh; }
    .card { background:#fff; border-radius:16px; padding:48px 32px; max-width:420px; width:90%; text-align:center; box-shadow:0 4px 24px rgba(0,51,102,0.08); }
    .icon { font-size:48px; margin-bottom:16px; }
    h1 { color:#003366; font-size:24px; margin:0 0 12px; }
    p { color:#4A5568; font-size:15px; line-height:1.6; margin:0 0 24px; }
    .btn { display:inline-block; background:#5980E9; color:#fff; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:700; font-size:15px; }
    .footer { margin-top:32px; font-size:12px; color:#9BA8C0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1 style="color:${color}">${title}</h1>
    <p>${message}</p>
    ${success ? successButton : '<p style="font-size:13px;color:#6B7A99;">Open the Drive Legal app and request a new verification email.</p>'}
    <div class="footer">&copy; ${new Date().getFullYear()} Drive Legal — Electronic Logbook — Built to NZTA Work Time and Logbooks Rule requirements</div>
  </div>
</body>
</html>`;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // Operator/Employer Portal
  app.use("/portal", portalRouter);

  // Admin Dashboard
  app.use("/admin", adminRouter);

  // Password-protected Excel export (server-side, uses xlsx-populate for real AES encryption)
  app.use("/api/export/excel-protected", excelProtectedRouter);
  // General export endpoints (PDF/Excel/CSV) — used by native iOS instead of banned modules
  app.use("/api/export", exportRouter);

  // Legal documents — Terms & Conditions and Privacy Policy PDFs
  const publicDir = path.join(__dirname, "../public");
  app.get("/terms", (_req, res) => {
    const filePath = path.join(publicDir, "DriveLegalTC.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"DriveLegal-Terms-and-Conditions.pdf\"");
    res.sendFile(filePath);
  });
  app.get("/privacy", (_req, res) => {
    const filePath = path.join(publicDir, "DriveLegalPrivacy.pdf");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=\"DriveLegal-Privacy-Policy.pdf\"");
    res.sendFile(filePath);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Email verification link handler — processes token and shows result page
  app.get("/verify-email", async (req, res) => {
    const token = req.query.token as string | undefined;
    if (!token) {
      res.status(400).send(buildVerificationResultPage(false, "Missing verification token."));
      return;
    }
    try {
      const { getEmailVerificationToken, markDriverEmailVerified, deleteEmailVerificationToken } = await import("../db");
      const verificationToken = await getEmailVerificationToken(token);
      if (!verificationToken) {
        res.status(400).send(buildVerificationResultPage(false, "This verification link has expired or is invalid. Please request a new one from the app."));
        return;
      }
      const verified = await markDriverEmailVerified(verificationToken.email);
      await deleteEmailVerificationToken(token);
      if (!verified) {
        res.status(500).send(buildVerificationResultPage(false, "Failed to verify email. Please try again."));
        return;
      }
      res.send(buildVerificationResultPage(true, "Your email has been verified! You can now sign in to Drive Legal."));
    } catch (e) {
      console.error("[VerifyEmail] Error:", e);
      res.status(500).send(buildVerificationResultPage(false, "An error occurred. Please try again."));
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve Expo web static build
  const webDistPath = process.env.NODE_ENV === "production"
    ? path.resolve(__dirname, "web")
    : path.resolve(__dirname, "../../dist/web");

  // Serve non-HTML static assets directly (JS, CSS, images, fonts)
  app.use(
    express.static(webDistPath, {
      index: false, // disable auto index.html serving so we can inject CSS
      setHeaders: (res, filePath) => {
        if (filePath.endsWith(".js")) {
          res.setHeader("Content-Type", "application/javascript; charset=utf-8");
        } else if (filePath.endsWith(".css")) {
          res.setHeader("Content-Type", "text/css; charset=utf-8");
        }
      },
    })
  );

  // HTML handler — inject CSS at request time
  const serveHtmlWithCss = (htmlPath: string, res: express.Response) => {
    if (!fs.existsSync(htmlPath)) {
      // Fallback to index.html
      htmlPath = path.join(webDistPath, "index.html");
    }
    if (!fs.existsSync(htmlPath)) {
      res.status(404).send("Not found");
      return;
    }
    const html = fs.readFileSync(htmlPath, "utf8");
    const injected = injectCssIntoHtml(html);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.send(injected);
  };

  // SPA fallback — all non-API routes serve index.html with CSS injected
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const indexPath = path.join(webDistPath, "index.html");
    if (fs.existsSync(indexPath)) {
      serveHtmlWithCss(indexPath, res);
    } else {
      // No web export available — serve minimal landing page
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Drive Legal</title><style>body{margin:0;background:#003366;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;color:#fff}.c{text-align:center;padding:40px}h1{font-size:28px;margin:0 0 8px}p{opacity:.7;margin:8px 0}a{display:inline-block;margin-top:20px;background:#5980E9;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}</style></head><body><div class="c"><h1>Drive Legal</h1><p>Electronic logbook for NZ commercial drivers, built to NZTA Work Time and Logbooks Rule requirements.</p><a href="/admin">Admin Dashboard</a></div></body></html>`);
    }
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
