import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing Manus OAuth auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Drive Legal driver profiles — stores driver-specific data for cloud sync.
 * Keyed by a stable local userId (string) so the same driver can link to
 * Manus OAuth or use local-only auth.
 */
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  /** Stable local user ID (e.g. "demo_nzta_reviewer_2026" or UUID) */
  localUserId: varchar("localUserId", { length: 128 }).notNull().unique(),
  /** Email used for local auth login */
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Simple hash of password for local auth verification on server */
  passwordHash: varchar("passwordHash", { length: 64 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  licenceNumber: varchar("licenceNumber", { length: 64 }),
  vehicleRegistration: varchar("vehicleRegistration", { length: 32 }),
  vehicleType: varchar("vehicleType", { length: 64 }),
  driverType: mysqlEnum("driverType", ["goods", "large_passenger", "small_passenger", "vehicle_recovery"]).default("small_passenger").notNull(),
  /** Transport Service Licence number (e.g. 0342026 — no TSL- prefix) */
  tslNumber: varchar("tslNumber", { length: 64 }),
  /** NZ Driver Licence Class (e.g. 1, 2, 4, P) */
  licenceClass: varchar("licenceClass", { length: 16 }),
  /** Licence expiry date (YYYY-MM-DD) */
  licenceExpiry: varchar("licenceExpiry", { length: 10 }),
  /** Operator/Company name (TSL holder — may differ from driver name) */
  operatorName: varchar("operatorName", { length: 255 }),
  /** Whether the driver has verified their email address */
  emailVerified: boolean("emailVerified").default(false).notNull(),
  trialStartDate: varchar("trialStartDate", { length: 32 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

/**
 * Completed shift logs — stores the full DailyLog JSON plus hash chain data.
 * Each row is one completed shift. The canonical JSON used for hashing is
 * stored verbatim to guarantee hash reproducibility across devices.
 */
export const shiftLogs = mysqlTable("shift_logs", {
  id: int("id").autoincrement().primaryKey(),
  /** Matches DailyLog.id (e.g. "userId_startTimeISO") */
  logId: varchar("logId", { length: 255 }).notNull().unique(),
  /** Driver's local user ID */
  driverLocalUserId: varchar("driverLocalUserId", { length: 128 }).notNull(),
  /** Date of the shift (YYYY-MM-DD) */
  date: varchar("date", { length: 10 }).notNull(),
  /** Full DailyLog object as JSON */
  logData: json("logData").notNull(),
  /** The exact canonical JSON string used to compute the SHA-256 hash */
  canonicalJson: text("canonicalJson").notNull(),
  /** SHA-256 hash of this log entry in the chain */
  hash: varchar("hash", { length: 128 }).notNull(),
  /** Previous hash in the chain (empty string for first entry) */
  previousHash: varchar("previousHash", { length: 128 }).notNull(),
  /** Timestamp when the hash was computed */
  hashTimestamp: varchar("hashTimestamp", { length: 32 }).notNull(),
  /** Shift start time (ISO) for ordering */
  startTime: varchar("startTime", { length: 32 }).notNull(),
  /** Shift end time (ISO) */
  endTime: varchar("endTime", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShiftLog = typeof shiftLogs.$inferSelect;
export type InsertShiftLog = typeof shiftLogs.$inferInsert;

/**
 * Operator/Employer accounts — separate from drivers.
 * Operators can view their linked drivers' shift records read-only.
 */
export const operators = mysqlTable("operators", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 320 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 64 }).notNull(),
  companyName: varchar("companyName", { length: 255 }).notNull(),
  contactName: varchar("contactName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Operator = typeof operators.$inferSelect;
export type InsertOperator = typeof operators.$inferInsert;

/**
 * Links operators to their drivers — one operator can have many drivers.
 */
export const operatorDrivers = mysqlTable("operator_drivers", {
  id: int("id").autoincrement().primaryKey(),
  operatorId: int("operatorId").notNull(),
  driverLocalUserId: varchar("driverLocalUserId", { length: 128 }).notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});

export type OperatorDriver = typeof operatorDrivers.$inferSelect;
export type InsertOperatorDriver = typeof operatorDrivers.$inferInsert;

/**
 * Password reset tokens — used for "Forgot Password" flows.
 * Tokens expire after 1 hour. Supports both drivers and operators.
 */
export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  /** Email of the user requesting reset */
  email: varchar("email", { length: 320 }).notNull(),
  /** Secure random token (hex) */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** 'driver' or 'operator' */
  userType: mysqlEnum("userType", ["driver", "operator"]).notNull(),
  /** Expiry timestamp (1 hour from creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * Email verification tokens — sent on registration, expire after 24 hours.
 */
export const emailVerificationTokens = mysqlTable("email_verification_tokens", {
  id: int("id").autoincrement().primaryKey(),
  /** Email of the driver */
  email: varchar("email", { length: 320 }).notNull(),
  /** Secure random token (hex) */
  token: varchar("token", { length: 128 }).notNull().unique(),
  /** Expiry timestamp (24 hours from creation) */
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = typeof emailVerificationTokens.$inferInsert;
