import fs from "fs";
import path from "path";

const STORAGE_ROOT =
  process.env.STORAGE_DIR ||
  path.join(process.cwd(), "storage");

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Save file and return public URL
 */
export async function storagePut(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{ url: string }> {
  const safeKey = key.replace(/^\/+/, "");
  const filePath = path.join(STORAGE_ROOT, safeKey);

  ensureDir(path.dirname(filePath));

  fs.writeFileSync(filePath, data);

  return {
    url: `/storage/${safeKey}`,
  };
}

/**
 * Read file
 */
export async function storageGet(key: string): Promise<Buffer | null> {
  const filePath = path.join(STORAGE_ROOT, key);
  if (!fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath);
}

/**
 * Delete file
 */
export async function storageDelete(key: string): Promise<void> {
  const filePath = path.join(STORAGE_ROOT, key);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

// Ensure folder exists at startup
ensureDir(STORAGE_ROOT);