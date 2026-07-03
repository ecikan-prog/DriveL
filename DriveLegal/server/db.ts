import { eq, and, desc, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, drivers, shiftLogs, operators, operatorDrivers, passwordResetTokens, emailVerificationTokens, InsertDriver, InsertShiftLog, InsertOperator } from "../drizzle/schema";
import crypto from "crypto";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Driver Auth ─────────────────────────────────────────────────────────────

export async function getDriverByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getDriverByLocalUserId(localUserId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.localUserId, localUserId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function upsertDriver(driver: InsertDriver): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.insert(drivers).values(driver).onDuplicateKeyUpdate({
    set: {
      name: driver.name,
      passwordHash: driver.passwordHash,
      licenceNumber: driver.licenceNumber,
      vehicleRegistration: driver.vehicleRegistration,
      vehicleType: driver.vehicleType,
      driverType: driver.driverType,
      tslNumber: driver.tslNumber,
      trialStartDate: driver.trialStartDate,
    },
  });
}

// ─── Shift Logs ──────────────────────────────────────────────────────────────

export async function pushShiftLogs(logs: InsertShiftLog[]): Promise<{ inserted: number; skipped: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  let inserted = 0;
  let skipped = 0;

  for (const log of logs) {
    try {
      await db.insert(shiftLogs).values(log).onDuplicateKeyUpdate({
        // If logId already exists, do nothing (idempotent push)
        set: { logId: log.logId },
      });
      inserted++;
    } catch (e: any) {
      // Duplicate key — already synced
      if (e?.code === "ER_DUP_ENTRY") {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  return { inserted, skipped };
}

export async function getShiftLogsByDriver(driverLocalUserId: string) {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(shiftLogs)
    .where(eq(shiftLogs.driverLocalUserId, driverLocalUserId))
    .orderBy(desc(shiftLogs.startTime));
}

export async function getShiftLogsSince(driverLocalUserId: string, sinceLogId?: string) {
  const db = await getDb();
  if (!db) return [];

  // Return all logs for the driver (client will deduplicate)
  return db
    .select()
    .from(shiftLogs)
    .where(eq(shiftLogs.driverLocalUserId, driverLocalUserId))
    .orderBy(desc(shiftLogs.startTime));
}

export async function getLatestHashForDriver(driverLocalUserId: string): Promise<{ hash: string; logId: string } | null> {
  const db = await getDb();
  if (!db) return null;

  const result = await db
    .select({ hash: shiftLogs.hash, logId: shiftLogs.logId })
    .from(shiftLogs)
    .where(eq(shiftLogs.driverLocalUserId, driverLocalUserId))
    .orderBy(desc(shiftLogs.startTime))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

// ─── Operator Portal ──────────────────────────────────────────────────────────

export async function getOperatorByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(operators).where(eq(operators.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createOperator(data: InsertOperator): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(operators).values(data).onDuplicateKeyUpdate({
    set: { companyName: data.companyName, contactName: data.contactName, passwordHash: data.passwordHash },
  });
}

export async function getOperatorDrivers(operatorId: number) {
  const db = await getDb();
  if (!db) return [];

  const links = await db.select().from(operatorDrivers).where(eq(operatorDrivers.operatorId, operatorId));
  if (links.length === 0) return [];

  // Get driver details for each linked driver
  const driverIds = links.map((l) => l.driverLocalUserId);
  const driverResults = [];
  for (const driverId of driverIds) {
    const driver = await db.select().from(drivers).where(eq(drivers.localUserId, driverId)).limit(1);
    if (driver.length > 0) {
      driverResults.push(driver[0]);
    }
  }
  return driverResults;
}

export async function getDriverShiftLogs(driverLocalUserId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(shiftLogs)
    .where(eq(shiftLogs.driverLocalUserId, driverLocalUserId))
    .orderBy(desc(shiftLogs.startTime))
    .limit(100);
}

export async function linkDriverToOperator(operatorId: number, driverLocalUserId: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Check if already linked
  const existing = await db.select().from(operatorDrivers)
    .where(and(eq(operatorDrivers.operatorId, operatorId), eq(operatorDrivers.driverLocalUserId, driverLocalUserId)))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(operatorDrivers).values({ operatorId, driverLocalUserId });
}

export async function getAllDrivers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers);
}

// ─── Password Reset Tokens ──────────────────────────────────────────────────

export async function createResetToken(email: string, userType: "driver" | "operator"): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete any existing tokens for this email
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.email, email));

  // Generate secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await db.insert(passwordResetTokens).values({
    email,
    token,
    userType,
    expiresAt,
  });

  return token;
}

export async function getResetToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(passwordResetTokens)
    .where(eq(passwordResetTokens.token, token))
    .limit(1);

  if (result.length === 0) return undefined;

  const row = result[0];
  // Check expiry
  if (new Date() > row.expiresAt) {
    // Token expired — delete it
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.id, row.id));
    return undefined;
  }

  return row;
}

export async function deleteResetToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(passwordResetTokens).where(eq(passwordResetTokens.token, token));
}

export async function updateDriverPassword(email: string, newPasswordHash: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(drivers).set({ passwordHash: newPasswordHash }).where(eq(drivers.email, email));
  return (result as any)[0]?.affectedRows > 0;
}

export async function updateOperatorPassword(email: string, newPasswordHash: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(operators).set({ passwordHash: newPasswordHash }).where(eq(operators.email, email));
  return (result as any)[0]?.affectedRows > 0;
}

// ─── Email Verification ─────────────────────────────────────────────────────────────────

export async function createEmailVerificationToken(email: string): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete any existing tokens for this email
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.email, email));

  // Generate secure random token
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.insert(emailVerificationTokens).values({
    email,
    token,
    expiresAt,
  });

  return token;
}

export async function getEmailVerificationToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;

  const result = await db.select().from(emailVerificationTokens)
    .where(eq(emailVerificationTokens.token, token))
    .limit(1);

  if (result.length === 0) return undefined;

  const row = result[0];
  // Check expiry
  if (new Date() > row.expiresAt) {
    await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.id, row.id));
    return undefined;
  }

  return row;
}

export async function deleteEmailVerificationToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.token, token));
}

export async function markDriverEmailVerified(email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.update(drivers).set({ emailVerified: true }).where(eq(drivers.email, email));
  return (result as any)[0]?.affectedRows > 0;
}
