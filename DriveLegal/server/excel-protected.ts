import { Express, Request, Response } from "express";
import XlsxPopulate from "xlsx-populate";
import { storagePut } from "./storage";
import { query } from "./db";

/**
 * Password-protected Excel export endpoint
 * Used for secure operator / admin downloads
 */

export function excelProtectedRouter(app: Express) {
  app.post("/api/export/excel-protected", async (req: Request, res: Response) => {
    try {
      const { driverId, password } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      // Fetch logs
      const logs = await query<any>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      const wb = await XlsxPopulate.fromBlankAsync();

      const sheet = wb.sheet(0).name("Logs");

      // Headers
      const headers = [
        "Date",
        "Start Time",
        "End Time",
        "Driving Hours",
        "Work Hours",
        "Distance (km)",
      ];

      headers.forEach((h, i) => {
        sheet.cell(1, i + 1).value(h).style({
          bold: true,
          fill: "003366",
          fontColor: "FFFFFF",
        });
      });

      // Rows
      logs.forEach((log, index) => {
        const row = index + 2;

        const drivingHours = (log.total_driving_seconds || 0) / 3600;
        const workHours = (log.total_work_seconds || 0) / 3600;

        sheet.cell(row, 1).value(log.date);
        sheet.cell(row, 2).value(log.start_time);
        sheet.cell(row, 3).value(log.end_time);
        sheet.cell(row, 4).value(drivingHours.toFixed(2));
        sheet.cell(row, 5).value(workHours.toFixed(2));
        sheet.cell(row, 6).value(log.distance_km || 0);
      });

      // Generate buffer (optional password)
      let buffer: Buffer;

      if (password && password.trim().length > 0) {
        buffer = await wb.outputAsync({ password: password.trim() });
      } else {
        buffer = await wb.outputAsync();
      }

      const filename = `protected-export-${Date.now()}.xlsx`;

      const { url } = await storagePut(
        `exports/${filename}`,
        Buffer.from(buffer),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.json({
        success: true,
        url,
      });
    } catch (err: any) {
      console.error("[EXCEL PROTECTED ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });
}