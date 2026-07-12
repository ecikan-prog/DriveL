import { initTRPC } from "@trpc/server";
import { z } from "zod";
import crypto from "crypto";
import { query } from "./db";

const t = initTRPC.create();

console.log("ROUTERS FILE LOADED");

export const appRouter = t.router({

  health: t.procedure.query(() => {
    return {
      status: "ok",
    };
  }),

  driverRegister: t.procedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8),
        name: z.string().min(2),

        licenceNumber: z.string().optional(),
        licenceClass: z.string().optional(),
        licenceExpiry: z.string().optional(),

        vehicleRegistration: z.string().optional(),
        vehicleType: z.string().optional(),

        driverType: z.enum([
          "goods",
          "large_passenger",
          "small_passenger",
          "vehicle_recovery",
        ]).default("small_passenger"),

        tslNumber: z.string().optional(),
        operatorName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {

      const existing = await query<any[]>(
        "SELECT id FROM drivers WHERE email = ? LIMIT 1",
        [input.email]
      );

      if (existing.length > 0) {
        throw new Error("Email already registered");
      }

      const localUserId = crypto.randomUUID();

      const passwordHash = crypto
        .createHash("sha256")
        .update(input.password)
        .digest("hex");

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
          emailVerified
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, false)
        `,
        [
          localUserId,
          input.email,
          passwordHash,
          input.name,
          input.licenceNumber ?? null,
          input.vehicleRegistration ?? null,
          input.vehicleType ?? null,
          input.driverType,
          input.tslNumber ?? null,
          input.licenceClass ?? null,
          input.licenceExpiry ?? null,
          input.operatorName ?? null,
        ]
      );

      return {
        success: true,
        message: "Driver registered successfully",
        localUserId,
      };
    }),
});

export type AppRouter = typeof appRouter;
