import mysql from "mysql2/promise";

/**
 * Railway MySQL connection
 * Set DATABASE_URL in Railway environment variables
 */

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("[DB] DATABASE_URL is not set. Running in offline mode.");
}

export const pool = DATABASE_URL
  ? mysql.createPool(DATABASE_URL)
  : null;

/**
 * Safe query helper
 */
export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  if (!pool) throw new Error("Database not configured");

  const [rows] = await pool.execute(sql, params);
  return rows as T[];
}

/* ─────────────────────────────────────────────
   EMAIL VERIFICATION HELPERS
   ───────────────────────────────────────────── */

export async function getEmailVerificationToken(token: string) {
  const rows = await query<any>(
    "SELECT * FROM email_verification_tokens WHERE token = ? LIMIT 1",
    [token]
  );

  return rows[0] || null;
}

export async function markDriverEmailVerified(email: string) {
  const result = await query<any>(
    "UPDATE drivers SET email_verified = 1 WHERE email = ?",
    [email]
  );

  return (result as any).affectedRows > 0;
}

export async function deleteEmailVerificationToken(token: string) {
  await query(
    "DELETE FROM email_verification_tokens WHERE token = ?",
    [token]
  );
}

/* ─────────────────────────────────────────────
   OPTIONAL: future helpers (logs/users)
   ───────────────────────────────────────────── */

export async function getDriverByEmail(email: string) {
  const rows = await query<any>(
    "SELECT * FROM drivers WHERE email = ? LIMIT 1",
    [email]
  );

  return rows[0] || null;
}