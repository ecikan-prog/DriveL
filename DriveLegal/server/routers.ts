import { z } from "zod";
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";
import { sendPasswordResetEmail, sendVerificationEmail } from "./email";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  /**
   * Drive Legal local auth — allows drivers to register/login with email+password
   * stored in the cloud DB, enabling cross-device access.
   */
  driverAuth: router({
    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          passwordHash: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const driver = await db.getDriverByEmail(input.email);
        if (!driver) {
          return { success: false, error: "Account not found. Please register first." } as const;
        }
        if (driver.passwordHash !== input.passwordHash) {
          return { success: false, error: "Invalid password." } as const;
        }
        // Check email verification
        if (!driver.emailVerified) {
          return {
            success: false,
            error: "__VERIFICATION_REQUIRED__",
            verificationRequired: true,
            email: driver.email,
          } as const;
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
        } as const;
      }),

    register: publicProcedure
      .input(
        z.object({
          localUserId: z.string(),
          email: z.string().email(),
          passwordHash: z.string(),
          name: z.string(),
          tslNumber: z.string().optional(),
          operatorName: z.string().optional(),
          licenceNumber: z.string().optional(),
          licenceClass: z.string().optional(),
          licenceExpiry: z.string().optional(),
          vehicleRegistration: z.string().optional(),
          vehicleType: z.string().optional(),
          driverType: z.enum(["goods", "large_passenger", "small_passenger", "vehicle_recovery"]).default("small_passenger"),
          trialStartDate: z.string().optional(),
          baseUrl: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // Check if email already exists
        const existing = await db.getDriverByEmail(input.email);
        if (existing) {
          return { success: false, error: "Email already registered." } as const;
        }
        await db.upsertDriver({
          localUserId: input.localUserId,
          email: input.email,
          passwordHash: input.passwordHash,
          name: input.name,
          tslNumber: input.tslNumber ?? null,
          operatorName: input.operatorName ?? null,
          licenceNumber: input.licenceNumber ?? null,
          licenceClass: input.licenceClass ?? null,
          licenceExpiry: input.licenceExpiry ?? null,
          vehicleRegistration: input.vehicleRegistration ?? null,
          vehicleType: input.vehicleType ?? null,
          driverType: input.driverType,
          trialStartDate: input.trialStartDate ?? null,
        });

        // Send verification email
        try {
          const token = await db.createEmailVerificationToken(input.email);
          const baseUrl = input.baseUrl || "https://guidedlogbook-6i7vyx5h.manus.space";
          await sendVerificationEmail(input.email, input.name, token, baseUrl);
        } catch (e) {
          console.error("[Register] Failed to send verification email:", e);
        }

        return { success: true, verificationRequired: true } as const;
      }),

    updateProfile: publicProcedure
      .input(
        z.object({
          localUserId: z.string(),
          name: z.string().optional(),
          tslNumber: z.string().optional(),
          operatorName: z.string().optional(),
          licenceNumber: z.string().optional(),
          licenceClass: z.string().optional(),
          licenceExpiry: z.string().optional(),
          vehicleRegistration: z.string().optional(),
          vehicleType: z.string().optional(),
          driverType: z.enum(["goods", "large_passenger", "small_passenger", "vehicle_recovery"]).optional(),
        })
      )
      .mutation(async ({ input }) => {
        const driver = await db.getDriverByLocalUserId(input.localUserId);
        if (!driver) {
          return { success: false, error: "Driver not found." } as const;
        }
        await db.upsertDriver({
          localUserId: input.localUserId,
          email: driver.email,
          passwordHash: driver.passwordHash,
          name: input.name ?? driver.name,
          tslNumber: input.tslNumber ?? driver.tslNumber,
          operatorName: input.operatorName ?? driver.operatorName,
          licenceNumber: input.licenceNumber ?? driver.licenceNumber,
          licenceClass: input.licenceClass ?? driver.licenceClass,
          licenceExpiry: input.licenceExpiry ?? driver.licenceExpiry,
          vehicleRegistration: input.vehicleRegistration ?? driver.vehicleRegistration,
          vehicleType: input.vehicleType ?? driver.vehicleType,
          driverType: input.driverType ?? driver.driverType,
          trialStartDate: driver.trialStartDate,
        });
        return { success: true } as const;
      }),

    forgotPassword: publicProcedure
      .input(z.object({ email: z.string().email(), baseUrl: z.string() }))
      .mutation(async ({ input }) => {
        // Always return success to prevent email enumeration
        const driver = await db.getDriverByEmail(input.email);
        if (driver) {
          const token = await db.createResetToken(input.email, "driver");
          await sendPasswordResetEmail(input.email, driver.name, token, input.baseUrl, "driver");
        }
        return { success: true, message: "If an account with that email exists, a reset link has been sent." } as const;
      }),

    resetPassword: publicProcedure
      .input(z.object({ token: z.string(), newPasswordHash: z.string() }))
      .mutation(async ({ input }) => {
        const resetToken = await db.getResetToken(input.token);
        if (!resetToken) {
          return { success: false, error: "This reset link has expired or is invalid." } as const;
        }
        if (resetToken.userType !== "driver") {
          return { success: false, error: "Invalid token type." } as const;
        }
        const updated = await db.updateDriverPassword(resetToken.email, input.newPasswordHash);
        await db.deleteResetToken(input.token);
        if (!updated) {
          return { success: false, error: "Failed to update password." } as const;
        }
        return { success: true } as const;
      }),

    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(async ({ input }) => {
        const verificationToken = await db.getEmailVerificationToken(input.token);
        if (!verificationToken) {
          return { success: false, error: "This verification link has expired or is invalid. Please request a new one." } as const;
        }
        const verified = await db.markDriverEmailVerified(verificationToken.email);
        await db.deleteEmailVerificationToken(input.token);
        if (!verified) {
          return { success: false, error: "Failed to verify email." } as const;
        }
        return { success: true } as const;
      }),

    resendVerification: publicProcedure
      .input(z.object({ email: z.string().email(), baseUrl: z.string().optional() }))
      .mutation(async ({ input }) => {
        const driver = await db.getDriverByEmail(input.email);
        if (!driver) {
          // Don't reveal if email exists
          return { success: true, message: "If an account with that email exists, a verification email has been sent." } as const;
        }
        if (driver.emailVerified) {
          return { success: true, message: "Email is already verified. You can sign in." } as const;
        }
        const token = await db.createEmailVerificationToken(input.email);
        const baseUrl = input.baseUrl || "https://guidedlogbook-6i7vyx5h.manus.space";
        await sendVerificationEmail(input.email, driver.name, token, baseUrl);
        return { success: true, message: "Verification email sent. Please check your inbox." } as const;
      }),
  }),

  /**
   * Shift log sync — push completed logs to cloud, pull from cloud.
   */
  sync: router({
    pushLogs: publicProcedure
      .input(
        z.object({
          driverLocalUserId: z.string(),
          logs: z.array(
            z.object({
              logId: z.string(),
              date: z.string(),
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
        const entries = input.logs.map((log) => ({
          logId: log.logId,
          driverLocalUserId: input.driverLocalUserId,
          date: log.date,
          logData: log.logData,
          canonicalJson: log.canonicalJson,
          hash: log.hash,
          previousHash: log.previousHash,
          hashTimestamp: log.hashTimestamp,
          startTime: log.startTime,
          endTime: log.endTime,
        }));

        const result = await db.pushShiftLogs(entries);
        return { success: true, ...result };
      }),

    pullLogs: publicProcedure
      .input(
        z.object({
          driverLocalUserId: z.string(),
        })
      )
      .query(async ({ input }) => {
        const logs = await db.getShiftLogsByDriver(input.driverLocalUserId);
        return {
          logs: logs.map((row) => ({
            logId: row.logId,
            date: row.date,
            logData: row.logData,
            canonicalJson: row.canonicalJson,
            hash: row.hash,
            previousHash: row.previousHash,
            hashTimestamp: row.hashTimestamp,
            startTime: row.startTime,
            endTime: row.endTime,
          })),
        };
      }),

    getLatestHash: publicProcedure
      .input(z.object({ driverLocalUserId: z.string() }))
      .query(async ({ input }) => {
        return db.getLatestHashForDriver(input.driverLocalUserId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
