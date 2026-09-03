import { initTRPC } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";

import { query, withTransaction } from "./db";
import type { Context } from "./context";
import { hashDriverPassword, verifyDriverPassword } from "./driver-password";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

const t = initTRPC.context<Context>().create();

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
function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function createSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function createExpiry(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function createSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function createAppAccountToken(): string {
  return crypto.randomUUID();
}

function extractSessionToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/.exec(authHeader.trim());
  return match?.[1]?.trim() || null;
}

async function getDriverForSessionToken(
  authHeader: string | undefined,
): Promise<any | null> {
  const sessionToken = extractSessionToken(authHeader);

  if (!sessionToken) {
    return null;
  }

  const rows = await query<any>(
    `
    SELECT
      d.localUserId,
      d.email,
      d.name,
      d.dateOfBirth,
      d.tslNumber,
      d.operatorName,
      d.licenceNumber,
      d.licenceClass,
      d.licenceExpiry,
      d.vehicleRegistration,
      d.vehicleType,
      d.driverType,
      d.trialStartDate,
      d.createdAt,
      d.trialEndDate,
      d.appAccountToken,
      d.subscriptionStatus,
      d.subscriptionPlan,
      d.subscriptionId,
      d.currentPeriodEnd
    FROM driver_sessions s
    INNER JOIN drivers d
      ON d.localUserId = s.localUserId
    WHERE s.sessionToken = ?
      AND s.invalidatedAt IS NULL
      AND d.deletedAt IS NULL
    LIMIT 1
    `,
    [sessionToken],
  );

  const driver = rows[0] ?? null;

  if (!driver) {
    return null;
  }

  if (!driver.appAccountToken) {
    driver.appAccountToken = createAppAccountToken();

    await query(
      `
      UPDATE drivers
      SET
        appAccountToken = ?,
        updatedAt = NOW()
      WHERE localUserId = ?
      LIMIT 1
      `,
      [driver.appAccountToken, driver.localUserId],
    );
  }

  return driver;
}

async function requireDriverSession(
  authHeader: string | undefined,
  expectedLocalUserId?: string,
): Promise<
  | { ok: true; driver: any }
  | { ok: false; error: string; sessionInvalid: boolean }
> {
  const driver = await getDriverForSessionToken(authHeader);

  if (!driver) {
    return {
      ok: false,
      error: "Your Drive Legal session has expired. Please sign in again.",
      sessionInvalid: true,
    };
  }

  if (expectedLocalUserId && driver.localUserId !== expectedLocalUserId) {
    return {
      ok: false,
      error: "You are not authorised for this account.",
      sessionInvalid: false,
    };
  }

  return {
    ok: true,
    driver,
  };
}

function toDriverPayload(driver: any) {
  return {
    localUserId: driver.localUserId,
    email: driver.email,
    name: driver.name,
    dateOfBirth: driver.dateOfBirth,
    tslNumber: driver.tslNumber,
    operatorName: driver.operatorName,
    licenceNumber: driver.licenceNumber,
    licenceClass: driver.licenceClass,
    licenceExpiry: driver.licenceExpiry,
    vehicleRegistration: driver.vehicleRegistration,
    vehicleType: driver.vehicleType,
    driverType: driver.driverType,
    trialStartDate: driver.trialStartDate,
    createdAt: driver.createdAt,
    trialEndDate: driver.trialEndDate,
    appAccountToken: driver.appAccountToken,
    subscriptionStatus: driver.subscriptionStatus,
    subscriptionPlan: driver.subscriptionPlan,
    subscriptionId: driver.subscriptionId,
    currentPeriodEnd: driver.currentPeriodEnd,
  };
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
          password: z.string().min(1).max(256),
          name: z.string().min(2).max(255),
          dateOfBirth: z
            .string()
            .regex(
              /^(\d{4})-(\d{2})-(\d{2})$/,
              "Date of birth must use YYYY-MM-DD.",
            ),

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
        }),
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);
        const dateOfBirth = parseIsoDate(input.dateOfBirth);
        const passwordHash = hashDriverPassword(input.password);

        if (!dateOfBirth) {
          return {
            success: false,
            error: "Please enter a valid date of birth.",
          };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateOfBirth >= today) {
          return {
            success: false,
            error: "Date of birth cannot be in the future.",
          };
        }

        const age =
          today.getFullYear() -
          dateOfBirth.getFullYear() -
          (today.getMonth() < dateOfBirth.getMonth() ||
          (today.getMonth() === dateOfBirth.getMonth() &&
            today.getDate() < dateOfBirth.getDate())
            ? 1
            : 0);

        if (age < 18) {
          return {
            success: false,
            error: "Drivers must be at least 18 years old.",
          };
        }

        try {
          const existing = await query<any>(
            `
            SELECT
              id,
              emailVerified,
              deletedAt,
              appAccountToken
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email],
          );

          const trialStartDate =
            input.trialStartDate ?? new Date().toISOString();

          const trialEndDate = new Date(
            new Date(trialStartDate).getTime() + 21 * 24 * 60 * 60 * 1000,
          ).toISOString();

          if (existing.length > 0) {
            const ex = existing[0];
            if (ex.deletedAt) {
              const appAccountToken =
                ex.appAccountToken ?? createAppAccountToken();

              // Reactivate soft-deleted account
              await query(
                `
                UPDATE drivers
                SET
                  deletedAt = NULL,
                  status = 'active',
                  localUserId = ?,
                  passwordHash = ?,
                  trialStartDate = ?,
                  trialEndDate = ?,
                  appAccountToken = ?
                WHERE id = ?
                `,
                [
                  input.localUserId,
                  passwordHash,
                  trialStartDate,
                  trialEndDate,
                  appAccountToken,
                  ex.id,
                ],
              );

              // Remove any existing verification tokens and create a fresh one
              await query(
                `DELETE FROM email_verification_tokens WHERE email = ?`,
                [email],
              );

              const verificationToken = createSecureToken();
              const verificationExpiry = createExpiry(24);

              await query(
                `
                INSERT INTO email_verification_tokens (email, token, expiresAt)
                VALUES (?, ?, ?)
                `,
                [email, verificationToken, verificationExpiry],
              );

              const emailSent = await sendVerificationEmail(
                email,
                input.name.trim(),
                verificationToken,
                input.baseUrl,
              );

              if (!emailSent) {
                console.error(
                  `[DriverAuth] Reactivation succeeded but verification email failed for ${email}`,
                );
                return {
                  success: true,
                  verificationRequired: true,
                  email,
                  emailSent: false,
                  message:
                    "Your account was reactivated, but the verification email could not be sent. Please tap Resend Verification Email.",
                };
              }

              return {
                success: true,
                verificationRequired: true,
                email,
              };
            }

            // Not soft-deleted — block duplicate registrations
            return {
              success: false,
              error: "An account already exists with this email address.",
            };
          }

          const appAccountToken = createAppAccountToken();

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
              dateOfBirth,
              operatorName,
              emailVerified,
              trialStartDate,
              trialEndDate,
              appAccountToken,
              subscriptionStatus
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false, ?, ?, ?, ?)
            `,
            [
              input.localUserId,
              email,
              passwordHash,
              input.name.trim(),
              input.licenceNumber?.trim() || null,
              input.vehicleRegistration?.trim() || null,
              input.vehicleType?.trim() || null,
              input.driverType,
              input.tslNumber?.trim() || null,
              input.licenceClass?.trim() || null,
              input.licenceExpiry?.trim() || null,
              input.dateOfBirth.trim(),
              input.operatorName?.trim() || null,
              trialStartDate,
              trialEndDate,
              appAccountToken,
              "trial",
            ],
          );

          await query(
            `
            DELETE FROM email_verification_tokens
            WHERE email = ?
            `,
            [email],
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
            [email, verificationToken, verificationExpiry],
          );

          const emailSent = await sendVerificationEmail(
            email,
            input.name.trim(),
            verificationToken,
            input.baseUrl,
          );

          if (!emailSent) {
            console.error(
              `[DriverAuth] Registration succeeded but verification email failed for ${email}`,
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
     * Login using the plaintext password supplied by the app over HTTPS.
     */
    login: t.procedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1).max(256),
          legacyPasswordHash: z.string().min(1).max(128).optional(),
          legacyPasswordSha256: z.string().length(64).optional(),
          deviceId: z.string().min(1).max(128),
          deviceLabel: z.string().min(1).max(255),
          forceContinue: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          return await withTransaction(async (connection) => {
            const [rows] = await connection.execute<any[]>(
              `
              SELECT
                localUserId,
                email,
                passwordHash,
                name,
                dateOfBirth,
                tslNumber,
                operatorName,
                licenceNumber,
                licenceClass,
                licenceExpiry,
                vehicleRegistration,
                vehicleType,
                driverType,
                trialStartDate,
                createdAt,
                trialEndDate,
                appAccountToken,
                subscriptionStatus,
                subscriptionPlan,
                subscriptionId,
                currentPeriodEnd,
                emailVerified
              FROM drivers
              WHERE email = ?
                AND deletedAt IS NULL
              LIMIT 1
              FOR UPDATE
              `,
              [email],
            );

            if (rows.length === 0) {
              return {
                success: false,
                error: "Invalid email address or password.",
              };
            }

            const driver = rows[0];
            const appAccountToken =
              driver.appAccountToken || createAppAccountToken();
            const passwordCheck = verifyDriverPassword(
              input.password,
              driver.passwordHash,
              {
                simpleHash: input.legacyPasswordHash,
                sha256Hex: input.legacyPasswordSha256,
              },
            );

            if (!passwordCheck.matches) {
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

            const [sessionRows] = await connection.execute<any[]>(
              `
              SELECT sessionToken, deviceId, deviceLabel, createdAt
              FROM driver_sessions
              WHERE localUserId = ?
                AND invalidatedAt IS NULL
              ORDER BY createdAt DESC
              `,
              [driver.localUserId],
            );

            const hasOtherActiveDevice = sessionRows.some(
              (sessionRow) => sessionRow.deviceId !== input.deviceId,
            );

            if (hasOtherActiveDevice && !input.forceContinue) {
              return {
                success: false,
                sessionConflict: true,
                error: "This account is currently active on another device.",
              };
            }

            const sessionToken = createSessionToken();

            if (hasOtherActiveDevice) {
              await connection.execute(
                `
                UPDATE driver_sessions
                SET invalidatedAt = NOW()
                WHERE localUserId = ?
                  AND invalidatedAt IS NULL
                `,
                [driver.localUserId],
              );
            } else {
              await connection.execute(
                `
                UPDATE driver_sessions
                SET invalidatedAt = NOW()
                WHERE localUserId = ?
                  AND deviceId = ?
                  AND invalidatedAt IS NULL
                `,
                [driver.localUserId, input.deviceId],
              );
            }

            await connection.execute(
              `
              INSERT INTO driver_sessions (
                localUserId,
                sessionToken,
                deviceId,
                deviceLabel
              )
              VALUES (?, ?, ?, ?)
              `,
              [
                driver.localUserId,
                sessionToken,
                input.deviceId,
                input.deviceLabel ?? null,
              ],
            );

            if (passwordCheck.needsMigration || !driver.appAccountToken) {
              await connection.execute(
                `
                UPDATE drivers
                SET
                  passwordHash = ?,
                  appAccountToken = ?,
                  updatedAt = NOW()
                WHERE localUserId = ?
                LIMIT 1
                `,
                [
                  passwordCheck.nextHash ?? driver.passwordHash,
                  appAccountToken,
                  driver.localUserId,
                ],
              );
            }

            return {
              success: true,
              sessionToken,
              driver: toDriverPayload({
                ...driver,
                appAccountToken,
              }),
            };
          });
        } catch (error) {
          console.error("[DriverAuth] Login failed:", error);

          return {
            success: false,
            error: "Unable to sign in. Please try again.",
          };
        }
      }),

    currentSession: t.procedure.query(async ({ ctx }) => {
      try {
        const session = await requireDriverSession(ctx.authHeader);

        if (session.ok === false) {
          return {
            success: false,
            revoked: true,
            sessionInvalid: session.sessionInvalid,
            error: session.error,
          };
        }

        return {
          success: true,
          driver: toDriverPayload(session.driver),
        };
      } catch (error) {
        console.error("[DriverAuth] Current session failed:", error);

        return {
          success: false,
          error: "Unable to validate your session. Please try again.",
        };
      }
    }),

    logout: t.procedure.mutation(async ({ ctx }) => {
      try {
        const sessionToken = extractSessionToken(ctx.authHeader);

        if (!sessionToken) {
          return { success: true };
        }

        await query(
          `
              UPDATE driver_sessions
              SET
                invalidatedAt = NOW()
              WHERE sessionToken = ?
                AND invalidatedAt IS NULL
            `,
          [sessionToken],
        );

        return { success: true };
      } catch (error) {
        console.error("[DriverAuth] Logout failed:", error);

        return {
          success: false,
          error: "Unable to end the current session.",
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
        }),
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const rows = await query<any>(
            `
            SELECT
              name,
              emailVerified
            FROM drivers
            WHERE email = ?
              AND deletedAt IS NULL
            LIMIT 1
            `,
            [email],
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
            [email],
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
            [email, verificationToken, verificationExpiry],
          );

          const emailSent = await sendVerificationEmail(
            email,
            driver.name || "",
            verificationToken,
            input.baseUrl,
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
          console.error("[DriverAuth] Resend verification failed:", error);

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
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const tokenRows = await query<any>(
            `
            SELECT
              email,
              expiresAt
            FROM email_verification_tokens
            WHERE token = ?
            LIMIT 1
            `,
            [input.token],
          );

          if (tokenRows.length === 0) {
            return {
              success: false,
              error:
                "This verification link is invalid or has already been used.",
            };
          }

          const tokenRecord = tokenRows[0];
          const expiryTime = new Date(tokenRecord.expiresAt).getTime();

          if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
            await query(
              `
              DELETE FROM email_verification_tokens
              WHERE token = ?
              `,
              [input.token],
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
            [tokenRecord.email],
          );

          await query(
            `
            DELETE FROM email_verification_tokens
            WHERE email = ?
            `,
            [tokenRecord.email],
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
        }),
      )
      .mutation(async ({ input }) => {
        const email = normaliseEmail(input.email);

        try {
          const rows = await query<any>(
            `
            SELECT name
            FROM drivers
            WHERE email = ?
              AND deletedAt IS NULL
            LIMIT 1
            `,
            [email],
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
            [email],
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
            [email, resetToken, resetExpiry],
          );

          const emailSent = await sendPasswordResetEmail(
            email,
            rows[0].name || "",
            resetToken,
            input.baseUrl,
            "driver",
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
            error: "The password reset request could not be completed.",
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
          newPassword: z.string().min(1).max(256),
        }),
      )
      .mutation(async ({ input }) => {
        try {
          const newPasswordHash = hashDriverPassword(input.newPassword);
          const tokenRows = await query<any>(
            `
            SELECT
              email,
              expiresAt
            FROM password_reset_tokens
            WHERE token = ?
              AND userType = 'driver'
            LIMIT 1
            `,
            [input.token],
          );

          if (tokenRows.length === 0) {
            return {
              success: false,
              error:
                "This password reset link is invalid or has already been used.",
            };
          }

          const tokenRecord = tokenRows[0];
          const expiryTime = new Date(tokenRecord.expiresAt).getTime();

          if (!Number.isFinite(expiryTime) || expiryTime <= Date.now()) {
            await query(
              `
              DELETE FROM password_reset_tokens
              WHERE token = ?
              `,
              [input.token],
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
            [newPasswordHash, tokenRecord.email],
          );

          await query(
            `
            DELETE FROM password_reset_tokens
            WHERE email = ?
              AND userType = 'driver'
            `,
            [tokenRecord.email],
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

    // Delete account by immutable email and remove associated driver data.
    deleteAccount: t.procedure
      .input(
        z.object({
          email: z.string().email(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const email = normaliseEmail(input.email);

        try {
          const session = await requireDriverSession(ctx.authHeader);

          if (session.ok === false) {
            return {
              success: false,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          if (session.driver.email !== email) {
            return {
              success: false,
              error: "You are not authorised for this account.",
            };
          }

          const rows = await query<any>(
            `
            SELECT localUserId, email
            FROM drivers
            WHERE email = ?
            LIMIT 1
            `,
            [email],
          );

          if (rows.length === 0) {
            return { success: false, error: "Driver account was not found." };
          }

          // Soft-delete: mark the account as deleted and clear the password
          // so the driver cannot log in, but retain all data (shift logs,
          // operator links, compliance records) for administrative purposes.
          await query(
            `
            UPDATE drivers
            SET
              status = 'deleted',
              deletedAt = NOW(),
              passwordHash = ''
            WHERE email = ?
            LIMIT 1
            `,
            [email],
          );

          await query(
            `
            UPDATE driver_sessions
            SET invalidatedAt = NOW()
            WHERE localUserId = ?
              AND invalidatedAt IS NULL
            `,
            [rows[0].localUserId],
          );

          return { success: true };
        } catch (error) {
          console.error("[DriverAuth] Delete account failed:", error);
          return {
            success: false,
            error: "Unable to delete account. Please try again.",
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
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.localUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          const existing = await query<any>(
            `
            SELECT id
            FROM drivers
            WHERE localUserId = ?
            LIMIT 1
            `,
            [input.localUserId],
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
            ],
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

    syncSubscription: t.procedure
      .input(
        z.object({
          status: z.enum(["trial", "active", "expired", "cancelled"]),
          plan: z.enum(["monthly", "annual"]).nullable().optional(),
          subscriptionId: z.string().max(255).nullable().optional(),
          currentPeriodEnd: z.string().max(64).nullable().optional(),
          appAccountToken: z.string().uuid().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(ctx.authHeader);

          if (session.ok === false) {
            return {
              success: false,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          if (input.status === "active") {
            // appAccountToken is best-effort only — not reliably echoed back by
            // react-native-iap on restore. requireDriverSession() above already
            // proves which account this request belongs to via sessionToken.
            // subscriptionId (originalTransactionId) is the durable purchase link.
          }

          await query(
            `
            UPDATE drivers
            SET
              subscriptionStatus = ?,
              subscriptionPlan = ?,
              subscriptionId = ?,
              currentPeriodEnd = ?,
              updatedAt = NOW()
            WHERE localUserId = ?
            LIMIT 1
            `,
            [
              input.status,
              input.plan ?? null,
              input.subscriptionId ?? null,
              input.currentPeriodEnd ?? null,
              session.driver.localUserId,
            ],
          );

          return {
            success: true,
            subscriptionStatus: input.status,
            subscriptionPlan: input.plan ?? null,
            subscriptionId: input.subscriptionId ?? null,
            currentPeriodEnd: input.currentPeriodEnd ?? null,
          };
        } catch (error) {
          console.error("[DriverAuth] Subscription sync failed:", error);

          return {
            success: false,
            error: "Unable to save your subscription status.",
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
            }),
          ),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        let inserted = 0;
        let skipped = 0;

        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.driverLocalUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              inserted,
              skipped,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          for (const log of input.logs) {
            const existing = await query<any>(
              `
              SELECT id
              FROM shift_logs
              WHERE logId = ?
              LIMIT 1
              `,
              [log.logId],
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
              ],
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
        }),
      )
      .query(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.driverLocalUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              logs: [],
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          const rows = await query<any>(
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
            [input.driverLocalUserId],
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
    saveActiveShift: t.procedure
      .input(
        z.object({
          driverLocalUserId: z.string().min(1),
          shiftData: z.any(),
          startTime: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.driverLocalUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          await query(
            `
            INSERT INTO active_shifts (
              driverLocalUserId,
              shiftData,
              startTime
            )
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE
              shiftData = VALUES(shiftData),
              startTime = VALUES(startTime),
              updatedAt = CURRENT_TIMESTAMP
            `,
            [
              input.driverLocalUserId,
              JSON.stringify(input.shiftData),
              input.startTime,
            ],
          );

          return { success: true };
        } catch (error) {
          console.error("[Sync] Save active shift failed:", error);

          return { success: false };
        }
      }),
    pullActiveShift: t.procedure
      .input(
        z.object({
          driverLocalUserId: z.string().min(1),
        }),
      )
      .query(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.driverLocalUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              shift: null,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          const rows = await query<any>(
            `
        SELECT
          shiftData,
          startTime,
          updatedAt
        FROM active_shifts
        WHERE driverLocalUserId = ?
        LIMIT 1
        `,
            [input.driverLocalUserId],
          );

          if (rows.length === 0) {
            return {
              success: true,
              shift: null,
            };
          }

          const row = rows[0];

          return {
            success: true,
            shift:
              typeof row.shiftData === "string"
                ? JSON.parse(row.shiftData)
                : row.shiftData,
          };
        } catch (error) {
          console.error("[Sync] Pull active shift failed:", error);

          return {
            success: false,
            shift: null,
          };
        }
      }),
    clearActiveShift: t.procedure
      .input(
        z.object({
          driverLocalUserId: z.string().min(1),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await requireDriverSession(
            ctx.authHeader,
            input.driverLocalUserId,
          );

          if (session.ok === false) {
            return {
              success: false,
              sessionInvalid: session.sessionInvalid,
              error: session.error,
            };
          }

          await query(
            `
        DELETE FROM active_shifts
        WHERE driverLocalUserId = ?
        `,
            [input.driverLocalUserId],
          );

          return { success: true };
        } catch (error) {
          console.error("[Sync] Clear active shift failed:", error);

          return { success: false };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
