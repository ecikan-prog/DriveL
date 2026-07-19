import { Express, Request, Response } from "express";
import { query } from "./db";

/**
 * Simple admin auth (temporary)
 * Replace later with JWT / role-based access
 */
function isAdmin(req: Request) {
  const key = req.headers["x-admin-key"];
  return key && key === process.env.ADMIN_KEY;
}

export function adminRouter(app: Express) {
  /**
   * Get all drivers
   */
  app.get("/admin/drivers", async (req: Request, res: Response) => {
    try {
      if (!isAdmin(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const drivers = await query("SELECT * FROM drivers ORDER BY id DESC");
      res.json({ drivers });
    } catch (err: any) {
      console.error("[ADMIN DRIVERS ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Get system stats
   */
  app.get("/admin/stats", async (req: Request, res: Response) => {
    try {
      if (!isAdmin(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const [drivers] = await query<any[]>("SELECT COUNT(*) as count FROM drivers");
      const [logs] = await query<any[]>("SELECT COUNT(*) as count FROM shift_logs");

      res.json({
        drivers: drivers?.count || 0,
        logs: logs?.count || 0,
      });
    } catch (err: any) {
      console.error("[ADMIN STATS ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * Delete driver (danger action)
   */
  app.delete("/admin/driver/:id", async (req: Request, res: Response) => {
    try {
      if (!isAdmin(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const { id } = req.params;

      await query("DELETE FROM drivers WHERE id = ?", [id]);

      res.json({ success: true });
    } catch (err: any) {
      console.error("[ADMIN DELETE ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });
}
