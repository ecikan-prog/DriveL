import { Router, Request, Response } from "express";
import { storagePut } from "./storage";

import XlsxPopulate from "xlsx-populate";

const exportRouter = Router();

/* ─────────────────────────────────────────────
   TYPES
──────────────────────────────────────────── */

type ShiftEventType =
  | "shift_start"
  | "break_start"
  | "break_end"
  | "other_work_start"
  | "other_work_end"
  | "shift_end";

interface ShiftEvent {
  type: ShiftEventType;
  timestamp: string;
}

interface BreakEntry {
  startTime: string;
  endTime: string;
  durationSeconds: number;
}

interface DailyLog {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalDrivingSeconds: number;
  totalWorkSeconds: number;
  breaks: BreakEntry[];
  events: ShiftEvent[];
  startLocation?: { displayName: string };
  endLocation?: { displayName: string };
  startOdometer?: number;
  endOdometer?: number;
  distanceKm?: number;
}

/* ─────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────── */

function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function normalizeLogs(raw: any[]): DailyLog[] {
  return raw.map((l) => ({
    ...l,
    breaks: Array.isArray(l.breaks) ? l.breaks : [],
    events: Array.isArray(l.events) ? l.events : [],
  }));
}

/* ─────────────────────────────────────────────
   CSV
──────────────────────────────────────────── */

function buildCSV(logs: DailyLog[], driverName: string, licence: string) {
  const header =
    "Date,Start,End,Driving,Work,Breaks,Start Location,End Location,Distance";

  const rows = logs.map((l) =>
    [
      l.date,
      formatTime(l.startTime),
      formatTime(l.endTime),
      formatHoursMinutes(l.totalDrivingSeconds),
      formatHoursMinutes(l.totalWorkSeconds),
      l.breaks.length,
      l.startLocation?.displayName || "",
      l.endLocation?.displayName || "",
      l.distanceKm || 0,
    ].join(",")
  );

  return [
    `# Driver: ${driverName}`,
    `# Licence: ${licence}`,
    "",
    header,
    ...rows,
  ].join("\n");
}

/* ─────────────────────────────────────────────
   PDF (HTML EXPORT)
──────────────────────────────────────────── */

function buildPDF(logs: DailyLog[], driverName: string) {
  const rows = logs
    .map(
      (l) => `
      <tr>
        <td>${l.date}</td>
        <td>${formatTime(l.startTime)}</td>
        <td>${formatTime(l.endTime)}</td>
        <td>${formatHoursMinutes(l.totalDrivingSeconds)}</td>
        <td>${formatHoursMinutes(l.totalWorkSeconds)}</td>
        <td>${l.breaks.length}</td>
        <td>${l.distanceKm || 0} km</td>
      </tr>
    `
    )
    .join("");

  return `
  <html>
    <body style="font-family: Arial;">
      <h2>Drive Legal Report</h2>
      <p>Driver: ${driverName}</p>

      <table border="1" cellpadding="6" cellspacing="0">
        <thead>
          <tr>
            <th>Date</th>
            <th>Start</th>
            <th>End</th>
            <th>Driving</th>
            <th>Work</th>
            <th>Breaks</th>
            <th>Distance</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </body>
  </html>`;
}

/* ─────────────────────────────────────────────
   ROUTES
──────────────────────────────────────────── */

exportRouter.post("/csv", async (req: Request, res: Response) => {
  try {
    const { logs, driverName, licenceNumber } = req.body;

    const normalized = normalizeLogs(logs);
    const csv = buildCSV(normalized, driverName, licenceNumber);

    const { url } = await storagePut(
      `exports/logs-${Date.now()}.csv`,
      Buffer.from(csv, "utf-8"),
      "text/csv"
    );

    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ───────────────────────────────────────────── */

exportRouter.post("/pdf", async (req: Request, res: Response) => {
  try {
    const { logs, driverName } = req.body;

    const normalized = normalizeLogs(logs);
    const html = buildPDF(normalized, driverName);

    const { url } = await storagePut(
      `exports/logs-${Date.now()}.html`,
      Buffer.from(html, "utf-8"),
      "text/html"
    );

    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ───────────────────────────────────────────── */

exportRouter.post("/excel", async (req: Request, res: Response) => {
  try {
    const { logs, driverName, licenceNumber } = req.body;

    const normalized = normalizeLogs(logs);
    const wb = await XlsxPopulate.fromBlankAsync();

    const sheet = wb.sheet(0).name("Logbook");

    const headers = [
      "Date",
      "Start",
      "End",
      "Driving",
      "Work",
      "Breaks",
      "Distance",
    ];

    headers.forEach((h, i) => {
      sheet.cell(1, i + 1).value(h);
    });

    normalized.forEach((l, i) => {
      const r = i + 2;

      sheet.cell(r, 1).value(l.date);
      sheet.cell(r, 2).value(formatTime(l.startTime));
      sheet.cell(r, 3).value(formatTime(l.endTime));
      sheet.cell(r, 4).value(l.totalDrivingSeconds);
      sheet.cell(r, 5).value(l.totalWorkSeconds);
      sheet.cell(r, 6).value(l.breaks.length);
      sheet.cell(r, 7).value(l.distanceKm || 0);
    });

    const buffer = await wb.outputAsync();

    const { url } = await storagePut(
      `exports/logs-${Date.now()}.xlsx`,
      Buffer.from(buffer),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    res.json({ url });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export { exportRouter };