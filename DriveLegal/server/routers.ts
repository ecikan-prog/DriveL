import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

console.log("ROUTERS FILE LOADED");

export const appRouter = t.router({
  test: t.procedure.query(() => {
    return {
      message: "tRPC is working"
    };
  }),
});

export type AppRouter = typeof appRouter;
