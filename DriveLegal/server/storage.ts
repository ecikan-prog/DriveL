import fs from "fs/promises";
import path from "path";

const STORAGE_ROOT =
  process.env.STORAGE_DIR?.trim() ||
  path.join(process.cwd(), "storage");

const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL ||
  process.env.RAILWAY_PUBLIC_DOMAIN ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

function normalizeBaseUrl(value: string): string {
  if (!value) {
    return "";
  }

  if (
    value.startsWith("http://") ||
    value.startsWith("https://")
  ) {
    return value.replace(/\/+$/, "");
  }

  return `https://${value.replace(/\/+$/, "")}`;
}

function getSafeKey(key: string): string {
  const normalizedKey = key
    .replace(/\\/g, "/")
    .replace(/^\/+/, "");

  const resolvedRoot = path.resolve(STORAGE_ROOT);
  const resolvedFile = path.resolve(
    STORAGE_ROOT,
    normalizedKey
  );

  if (
    resolvedFile !== resolvedRoot &&
    !resolvedFile.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error("Invalid storage key.");
  }

  return normalizedKey;
}

function getFilePath(key: string): string {
  const safeKey = getSafeKey(key);

  return path.resolve(STORAGE_ROOT, safeKey);
}

function getPublicUrl(key: string): string {
  const safeKey = getSafeKey(key);

  const encodedPath = safeKey
    .split("/")
    .map((section) => encodeURIComponent(section))
    .join("/");

  const relativeUrl = `/storage/${encodedPath}`;
  const baseUrl = normalizeBaseUrl(PUBLIC_BASE_URL);

  if (!baseUrl) {
    return relativeUrl;
  }

  return `${baseUrl}${relativeUrl}`;
}

async function ensureDirectory(
  directoryPath: string
): Promise<void> {
  await fs.mkdir(directoryPath, {
    recursive: true,
  });
}

/**
 * Saves a file and returns its public URL.
 */
export async function storagePut(
  key: string,
  data: Buffer,
  contentType: string
): Promise<{
  url: string;
  key: string;
  contentType: string;
}> {
  const safeKey = getSafeKey(key);
  const filePath = getFilePath(safeKey);

  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, data);

  return {
    key: safeKey,
    url: getPublicUrl(safeKey),
    contentType,
  };
}

/**
 * Reads a stored file.
 */
export async function storageGet(
  key: string
): Promise<Buffer | null> {
  try {
    const filePath = getFilePath(key);

    return await fs.readFile(filePath);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Deletes a stored file.
 */
export async function storageDelete(
  key: string
): Promise<void> {
  try {
    const filePath = getFilePath(key);

    await fs.unlink(filePath);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}

/**
 * Returns the local storage root for Express static hosting.
 */
export function getStorageRoot(): string {
  return STORAGE_ROOT;
}

/**
 * Creates the storage directory at server startup.
 */
export async function initializeStorage(): Promise<void> {
  await ensureDirectory(STORAGE_ROOT);
}
