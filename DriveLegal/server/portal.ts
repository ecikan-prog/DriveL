import { Express, Request, Response } from "express";
import { query } from "./db";

function isAuthorized(req: Request) {
  const key = req.headers["x-admin-key"];
  return key && key === process.env.ADMIN_KEY;
}

export function portalRouter(app: Express) {
  app.get("/portal/drivers", async (req: Request, res: Response) => {
    try {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const drivers = await query(`
        SELECT id, email, name, licence_number, created_at
        FROM drivers
        ORDER BY id DESC
      `);
      res.json({ drivers });
    } catch (err: any) {
      console.error("[PORTAL DRIVERS ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/portal/driver/:id/logs", async (req: Request, res: Response) => {
  try {
    if (!isAuthorized(req)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;

    const drivers = await query<any[]>(
      `
      SELECT localUserId
      FROM drivers
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    if (drivers.length === 0) {
      return res.status(404).json({
        error: "Driver not found",
      });
    }

    const logs = await query<any[]>(
      `
      SELECT
        id,
        logId,
        driverLocalUserId,
        date,
        logData,
        canonicalJson,
        hash,
        previousHash,
        hashTimestamp,
        startTime,
        endTime,
        createdAt
      FROM shift_logs
      WHERE driverLocalUserId = ?
      ORDER BY startTime DESC
      `,
      [drivers[0].localUserId]
    );

    return res.json({ logs });
  } catch (err: any) {
    console.error("[PORTAL LOGS ERROR]", err);

    return res.status(500).json({
      error: err?.message || "Failed to load driver logs",
    });
  }
});

  app.get("/portal/stats", async (req: Request, res: Response) => {
    try {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const drivers = await query<any[]>("SELECT COUNT(*) as count FROM drivers");
      const logs = await query<any[]>("SELECT COUNT(*) as count FROM daily_logs");
      const todayLogs = await query<any[]>(
        "SELECT COUNT(*) as count FROM daily_logs WHERE DATE(start_time) = CURDATE()"
      );
      res.json({
        drivers: drivers?.[0]?.count || 0,
        logs: logs?.[0]?.count || 0,
        todayLogs: todayLogs?.[0]?.count || 0,
      });
    } catch (err: any) {
      console.error("[PORTAL STATS ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/portal/driver/:id", async (req: Request, res: Response) => {
    try {
      if (!isAuthorized(req)) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const { id } = req.params;
      const driver = await query(
        "SELECT * FROM drivers WHERE id = ? LIMIT 1",
        [id]
      );
      if (!driver.length) {
        return res.status(404).json({ error: "Driver not found" });
      }
      res.json({ driver: driver[0] });
    } catch (err: any) {
      console.error("[PORTAL DRIVER ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });
}
