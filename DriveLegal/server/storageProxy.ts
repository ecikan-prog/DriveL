import fs from "fs";
import path from "path";
import { Request, Response, Express } from "express";

/**
 * Simple storage system for Railway + local dev
 * - Stores files under /tmp (Railway safe)
 * - Falls back to local /uploads in dev
 */

const isProd = process.env.NODE_ENV === "production";
const baseDir = isProd ? "/tmp/drivelegal" : path.join(process.cwd(), "uploads");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save file buffer to storage
 */
export async function storagePut(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ url: string }> {
  const filePath = path.join(baseDir, key);
  ensureDir(path.dirname(filePath));

  fs.writeFileSync(filePath, data);

  return {
    url: `/storage/${key}`,
  };
}

/**
 * Express middleware to serve stored files
 */
export function registerStorageProxy(app: Express) {
  ensureDir(baseDir);

  app.get("/storage/*", (req: Request, res: Response) => {
    const filePath = path.join(baseDir, req.path.replace("/storage/", ""));

    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.sendFile(filePath);
  });
}