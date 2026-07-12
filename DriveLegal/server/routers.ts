import { router } from "./trpc";
import { adminRouter } from "./admin";
import { portalRouter } from "./portal";
import { excelProtectedRouter } from "./excel-protected";
import { exportRouter } from "./export-routes";

/**
 * Root TRPC router
 * This is what /api/trpc uses in server/index.ts
 */
export const appRouter = router({
  admin: adminRouter,
  portal: portalRouter,
  excel: excelProtectedRouter,
  export: exportRouter,
});

export type AppRouter = typeof appRouter;
