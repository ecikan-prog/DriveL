import { initTRPC } from "@trpc/server";
import { z } from "zod";

const t = initTRPC.create();

console.log("ROUTERS FILE LOADED");

export const appRouter = t.router({
  health: t.procedure.query(() => {
    return {
      status: "ok",
    };
  }),
});
export type AppRouter = typeof appRouter;
