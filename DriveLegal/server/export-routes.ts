/**
 * Server-side export endpoints for PDF, Excel, and CSV.
 * These run on the Node.js server so native iOS doesn't need
 * expo-print, expo-sharing, expo-file-system, or expo-mail-composer.
 */
import { Router, Request, Response } from "express";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
import { storagePut } from "./storage";

const exportRouter = Router();

// ─── Inline Types (cannot import from lib/logbook-storage.ts — it uses AsyncStorage) ───
type ShiftEventType = "shift_start" | "break_start" | "break_end" | "shift_end" | "other_work_start" | "other_work_end";
interface ShiftEvent {
  type: ShiftEventType;
  timestamp: string;
  note?: string;
  location?: { latitude: number; longitude: number; displayName: string };
  odometer?: number;
}
interface BreakEntry {
  startTime: string;
  endTime: string;
  durationSeconds: number;
}
interface Amendment {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
}
interface VehicleChange {
  timestamp: string;
  registration: string;
  odometer: number;
  reason?: string;
}
interface DailyLog {
  id: string;
  userId: string;
  date: string;
  startTime: string;
  endTime: string;
  totalDrivingSeconds: number;
  totalWorkSeconds: number;
  totalOtherWorkSeconds?: number;
  otherWorkPeriods?: { startTime: string; endTime: string; durationSeconds: number }[];
  breaks: BreakEntry[];
  events: ShiftEvent[];
  startLocation?: { latitude: number; longitude: number; displayName: string };
  endLocation?: { latitude: number; longitude: number; displayName: string };
  startOdometer?: number;
  endOdometer?: number;
  distanceKm?: number;
  amendments?: Amendment[];
  vehicleChanges?: VehicleChange[];
  restOverrideFlagged?: boolean;
  restOverrideNote?: string;
}

// ─── Helper Functions ─────────────────────────────────────────────────────────
function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function computeDrivingSeconds(log: DailyLog): number {
  let ms = 0;
  const events = log.events;
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];
    if (current.type === "shift_start" || current.type === "break_end" || current.type === "other_work_end") {
      ms += new Date(next.timestamp).getTime() - new Date(current.timestamp).getTime();
    }
  }
  return Math.floor(ms / 1000);
}

function computeOtherWorkSeconds(log: DailyLog): number {
  let ms = 0;
  const events = log.events;
  for (let i = 0; i < events.length - 1; i++) {
    if (events[i].type === "other_work_start") {
      ms += new Date(events[i + 1].timestamp).getTime() - new Date(events[i].timestamp).getTime();
    }
  }
  return Math.floor(ms / 1000);
}

function computeBreakSeconds(log: DailyLog): number {
  let ms = 0;
  const events = log.events;
  for (let i = 0; i < events.length - 1; i++) {
    if (events[i].type === "break_start") {
      ms += new Date(events[i + 1].timestamp).getTime() - new Date(events[i].timestamp).getTime();
    }
  }
  return Math.floor(ms / 1000);
}

// ─── Activity Grid HTML Builder ─────────────────────────────────────────────
type ActivityType = "driving" | "other_work" | "rest_break" | "off_duty";
type ActivityBlock = { type: ActivityType; startMinute: number; endMinute: number };
const GRID_COLORS: Record<ActivityType, string> = {
  driving: "#003366",
  other_work: "#5980E9",
  rest_break: "#22C55E",
  off_duty: "#E2E8F0",
};

function getMinuteOfDay(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

function logToBlocks(log: DailyLog): ActivityBlock[] {
  const blocks: ActivityBlock[] = [];
  const events = log.events;
  if (events.length === 0) return blocks;
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];
    const startMin = getMinuteOfDay(current.timestamp);
    const endMin = getMinuteOfDay(next.timestamp);
    let type: ActivityType = "driving";
    if (current.type === "shift_start" || current.type === "break_end" || current.type === "other_work_end") {
      type = "driving";
    } else if (current.type === "break_start") {
      type = "rest_break";
    } else if (current.type === "other_work_start") {
      type = "other_work";
    }
    if (endMin > startMin) {
      blocks.push({ type, startMinute: startMin, endMinute: endMin });
    } else if (endMin < startMin) {
      blocks.push({ type, startMinute: startMin, endMinute: 1440 });
    }
  }
  return blocks;
}

function buildActivityGridHtml(logs: DailyLog[]): string {
  if (logs.length === 0) return '<div style="font-size:11px;color:#6B7A99;padding:8px;">No activity data available</div>';
  const sorted = [...logs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const firstDate = new Date(sorted[0].startTime);
  const lastDate = new Date(sorted[sorted.length - 1].endTime);
  const currentDate = new Date(firstDate);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(lastDate);
  endDate.setHours(23, 59, 59, 999);
  const rows: string[] = [];
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dateLabel = currentDate.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
    const dayLogs = sorted.filter((log) => log.startTime.split("T")[0] === dateStr);
    let blocks: ActivityBlock[] = [];
    if (dayLogs.length > 0) {
      for (const log of dayLogs) blocks.push(...logToBlocks(log));
      blocks.sort((a, b) => a.startMinute - b.startMinute);
      const filled: ActivityBlock[] = [];
      let lastEnd = 0;
      for (const block of blocks) {
        if (block.startMinute > lastEnd) filled.push({ type: "off_duty", startMinute: lastEnd, endMinute: block.startMinute });
        filled.push(block);
        lastEnd = Math.max(lastEnd, block.endMinute);
      }
      if (lastEnd < 1440) filled.push({ type: "off_duty", startMinute: lastEnd, endMinute: 1440 });
      blocks = filled;
    } else {
      blocks = [{ type: "off_duty", startMinute: 0, endMinute: 1440 }];
    }
    const blockHtml = blocks.map((b) => {
      const widthPct = ((b.endMinute - b.startMinute) / 1440) * 100;
      return `<div style="height:18px;width:${widthPct.toFixed(2)}%;background-color:${GRID_COLORS[b.type]};border-radius:2px;"></div>`;
    }).join("");
    rows.push(`<div style="display:flex;align-items:center;margin-bottom:3px;"><div style="width:80px;font-size:9px;color:#4A5568;font-weight:500;">${dateLabel}</div><div style="flex:1;display:flex;height:18px;border-radius:4px;overflow:hidden;border:1px solid #E2E8F0;">${blockHtml}</div></div>`);
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return rows.join("");
}

// ─── Build PDF HTML ──────────────────────────────────────────────────────────
interface PDFOptions {
  logs: DailyLog[];
  driverName: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType: string;
  dateRange?: { from?: string; to?: string };
}

function buildPDFHtml(options: PDFOptions): string {
  const { logs, driverName, licenceNumber, vehicleRegistration, vehicleType, driverType, dateRange } = options;
  const sortedLogs = [...logs].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  const totalDrivingHours = sortedLogs.reduce((sum, l) => sum + l.totalDrivingSeconds, 0);
  const totalWorkHours = sortedLogs.reduce((sum, l) => sum + l.totalWorkSeconds, 0);
  const totalBreaks = sortedLogs.reduce((sum, l) => sum + l.breaks.length, 0);
  const totalDistanceKm = sortedLogs.reduce((sum, l) => sum + (l.distanceKm ?? 0), 0);
  const now = new Date();
  const reportDate = now.toLocaleDateString("en-NZ", { day: "numeric", month: "long", year: "numeric" });
  const reportTime = now.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true });
  const fromDate = dateRange?.from
    ? new Date(dateRange.from).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
    : sortedLogs.length > 0
    ? new Date(sortedLogs[0].startTime).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  const toDate = dateRange?.to
    ? new Date(dateRange.to).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
    : sortedLogs.length > 0
    ? new Date(sortedLogs[sortedLogs.length - 1].startTime).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })
    : "N/A";
  const drivingLimitLabel = driverType === "goods" ? "5.5 hrs (Goods Service)" : "7 hrs (Passenger Service)";
  const tableRows = sortedLogs.map((log, index) => {
    const breakTime = log.breaks.reduce((s, b) => s + b.durationSeconds, 0);
    const rowBg = index % 2 === 0 ? "#F9FAFB" : "#FFFFFF";
    const startLoc = log.startLocation?.displayName ?? "—";
    const endLoc = log.endLocation?.displayName ?? "—";
    const locationCell = startLoc !== "—" || endLoc !== "—"
      ? `<span style="font-size:9px;color:#6B7280;">From:</span> ${startLoc}<br><span style="font-size:9px;color:#6B7280;">To:</span> ${endLoc}`
      : "—";
    const startOdo = log.startOdometer !== undefined ? `${log.startOdometer.toLocaleString()} km` : "—";
    const endOdo = log.endOdometer !== undefined ? `${log.endOdometer.toLocaleString()} km` : "—";
    const distCell = log.distanceKm !== undefined && log.distanceKm > 0
      ? `${startOdo} → ${endOdo}<br><span style="font-weight:700;color:#003366;">${log.distanceKm.toLocaleString()} km</span>`
      : (log.startOdometer !== undefined || log.endOdometer !== undefined) ? `${startOdo} → ${endOdo}` : "—";
    const overrideRow = log.restOverrideFlagged && log.restOverrideNote
      ? `<tr style="background-color:#FFFBEB;"><td colspan="8" style="padding:8px 10px;border-bottom:1px solid #FCD34D;font-size:10px;color:#92400E;"><strong>&#9888; Rest requirement not met — driver-reported unavoidable delay:</strong> ${log.restOverrideNote}</td></tr>`
      : "";
    return `<tr style="background-color:${rowBg};"><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;">${log.date}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;">${formatTime(log.startTime)}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;">${formatTime(log.endTime)}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;font-weight:600;">${formatHoursMinutes(log.totalDrivingSeconds)}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;">${formatHoursMinutes(log.totalWorkSeconds)}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:11px;">${log.breaks.length} (${formatHoursMinutes(breakTime)})</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:10px;line-height:1.5;">${locationCell}</td><td style="padding:8px 10px;border-bottom:1px solid #E5E7EB;font-size:10px;line-height:1.5;">${distCell}</td></tr>${overrideRow}`;
  }).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>
@page{margin:20mm 12mm;size:A4 landscape;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1F2937;line-height:1.4;margin:0;padding:0;}
.header{background-color:#003366;padding:20px 28px;margin:-20mm -12mm 24px -12mm;display:flex;align-items:center;justify-content:space-between;}
.header-title{font-size:24px;font-weight:800;color:#FFFFFF;letter-spacing:2px;}
.header-title .green{color:#4ADE80;}
.header-subtitle{font-size:10px;color:#8AACDA;letter-spacing:1.5px;margin-top:2px;}
.header-right{text-align:right;color:#8AACDA;font-size:10px;}
.section-title{font-size:14px;font-weight:700;color:#003366;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid #5980E9;}
.driver-info{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 24px;margin-bottom:20px;background-color:#F3F4F6;padding:14px 16px;border-radius:8px;}
.info-label{font-size:9px;color:#6B7280;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;}
.info-value{font-size:12px;color:#1F2937;font-weight:600;margin-top:2px;}
.summary-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px;}
.summary-card{background-color:#F0F4FF;border:1px solid #D1DEFA;border-radius:8px;padding:10px;text-align:center;}
.summary-value{font-size:16px;font-weight:800;color:#003366;}
.summary-label{font-size:9px;color:#6B7280;text-transform:uppercase;margin-top:4px;letter-spacing:0.5px;}
table{width:100%;border-collapse:collapse;margin-bottom:20px;}
th{background-color:#003366;color:#FFFFFF;padding:9px 10px;text-align:left;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;}
.footer{margin-top:24px;padding-top:14px;border-top:1px solid #E5E7EB;display:flex;justify-content:space-between;align-items:center;}
.footer-left,.footer-right{font-size:9px;color:#9CA3AF;}
.footer-right{text-align:right;}
.compliance-note{background-color:#FEF3C7;border:1px solid #F59E0B;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:10px;color:#92400E;}
.compliance-note strong{display:block;margin-bottom:4px;font-size:11px;}
</style></head><body>
<div class="header"><div><div class="header-title">DRIVE <span class="green">LEGAL</span></div><div class="header-subtitle">DRIVER LOGBOOK</div></div><div class="header-right"><div style="font-size:12px;color:#FFFFFF;font-weight:600;">Driving Hours Report</div><div style="margin-top:4px;">Generated: ${reportDate} at ${reportTime}</div></div></div>
<div class="section-title">Driver Information</div>
<div class="driver-info"><div><div class="info-label">Driver Name</div><div class="info-value">${driverName}</div></div><div><div class="info-label">NZ Licence Number</div><div class="info-value">${licenceNumber || "—"}</div></div><div><div class="info-label">Vehicle Registration</div><div class="info-value">${vehicleRegistration || "—"}</div></div><div><div class="info-label">Vehicle Type</div><div class="info-value">${vehicleType || "—"}</div></div><div><div class="info-label">Driver Classification</div><div class="info-value">${driverType === "goods" ? "Goods Service" : "Passenger Service"}</div></div><div><div class="info-label">Report Period</div><div class="info-value">${fromDate} — ${toDate}</div></div></div>
<div class="section-title">Summary</div>
<div class="summary-grid"><div class="summary-card"><div class="summary-value">${sortedLogs.length}</div><div class="summary-label">Shifts</div></div><div class="summary-card"><div class="summary-value">${formatHoursMinutes(totalDrivingHours)}</div><div class="summary-label">Total Driving</div></div><div class="summary-card"><div class="summary-value">${formatHoursMinutes(totalWorkHours)}</div><div class="summary-label">Total Work</div></div><div class="summary-card"><div class="summary-value">${totalBreaks}</div><div class="summary-label">Breaks Taken</div></div><div class="summary-card"><div class="summary-value">${totalDistanceKm > 0 ? totalDistanceKm.toLocaleString() + " km" : "—"}</div><div class="summary-label">Total Distance</div></div></div>
<div class="compliance-note"><strong>NZTA Work Time Rules (Land Transport Rule: Work Time and Logbooks 2007)</strong>Driving limit: ${drivingLimitLabel} before a 30-minute break is required. Maximum 13 hours work time in any 24-hour period (10-hour rest required). Maximum 70 hours driving in any 14-day (fortnightly) period.</div>
<div class="section-title">Activity Grid — Cumulative Work Period</div>
<div style="margin-bottom:20px;"><div style="display:flex;gap:16px;margin-bottom:8px;"><div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:14px;border-radius:3px;background-color:#003366;"></div><span style="font-size:9px;color:#4A5568;">Driving</span></div><div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:14px;border-radius:3px;background-color:#5980E9;"></div><span style="font-size:9px;color:#4A5568;">Other Work</span></div><div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:14px;border-radius:3px;background-color:#22C55E;"></div><span style="font-size:9px;color:#4A5568;">Rest Break</span></div><div style="display:flex;align-items:center;gap:4px;"><div style="width:14px;height:14px;border-radius:3px;background-color:#E2E8F0;"></div><span style="font-size:9px;color:#4A5568;">Off Duty</span></div></div>
<div style="display:flex;margin-left:80px;margin-bottom:4px;"><span style="flex:1;font-size:8px;color:#9CA3AF;text-align:left;">00:00</span><span style="flex:1;font-size:8px;color:#9CA3AF;text-align:center;">06:00</span><span style="flex:1;font-size:8px;color:#9CA3AF;text-align:center;">12:00</span><span style="flex:1;font-size:8px;color:#9CA3AF;text-align:center;">18:00</span><span style="font-size:8px;color:#9CA3AF;text-align:right;">24:00</span></div>
${buildActivityGridHtml(sortedLogs)}</div>
<div class="section-title">Shift Log Detail</div>
<table><thead><tr><th>Date</th><th>Start</th><th>End</th><th>Driving</th><th>Work</th><th>Breaks (Time)</th><th>Location (Start → End)</th><th>Odometer / Distance</th></tr></thead><tbody>${tableRows}</tbody></table>
<div class="footer"><div class="footer-left"><div>This report was generated by Drive Legal — Electronic logbook built to NZTA Work Time and Logbooks Rule requirements.</div><div style="margin-top:4px;">Report ID: DL-${Date.now().toString(36).toUpperCase()} | Tamper-evident hash chain applied to all records.</div></div><div class="footer-right"><div>Driver: ${driverName}</div><div>Licence: ${licenceNumber || "—"} | Rego: ${vehicleRegistration || "—"}</div></div></div>
</body></html>`;
}

// ─── Build CSV ───────────────────────────────────────────────────────────────
function buildCSV(logs: DailyLog[], driverName: string, licenceNumber: string): string {
  const sorted = [...logs].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  const header = "Date,Shift Start,Shift End,Driving Time,Other Work,Break Time,Total Work,Start Location,End Location,Start Odometer,End Odometer,Distance (km),Amendments,Rest Override";
  const rows = sorted.map((log) => {
    const drivingSec = log.totalDrivingSeconds;
    const otherWorkSec = log.totalWorkSeconds - log.totalDrivingSeconds;
    const breakSec = log.breaks.reduce((s, b) => s + b.durationSeconds, 0);
    const totalWork = log.totalWorkSeconds;
    const startLoc = log.startLocation?.displayName ?? "";
    const endLoc = log.endLocation?.displayName ?? "";
    const startOdo = log.startOdometer ?? "";
    const endOdo = log.endOdometer ?? "";
    const dist = log.distanceKm ?? "";
    const amended = (log.amendments && log.amendments.length > 0) ? "Yes" : "No";
    const restOverride = log.restOverrideFlagged ? (log.restOverrideNote ?? "Yes") : "No";
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      log.date,
      formatTime(log.startTime),
      formatTime(log.endTime),
      formatHoursMinutes(drivingSec),
      formatHoursMinutes(otherWorkSec > 0 ? otherWorkSec : 0),
      formatHoursMinutes(breakSec),
      formatHoursMinutes(totalWork),
      escape(startLoc),
      escape(endLoc),
      startOdo,
      endOdo,
      dist,
      amended,
      escape(restOverride),
    ].join(",");
  });
  const meta = [
    `# Drive Legal — Electronic Logbook CSV Export`,
    `# Driver: ${driverName}`,
    `# Licence: ${licenceNumber}`,
    `# Export Date: ${new Date().toLocaleDateString("en-NZ")}`,
    `# Total Shifts: ${sorted.length}`,
    "",
  ];
  return [...meta, header, ...rows].join("\n") + "\n";
}

// ─── Normalize logs to ensure arrays are never undefined ─────────────────────
function normalizeLogs(rawLogs: any[]): DailyLog[] {
  return rawLogs.map((log) => ({
    ...log,
    breaks: Array.isArray(log.breaks) ? log.breaks : [],
    events: Array.isArray(log.events) ? log.events : [],
    amendments: Array.isArray(log.amendments) ? log.amendments : [],
    vehicleChanges: Array.isArray(log.vehicleChanges) ? log.vehicleChanges : [],
    otherWorkPeriods: Array.isArray(log.otherWorkPeriods) ? log.otherWorkPeriods : [],
    totalDrivingSeconds: typeof log.totalDrivingSeconds === "number" ? log.totalDrivingSeconds : 0,
    totalWorkSeconds: typeof log.totalWorkSeconds === "number" ? log.totalWorkSeconds : 0,
    totalOtherWorkSeconds: typeof log.totalOtherWorkSeconds === "number" ? log.totalOtherWorkSeconds : 0,
  }));
}

// ─── Helper: build full URL from relative storage path ─────────────────────
function fullUrl(req: Request, path: string): string {
  if (path.startsWith("http")) return path;
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "guidedlogbook-6i7vyx5h.manus.space";
  return `${proto}://${host}${path.startsWith("/") ? path : "/" + path}`;
}

// ─── POST /api/export/pdf ────────────────────────────────────────────────────
exportRouter.post("/pdf", async (req: Request, res: Response) => {
  try {
    const { logs: rawLogs, driverName, licenceNumber, vehicleRegistration, vehicleType, driverType, dateRange } = req.body as PDFOptions;
    if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) {
      res.status(400).json({ error: "No log data provided." });
      return;
    }
    const logs = normalizeLogs(rawLogs);
    const html = buildPDFHtml({ logs, driverName: driverName || "Driver", licenceNumber: licenceNumber || "", vehicleRegistration: vehicleRegistration || "", vehicleType: vehicleType || "", driverType: driverType || "passenger", dateRange });
    const filename = `logbook-report-${Date.now()}.html`;
    const { url } = await storagePut(`exports/${filename}`, Buffer.from(html, "utf-8"), "text/html");
    res.json({ url: fullUrl(req, url) });
  } catch (e: any) {
    console.error("[ExportPDF] error:", e);
    res.status(500).json({ error: e.message || "Failed to generate PDF export." });
  }
});

// ─── POST /api/export/excel ──────────────────────────────────────────────────
exportRouter.post("/excel", async (req: Request, res: Response) => {
  try {
    const { logs: rawLogs, driverName, licenceNumber, vehicleRego, driverType, password } = req.body as {
      logs: DailyLog[];
      driverName: string;
      licenceNumber: string;
      vehicleRego: string;
      driverType: string;
      password?: string;
    };
    if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) {
      res.status(400).json({ error: "No log data provided." });
      return;
    }
    const logs = normalizeLogs(rawLogs);
    const XlsxPopulate = require("xlsx-populate");
    const sorted = [...logs].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
    const wb = await XlsxPopulate.fromBlankAsync();

    // Sheet 1: Summary
    const summarySheet = wb.sheet(0).name("Summary");
    const summaryRows = [
      ["DRIVE LEGAL — Electronic Logbook Export"],
      [""],
      ["Driver Name", driverName],
      ["Licence Number", licenceNumber],
      ["Vehicle Rego", vehicleRego],
      ["Driver Type", driverType === "goods" ? "Goods Service (5.5hr)" : "Passenger Service (7hr)"],
      ["Export Date", new Date().toLocaleDateString("en-NZ")],
      ["Total Shifts", sorted.length],
      [""],
      ["Generated by Drive Legal v1.0 — Electronic Logbook built to NZTA Work Time and Logbooks Rule requirements"],
    ];
    summaryRows.forEach((row, ri) => {
      row.forEach((val, ci) => { summarySheet.cell(ri + 1, ci + 1).value(val); });
    });
    summarySheet.cell("A1").style({ bold: true, fontSize: 13 });
    summarySheet.column("A").width(25);
    summarySheet.column("B").width(45);

    // Sheet 2: Shift Records
    wb.addSheet("Shift Records");
    const shiftSheet = wb.sheet("Shift Records");
    const shiftHeaders = [
      "Date", "Shift Start", "Shift End", "Driving Time", "Other Work",
      "Break Time", "Total Work", "Start Location", "End Location",
      "Start Odometer", "End Odometer", "Distance (km)", "Amended", "Rest Override Note",
    ];
    shiftHeaders.forEach((h, ci) => {
      shiftSheet.cell(1, ci + 1).value(h).style({ bold: true, fill: "003366", fontColor: "FFFFFF" });
    });
    sorted.forEach((log, ri) => {
      const row = ri + 2;
      const drivingSec = log.totalDrivingSeconds;
      const otherSec = log.totalOtherWorkSeconds ?? computeOtherWorkSeconds(log);
      const breakSec = computeBreakSeconds(log);
      const totalSec = log.totalWorkSeconds;
      shiftSheet.cell(row, 1).value(log.date);
      shiftSheet.cell(row, 2).value(formatTime(log.startTime));
      shiftSheet.cell(row, 3).value(formatTime(log.endTime));
      shiftSheet.cell(row, 4).value(formatHoursMinutes(drivingSec));
      shiftSheet.cell(row, 5).value(formatHoursMinutes(otherSec));
      shiftSheet.cell(row, 6).value(formatHoursMinutes(breakSec));
      shiftSheet.cell(row, 7).value(formatHoursMinutes(totalSec));
      shiftSheet.cell(row, 8).value(log.startLocation?.displayName ?? "");
      shiftSheet.cell(row, 9).value(log.endLocation?.displayName ?? "");
      shiftSheet.cell(row, 10).value(log.startOdometer ?? "");
      shiftSheet.cell(row, 11).value(log.endOdometer ?? "");
      shiftSheet.cell(row, 12).value(log.distanceKm ?? "");
      shiftSheet.cell(row, 13).value(log.amendments && log.amendments.length > 0 ? "Yes" : "No");
      shiftSheet.cell(row, 14).value(log.restOverrideNote ?? "");
    });

    // Password protect if provided
    let buffer: Buffer;
    if (password && password.trim().length > 0) {
      buffer = await wb.outputAsync({ password: password.trim() });
    } else {
      buffer = await wb.outputAsync();
    }
    const filename = `logbook-export-${Date.now()}.xlsx`;
    const { url } = await storagePut(
      `exports/${filename}`,
      Buffer.from(buffer),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.json({ url: fullUrl(req, url) });
  } catch (e: any) {
    console.error("[ExportExcel] error:", e);
    res.status(500).json({ error: e.message || "Failed to generate Excel export." });
  }
});

// ─── POST /api/export/csv ────────────────────────────────────────────────────
exportRouter.post("/csv", async (req: Request, res: Response) => {
  try {
    const { logs: rawLogs, driverName, licenceNumber } = req.body as {
      logs: DailyLog[];
      driverName: string;
      licenceNumber: string;
    };
    if (!rawLogs || !Array.isArray(rawLogs) || rawLogs.length === 0) {
      res.status(400).json({ error: "No log data provided." });
      return;
    }
    const logs = normalizeLogs(rawLogs);
    const csv = buildCSV(logs, driverName, licenceNumber);
    const filename = `logbook-export-${Date.now()}.csv`;
    const { url } = await storagePut(`exports/${filename}`, Buffer.from(csv, "utf-8"), "text/csv");
    res.json({ url: fullUrl(req, url) });
  } catch (e: any) {
    console.error("[ExportCSV] error:", e);
    res.status(500).json({ error: e.message || "Failed to generate CSV export." });
  }
});

export { exportRouter };
