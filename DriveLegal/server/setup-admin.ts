import "dotenv/config";

import {
  hashAdminPassword,
  normaliseAdminEmail,
  validateAdminPassword,
} from "./admin-auth";
import { query } from "./db";

async function main() {
  const name = process.env.ADMIN_SETUP_NAME?.trim() || "Drive Legal Administrator";
  const email = normaliseAdminEmail(process.env.ADMIN_SETUP_EMAIL ?? "");
  const password = process.env.ADMIN_SETUP_PASSWORD ?? "";
  const role = (process.env.ADMIN_SETUP_ROLE?.trim() || "admin").toLowerCase();
  const isActive =
    process.env.ADMIN_SETUP_ACTIVE?.trim().toLowerCase() !== "false";

  if (!email) {
    throw new Error("ADMIN_SETUP_EMAIL is required");
  }

  const passwordError = validateAdminPassword(password);

  if (passwordError) {
    throw new Error(`ADMIN_SETUP_PASSWORD invalid: ${passwordError}`);
  }

  if (role !== "admin") {
    throw new Error("ADMIN_SETUP_ROLE must be 'admin' for portal access");
  }

  const passwordHash = hashAdminPassword(password);

  await query(
    `
      INSERT INTO admin_accounts (
        name,
        email,
        passwordHash,
        role,
        isActive,
        sessionVersion,
        lastLogin,
        passwordResetTokenHash,
        passwordResetRequestedAt,
        passwordResetExpiresAt,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, ?, 0, NULL, NULL, NULL, NULL, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        passwordHash = VALUES(passwordHash),
        role = VALUES(role),
        isActive = VALUES(isActive),
        sessionVersion = sessionVersion + 1,
        passwordResetTokenHash = NULL,
        passwordResetRequestedAt = NULL,
        passwordResetExpiresAt = NULL,
        updatedAt = NOW()
    `,
    [name, email, passwordHash, role, isActive],
  );

  const rows = await query<{
    id: number;
    email: string;
    role: string;
    isActive: number | boolean;
  }>(
    `
      SELECT id, email, role, isActive
      FROM admin_accounts
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  const admin = rows[0];

  if (!admin) {
    throw new Error("Administrator setup failed");
  }

  console.log("Administrator account is ready.");
  console.log(`ID: ${admin.id}`);
  console.log(`Email: ${admin.email}`);
  console.log(`Role: ${admin.role}`);
  console.log(`Active: ${admin.isActive ? "yes" : "no"}`);
}

main().catch((error) => {
  console.error("[ADMIN SETUP ERROR]", error);
  process.exit(1);
});
