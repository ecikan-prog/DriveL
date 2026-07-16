import { initTRPC } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";

import { query } from "./db";
import {
  sendPasswordResetEmail,
  sendVerificationEmail,
} from "./email";

const t = initTRPC.create();

const DRIVER_TYPES = [
  "goods",
  "large_passenger",
  "small_passenger",
  "vehicle_recovery",
] as const;

const driverTypeSchema = z.enum(DRIVER_TYPES);

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function createSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function createExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

console.log("ROUTERS FILE LOADED");

export const appRouter = t.router({
  /**
   * Health check
   */
  health: t.procedure.query(() => {
    return {
      status: "ok",
    };
  }),

  /**
   * Driver authentication
   *
   * App endpoints:
   * driverAuth.register
   * driverAuth.login
   * driverAuth.resendVerification
   * driverAuth.verifyEmail
   * driverAuth.forgotPassword
   * driverAuth.resetPassword
   * driverAuth.updateProfile
   */
  driverAuth: t.router({
    /**
     * Register a new driver and send verification email.
     */
    register: t.procedure
      .input(
        z.object({
          localUserId: z.string().min(1).max(128),
          email: z.string().email(),
          passwordHash: z.string().min(1).max(128),
          name: z.string().min(2).max(255),

          tslNumber: z.string().max(64).optional(),
          operatorName: z.string().max(255).optional(),

          licenceNumber: z.string().max(64).optional(),
          licenceClass: z.string().max(16).optional(),
          licenceExpiry: z.string().max(32).optional(),

          vehicleRegistration: z.string().max(32).optional(),
          vehicleType: z.string().max(64).optional(),

          driverType: driverTypeSchema.default("small_passenger"),
          trialStartDate: z.string().max(32).optional(),
          baseUrl: z.string().url(),
        })
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const existing = await query<any[]>(
            `
            SELECT
              id,
              emailVerified
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email]
          );

          if (existing.length > 0) {
            return {
              success: false,
              error: "An account already exists with this email address.",
            };
          }

          await query(
            `
            INSERT INTO drivers (
              localUserId,
              email,
              passwordHash,
              name,
              licenceNumber,
              vehicleRegistration,
              vehicleType,
              driverType,
              tslNumber,
              licenceClass,
              licenceExpiry,
              operatorName,
              emailVerified,
              trialStartDate
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?)
            `,
            [
              input.localUserId,
              email,
              input.passwordHash,
              input.name.trim(),
              input.licenceNumber?.trim() || null,
              input.vehicleRegistration?.trim() || null,
              input.vehicleType?.trim() || null,
              input.driverType,
              input.tslNumber?.trim() || null,
              input.licenceClass?.trim() || null,
              input.licenceExpiry?.trim() || null,
              input.operatorName?.trim() || null,
              input.trialStartDate || new Date().toISOString(),
            ]
          );

          await query(
            `
            DELETE FROM email_verification_tokens
            WHERE email = ?
            `,
            [email]
          );

          const verificationToken = createSecureToken();
          const verificationExpiry = createExpiry(24);

          await query(
            `
            INSERT INTO email_verification_tokens (
              email,
              token,
              expiresAt
            )
            VALUES (?, ?, ?)
            `,
            [email, verificationToken, verificationExpiry]
          );

          const emailSent = await sendVerificationEmail(
            email,
            input.name.trim(),
            verificationToken,
            input.baseUrl
          );

          if (!emailSent) {
  console.error(
    `[DriverAuth] Registration succeeded but verification email failed for ${email}`
  );

  // The account and verification token already exist.
  // Send the user to the verification screen so they can retry.
  return {
    success: true,
    verificationRequired: true,
    email,
    emailSent: false,
    message:
      "Your account was created, but the verification email could not be sent. Please tap Resend Verification Email.",
  };
}

          return {
            success: true,
            verificationRequired: true,
            email,
          };
        } catch (error) {
          console.error("[DriverAuth] Registration failed:", error);

          return {
            success: false,
            error: "Registration failed. Please try again.",
          };
        }
      }),

    /**
     * Login using the password hash supplied by the app.
     */
    login: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          passwordHash: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const rows = await query<any[]>(
            `
            SELECT
              localUserId,
              email,
              passwordHash,
              name,
              tslNumber,
              operatorName,
              licenceNumber,
              licenceClass,
              licenceExpiry,
              vehicleRegistration,
              vehicleType,
              driverType,
              trialStartDate,
              emailVerified
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email]
          );

          if (rows.length === 0) {
            return {
              success: false,
              error: "Invalid email address or password.",
            };
          }

          const driver = rows[0];

          if (driver.passwordHash !== input.passwordHash) {
            return {
              success: false,
              error: "Invalid email address or password.",
            };
          }

          if (!driver.emailVerified) {
            return {
              success: false,
              verificationRequired: true,
              email,
              error: "Please verify your email address before signing in.",
            };
          }

          return {
            success: true,
            driver: {
              localUserId: driver.localUserId,
              email: driver.email,
              name: driver.name,
              tslNumber: driver.tslNumber,
              operatorName: driver.operatorName,
              licenceNumber: driver.licenceNumber,
              licenceClass: driver.licenceClass,
              licenceExpiry: driver.licenceExpiry,
              vehicleRegistration: driver.vehicleRegistration,
              vehicleType: driver.vehicleType,
              driverType: driver.driverType,
              trialStartDate: driver.trialStartDate,
            },
          };
        } catch (error) {
          console.error("[DriverAuth] Login failed:", error);

          return {
            success: false,
            error: "Unable to sign in. Please try again.",
          };
        }
      }),

    /**
     * Send a fresh email verification link.
     */
    resendVerification: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          baseUrl: z.string().url(),
        })
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const rows = await query<any[]>(
            `
            SELECT
              name,
              emailVerified
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email]
          );

          if (rows.length === 0) {
            return {
              success: false,
              message: "No Drive Legal account was found for this email.",
            };
          }

          const driver = rows[0];

          if (driver.emailVerified) {
            return {
              success: false,
              message: "This email address has already been verified.",
            };
          }

          await query(
            `
            DELETE FROM email_verification_tokens
            WHERE email = ?
            `,
            [email]
          );

          const verificationToken = createSecureToken();
          const verificationExpiry = createExpiry(24);

          await query(
            `
            INSERT INTO email_verification_tokens (
              email,
              token,
              expiresAt
            )
            VALUES (?, ?, ?)
            `,
            [email, verificationToken, verificationExpiry]
          );

          const emailSent = await sendVerificationEmail(
            email,
            driver.name || "",
            verificationToken,
            input.baseUrl
          );

          if (!emailSent) {
            return {
              success: false,
              message:
                "The verification email could not be sent. Please try again.",
            };
          }

          return {
            success: true,
            message: "A new verification email has been sent.",
          };
        } catch (error) {
          console.error(
            "[DriverAuth] Resend verification failed:",
            error
          );

          return {
            success: false,
            message:
              "The verification email could not be sent. Please try again.",
          };
        }
      }),

    /**
     * Verify an email token.
     */
    verifyEmail: t.procedure
      .input(
        z.object({
          token: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const tokenRows = await query<any[]>(
            `
            SELECT
              email,
              expiresAt
            FROM email_verification_tokens
            WHERE token = ?
            LIMIT 1
            `,
            [input.token]
          );

          if (tokenRows.length === 0) {
            return {
              success: false,
              error: "This verification link is invalid or has already been used.",
            };
          }

          const tokenRecord = tokenRows[0];
          const expiryTime = new Date(tokenRecord.expiresAt).getTime();

          if (
            !Number.isFinite(expiryTime) ||
            expiryTime <= Date.now()
          ) {
            await query(
              `
              DELETE FROM email_verification_tokens
              WHERE token = ?
              `,
              [input.token]
            );

            return {
              success: false,
              error:
                "This verification link has expired. Please request a new one.",
            };
          }

          await query(
            `
            UPDATE drivers
            SET emailVerified = true
            WHERE email = ?
            `,
            [tokenRecord.email]
          );

          await query(
            `
            DELETE FROM email_verification_tokens
            WHERE email = ?
            `,
            [tokenRecord.email]
          );

          return {
            success: true,
          };
        } catch (error) {
          console.error("[DriverAuth] Email verification failed:", error);

          return {
            success: false,
            error: "Email verification failed. Please try again.",
          };
        }
      }),

    /**
     * Request a password reset email.
     */
    forgotPassword: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          baseUrl: z.string().url(),
        })
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const rows = await query<any[]>(
            `
            SELECT name
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email]
          );

          /*
           * Return a neutral response even when the email does not exist.
           * This avoids revealing registered account addresses.
           */
          if (rows.length === 0) {
            return {
              success: true,
              message:
                "If an account exists for this email, a password reset link will be sent.",
            };
          }

          await query(
            `
            DELETE FROM password_reset_tokens
            WHERE email = ?
              AND userType = 'driver'
            `,
            [email]
          );

          const resetToken = createSecureToken();
          const resetExpiry = createExpiry(1);

          await query(
            `
            INSERT INTO password_reset_tokens (
              email,
              token,
              userType,
              expiresAt
            )
            VALUES (?, ?, 'driver', ?)
            `,
            [email, resetToken, resetExpiry]
          );

          const emailSent = await sendPasswordResetEmail(
            email,
            rows[0].name || "",
            resetToken,
            input.baseUrl,
            "driver"
          );

          if (!emailSent) {
            return {
              success: false,
              error:
                "The password reset email could not be sent. Please try again.",
            };
          }

          return {
            success: true,
            message:
              "If an account exists for this email, a password reset link will be sent.",
          };
        } catch (error) {
          console.error("[DriverAuth] Forgot password failed:", error);

          return {
            success: false,
            error:
              "The password reset request could not be completed.",
          };
        }
      }),

    /**
     * Reset password using a valid token.
     */
    resetPassword: t.procedure
      .input(
        z.object({
          token: z.string().min(1),
          newPasswordHash: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const tokenRows = await query<any[]>(
            `
            SELECT
              email,
              expiresAt
            FROM password_reset_tokens
            WHERE token = ?
              AND userType = 'driver'
            LIMIT 1
            `,
            [input.token]
          );

          if (tokenRows.length === 0) {
            return {
              success: false,
              error: "This password reset link is invalid or has already been used.",
            };
          }

          const tokenRecord = tokenRows[0];
          const expiryTime = new Date(tokenRecord.expiresAt).getTime();

          if (
            !Number.isFinite(expiryTime) ||
            expiryTime <= Date.now()
          ) {
            await query(
              `
              DELETE FROM password_reset_tokens
              WHERE token = ?
              `,
              [input.token]
            );

            return {
              success: false,
              error:
                "This password reset link has expired. Please request a new one.",
            };
          }

          await query(
            `
            UPDATE drivers
            SET passwordHash = ?
            WHERE email = ?
            `,
            [input.newPasswordHash, tokenRecord.email]
          );

          await query(
            `
            DELETE FROM password_reset_tokens
            WHERE email = ?
              AND userType = 'driver'
            `,
            [tokenRecord.email]
          );

          return {
            success: true,
          };
        } catch (error) {
          console.error("[DriverAuth] Password reset failed:", error);

          return {
            success: false,
            error: "The password could not be reset. Please try again.",
          };
        }
      }),

    /**
     * Update the driver's profile information.
     */
    updateProfile: t.procedure
      .input(
        z.object({
          localUserId: z.string().min(1),
          name: z.string().max(255).optional(),
          tslNumber: z.string().max(64).optional(),
          operatorName: z.string().max(255).optional(),
          licenceNumber: z.string().max(64).optional(),
          licenceClass: z.string().max(16).optional(),
          licenceExpiry: z.string().max(32).optional(),
          vehicleRegistration: z.string().max(32).optional(),
          vehicleType: z.string().max(64).optional(),
          driverType: driverTypeSchema.optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const existing = await query<any[]>(
            `
            SELECT id
            FROM drivers
            WHERE localUserId = ?
            LIMIT 1
            `,
            [input.localUserId]
          );

          if (existing.length === 0) {
            return {
              success: false,
              error: "Driver account was not found.",
            };
          }

          await query(
            `
            UPDATE drivers
            SET
              name = COALESCE(?, name),
              tslNumber = COALESCE(?, tslNumber),
              operatorName = COALESCE(?, operatorName),
              licenceNumber = COALESCE(?, licenceNumber),
              licenceClass = COALESCE(?, licenceClass),
              licenceExpiry = COALESCE(?, licenceExpiry),
              vehicleRegistration = COALESCE(?, vehicleRegistration),
              vehicleType = COALESCE(?, vehicleType),
              driverType = COALESCE(?, driverType)
            WHERE localUserId = ?
            `,
            [
              input.name?.trim() || null,
              input.tslNumber?.trim() || null,
              input.operatorName?.trim() || null,
              input.licenceNumber?.trim() || null,
              input.licenceClass?.trim() || null,
              input.licenceExpiry?.trim() || null,
              input.vehicleRegistration?.trim() || null,
              input.vehicleType?.trim() || null,
              input.driverType || null,
              input.localUserId,
            ]
          );

          return {
            success: true,
          };
        } catch (error) {
          console.error("[DriverAuth] Profile update failed:", error);

          return {
            success: false,
            error: "Profile changes could not be saved.",
          };
        }
      }),
  }),

  /**
   * Cloud log synchronisation
   */
  sync: t.router({
    pushLogs: t.procedure
      .input(
        z.object({
          driverLocalUserId: z.string().min(1),
          logs: z.array(
            z.object({
              logId: z.string().min(1),
              date: z.string().min(1),
              logData: z.any(),
              canonicalJson: z.string(),
              hash: z.string(),
              previousHash: z.string(),
              hashTimestamp: z.string(),
              startTime: z.string(),
              endTime: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        let inserted = 0;
        let skipped = 0;

        try {
          for (const log of input.logs) {
            const existing = await query<any[]>(
              `
              SELECT id
              FROM shift_logs
              WHERE logId = ?
              LIMIT 1
              `,
              [log.logId]
            );

            if (existing.length > 0) {
              skipped += 1;
              continue;
            }

            await query(
              `
              INSERT INTO shift_logs (
                logId,
                driverLocalUserId,
                date,
                logData,
                canonicalJson,
                hash,
                previousHash,
                hashTimestamp,
                startTime,
                endTime
              )
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `,
              [
                log.logId,
                input.driverLocalUserId,
                log.date,
                JSON.stringify(log.logData),
                log.canonicalJson,
                log.hash,
                log.previousHash,
                log.hashTimestamp,
                log.startTime,
                log.endTime,
              ]
            );

            inserted += 1;
          }

          return {
            success: true,
            inserted,
            skipped,
          };
        } catch (error) {
          console.error("[Sync] Push logs failed:", error);

          return {
            success: false,
            inserted,
            skipped,
          };
        }
      }),

    pullLogs: t.procedure
      .input(
        z.object({
          driverLocalUserId: z.string().min(1),
        })
      )
      .query(async ({ input }) => {
        try {
          const rows = await query<any[]>(
            `
            SELECT
              logId,
              date,
              logData,
              canonicalJson,
              hash,
              previousHash,
              hashTimestamp,
              startTime,
              endTime
            FROM shift_logs
            WHERE driverLocalUserId = ?
            ORDER BY startTime DESC
            `,
            [input.driverLocalUserId]
          );

          return {
            success: true,
            logs: rows.map((row) => ({
              ...row,
              logData:
                typeof row.logData === "string"
                  ? JSON.parse(row.logData)
                  : row.logData,
            })),
          };
        } catch (error) {
          console.error("[Sync] Pull logs failed:", error);

          return {
            success: false,
            logs: [],
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
