import { Express, Request, Response } from "express";
import { storagePut } from "./storage";
import { query } from "./db";
import XlsxPopulate from "xlsx-populate";

/**
 * EXPORT ROUTES HUB
 * Connects PDF / CSV / Excel exports into one system
 */

export function exportRouter(app: Express) {
  /* ─────────────────────────────────────────────
     CSV EXPORT
  ───────────────────────────────────────────── */
  app.post("/api/export/csv", async (req: Request, res: Response) => {
    try {
      const { driverId } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      const header =
        "Date,Start,End,Driving,Work,Distance";

      const rows = logs.map((l) => {
        const escape = (v: any) =>
          `"${String(v ?? "").replace(/"/g, '""')}"`;

        return [
          l.date,
          l.start_time,
          l.end_time,
          ((l.total_driving_seconds || 0) / 3600).toFixed(2),
          ((l.total_work_seconds || 0) / 3600).toFixed(2),
          l.distance_km || 0,
        ]
          .map(escape)
          .join(",");
      });

      const csv = [header, ...rows].join("\n");

      const { url } = await storagePut(
        `exports/logs-${Date.now()}.csv`,
        Buffer.from(csv, "utf-8"),
        "text/csv"
      );

      res.json({ url });
    } catch (err: any) {
      console.error("[CSV EXPORT ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  /* ─────────────────────────────────────────────
     PDF EXPORT (HTML fallback - rendered client-side or print-ready)
  ───────────────────────────────────────────── */
  app.post("/api/export/pdf", async (req: Request, res: Response) => {
    try {
      const { driverId } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      const html = `
        <html>
        <head>
          <title>Drive Legal Report</title>
          <style>
            body { font-family: Arial; padding: 20px; }
            h1 { color: #003366; }
            table { width: 100%; border-collapse: collapse; }
            td, th { border: 1px solid #ccc; padding: 8px; }
            th { background: #003366; color: white; }
          </style>
        </head>
        <body>
          <h1>Driving Log Report</h1>
          <table>
            <tr>
              <th>Date</th>
              <th>Start</th>
              <th>End</th>
              <th>Driving (hrs)</th>
              <th>Work (hrs)</th>
              <th>Distance</th>
            </tr>
            ${logs
              .map(
                (l) => `
              <tr>
                <td>${l.date}</td>
                <td>${l.start_time}</td>
                <td>${l.end_time}</td>
                <td>${((l.total_driving_seconds || 0) / 3600).toFixed(2)}</td>
                <td>${((l.total_work_seconds || 0) / 3600).toFixed(2)}</td>
                <td>${l.distance_km || 0}</td>
              </tr>
            `
              )
              .join("")}
          </table>
        </body>
        </html>
      `;

      const { url } = await storagePut(
        `exports/report-${Date.now()}.html`,
        Buffer.from(html, "utf-8"),
        "text/html"
      );

      res.json({ url });
    } catch (err: any) {
      console.error("[PDF EXPORT ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });

  /* ─────────────────────────────────────────────
     EXCEL EXPORT
  ───────────────────────────────────────────── */
  app.post("/api/export/excel", async (req: Request, res: Response) => {
    try {
      const { driverId } = req.body;

      if (!driverId) {
        return res.status(400).json({ error: "driverId required" });
      }

      const logs = await query<any>(
        "SELECT * FROM daily_logs WHERE user_id = ? ORDER BY start_time DESC",
        [driverId]
      );

      const wb = await XlsxPopulate.fromBlankAsync();
      const sheet = wb.sheet(0).name("Logs");

      const headers = [
        "Date",
        "Start",
        "End",
        "Driving",
        "Work",
        "Distance",
      ];

      headers.forEach((h, i) => {
        sheet.cell(1, i + 1).value(h).style({
          bold: true,
          fill: "003366",
          fontColor: "FFFFFF",
        });
      });

      logs.forEach((l, i) => {
        const row = i + 2;

        sheet.cell(row, 1).value(l.date);
        sheet.cell(row, 2).value(l.start_time);
        sheet.cell(row, 3).value(l.end_time);
        sheet.cell(row, 4).value(((l.total_driving_seconds || 0) / 3600).toFixed(2));
        sheet.cell(row, 5).value(((l.total_work_seconds || 0) / 3600).toFixed(2));
        sheet.cell(row, 6).value(l.distance_km || 0);
      });

      const buffer = await wb.outputAsync();

      const { url } = await storagePut(
        `exports/logbook-${Date.now()}.xlsx`,
        Buffer.from(buffer),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.json({ url });
    } catch (err: any) {
      console.error("[EXCEL EXPORT ERROR]", err);
      res.status(500).json({ error: err.message });
    }
  });
}