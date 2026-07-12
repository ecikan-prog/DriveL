import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";

import { appRouter } from "./routers";
import { createContext } from "./context";

import { portalRouter } from "./portal";
import { excelProtectedRouter } from "./excel-protected";
import { exportRouter } from "./export-routes";
import { adminRouter } from "./admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

registerStorageProxy(app);
registerOAuthRoutes(app);

portalRouter(app);
adminRouter(app);
excelProtectedRouter(app);
exportRouter(app);

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);
const storagePath = path.join(process.cwd(), "storage");
app.use("/storage", express.static(storagePath));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get("/verify-email", async (req, res) => {
  const token = req.query.token as string;
  if (!token) return res.status(400).send("Missing token");
  try {
    const db = await import("./db");
    const record = await db.getEmailVerificationToken(token);
    if (!record) return res.status(400).send("Invalid or expired link");
    await db.markDriverEmailVerified(record.email);
    await db.deleteEmailVerificationToken(token);
    res.send("Email verified successfully");
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

const port = Number(process.env.PORT || 3000);
server.listen(port, "0.0.0.0", () => {
  console.log(`[server] running on port ${port}`);
});
