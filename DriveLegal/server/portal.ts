import { router } from "./trpc";

/**
 * Root TRPC router
 * Currently empty — admin/portal/excel/export are plain Express routes,
 * registered directly in server/index.ts, not tRPC procedures.
 */
export const appRouter = router({});

export type AppRouter = typeof appRouter;
