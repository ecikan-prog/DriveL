import { initTRPC } from "@trpc/server";

const t = initTRPC.create();

console.log("ROUTERS FILE LOADED");

export const appRouter = t.router({});

export type AppRouter = typeof appRouter;
