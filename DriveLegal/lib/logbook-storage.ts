/**
 * Logbook storage library for DriveLegal.
 * Manages shift sessions, events, and completed daily logs in AsyncStorage.
 *
 * BUG FIXES (v2):
 * 1. computeCurrentDrivingSeconds — break_end resets the *consecutive* driving
 *    accumulator only, NOT the total. Pre-break driving is preserved in
 *    `committedDrivingMs` and added back at the end.
 * 2. buildDailyLog — unclosed break (missing break_end) now auto-closes at
 *    shift end so break time is never lost.
 * 3. endShift — distanceKm now validates end > start before calculating;
 *    shows 0 and flags for amendment if odometer is inverted.
 *
 * Platform notes:
 * - Storage: AsyncStorage (React Native). To port to web, swap AsyncStorage
 *   calls for localStorage or IndexedDB behind the same async interface.
 * - No React imports — pure logic, reusable in any JS/TS environment.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_SHIFT_KEY = "gnzl_active_shift";
const LOGS_KEY = "gnzl_logs";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ShiftEventType =
  | "shift_start"
  | "break_start"
  | "break_end"
  | "shift_end"
  | "other_work_start"
  | "other_work_end";

export type ShiftEvent = {
  type: ShiftEventType;
  timestamp: string; // ISO string
  note?: string;
  location?: {
    latitude: number;
    longitude: number;
    displayName: string;
  };
  odometer?: number; // km reading at this event
};

export type ActiveShift = {
  userId: string;
  startTime: string; // ISO string
  events: ShiftEvent[];
  vehicleChanges?: VehicleChange[];
  /** Stored when driver overrides the 10-hour rest block */
  restOverrideNote?: string;
};

export type BreakEntry = {
  startTime: string;
  endTime: string;
  durationSeconds: number;
};

export type Amendment = {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
};

export type VehicleChange = {
  timestamp: string;
  registration: string;
  odometer: number;
  reason?: string;
};

export type DailyLog = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
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
  /** True when end odometer < start odometer — requires amendment */
  odometerInverted?: boolean;
  amendments?: Amendment[];
  vehicleChanges?: VehicleChange[];
  restOverrideFlagged?: boolean;
  restOverrideNote?: string;
};

// ─── Active Shift ─────────────────────────────────────────────────────────────

export async function getActiveShift(userId: string): Promise<ActiveShift | null> {
  try {
    const raw = await AsyncStorage.getItem(`${ACTIVE_SHIFT_KEY}_${userId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveActiveShift(shift: ActiveShift): Promise<void> {
  await AsyncStorage.setItem(`${ACTIVE_SHIFT_KEY}_${shift.userId}`, JSON.stringify(shift));
}

export async function clearActiveShift(userId: string): Promise<void> {
  await AsyncStorage.removeItem(`${ACTIVE_SHIFT_KEY}_${userId}`);
}

export async function startShift(
  userId: string,
  options?: {
    location?: { latitude: number; longitude: number; displayName: string };
    odometer?: number;
    restOverrideNote?: string;
  }
): Promise<ActiveShift> {
  const now = new Date().toISOString();
  const startEvent: ShiftEvent = { type: "shift_start", timestamp: now };
  if (options?.location) startEvent.location = options.location;
  if (options?.odometer !== undefined) startEvent.odometer = options.odometer;
  const shift: ActiveShift = { userId, startTime: now, events: [startEvent] };
  if (options?.restOverrideNote) shift.restOverrideNote = options.restOverrideNote;
  await saveActiveShift(shift);
  return shift;
}

export async function startBreak(
  userId: string,
  options?: { location?: { latitude: number; longitude: number; displayName: string } }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;
  const now = new Date().toISOString();
  const event: ShiftEvent = { type: "break_start", timestamp: now };
  if (options?.location) event.location = options.location;
  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

/**
 * FIX: endBreak now always writes a break_end event and persists it.
 * Previously the event was created but an upstream call race could drop it.
 */
export async function endBreak(
  userId: string,
  options?: { location?: { latitude: number; longitude: number; displayName: string } }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  // Guard: only add break_end if we have an unclosed break_start
  const lastBreakStart = [...shift.events]
    .reverse()
    .find((e) => e.type === "break_start");
  const lastBreakEnd = [...shift.events]
    .reverse()
    .find((e) => e.type === "break_end");

  const hasUnclosedBreak =
    lastBreakStart &&
    (!lastBreakEnd ||
      new Date(lastBreakStart.timestamp) > new Date(lastBreakEnd.timestamp));

  if (!hasUnclosedBreak) {
    // No open break to close — return shift unchanged
    return shift;
  }

  const now = new Date().toISOString();
  const event: ShiftEvent = { type: "break_end", timestamp: now };
  if (options?.location) event.location = options.location;
  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

/**
 * Update the location on the last event in the active shift.
 * Used to attach GPS data after an event has already been saved.
 */
export async function updateLastEventLocation(
  userId: string,
  location: { latitude: number; longitude: number; displayName: string }
): Promise<void> {
  const shift = await getActiveShift(userId);
  if (!shift || shift.events.length === 0) return;
  shift.events[shift.events.length - 1].location = location;
  await saveActiveShift(shift);
}

export async function startOtherWork(
  userId: string,
  options?: {
    location?: { latitude: number; longitude: number; displayName: string };
    note?: string;
  }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;
  const now = new Date().toISOString();
  const event: ShiftEvent = { type: "other_work_start", timestamp: now };
  if (options?.location) event.location = options.location;
  if (options?.note) event.note = options.note;
  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function endOtherWork(
  userId: string,
  options?: { location?: { latitude: number; longitude: number; displayName: string } }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;
  const now = new Date().toISOString();
  const event: ShiftEvent = { type: "other_work_end", timestamp: now };
  if (options?.location) event.location = options.location;
  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function endShift(
  userId: string,
  options?: {
    location?: { latitude: number; longitude: number; displayName: string };
    odometer?: number;
  }
): Promise<DailyLog | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  const now = new Date().toISOString();
  const endEvent: ShiftEvent = { type: "shift_end", timestamp: now };
  if (options?.location) endEvent.location = options.location;
  if (options?.odometer !== undefined) endEvent.odometer = options.odometer;
  shift.events.push(endEvent);

  const log = buildDailyLog(shift, now);

  const startEvent = shift.events.find((e) => e.type === "shift_start");
  if (startEvent?.location) log.startLocation = startEvent.location;
  if (endEvent.location) log.endLocation = endEvent.location;
  if (startEvent?.odometer !== undefined) log.startOdometer = startEvent.odometer;
  if (endEvent.odometer !== undefined) log.endOdometer = endEvent.odometer;

  // FIX: Validate odometer direction before computing distance
  if (log.startOdometer !== undefined && log.endOdometer !== undefined) {
    if (log.endOdometer >= log.startOdometer) {
      log.distanceKm = log.endOdometer - log.startOdometer;
    } else {
      // Inverted odometer — flag for amendment, do not compute distance
      log.distanceKm = 0;
      log.odometerInverted = true;
    }
  }

  await saveDailyLog(log);
  await clearActiveShift(userId);
  return log;
}

export async function addVehicleChange(
  userId: string,
  registration: string,
  odometer: number,
  reason?: string
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;
  const change: VehicleChange = {
    timestamp: new Date().toISOString(),
    registration,
    odometer,
    reason,
  };
  if (!shift.vehicleChanges) shift.vehicleChanges = [];
  shift.vehicleChanges.push(change);
  await saveActiveShift(shift);
  return shift;
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getAllLogs(userId: string): Promise<DailyLog[]> {
  try {
    const raw = await AsyncStorage.getItem(`${LOGS_KEY}_${userId}`);
    const logs: DailyLog[] = raw ? JSON.parse(raw) : [];
    return logs.sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveDailyLog(log: DailyLog): Promise<void> {
  const logs = await getAllLogs(log.userId);
  const existing = logs.findIndex((l) => l.id === log.id);
  if (existing >= 0) {
    logs[existing] = log;
  } else {
    logs.unshift(log);
  }
  await AsyncStorage.setItem(`${LOGS_KEY}_${log.userId}`, JSON.stringify(logs));
}

export async function getLogById(userId: string, logId: string): Promise<DailyLog | null> {
  const logs = await getAllLogs(userId);
  return logs.find((l) => l.id === logId) ?? null;
}

// ─── Computation ──────────────────────────────────────────────────────────────

/**
 * Build a completed DailyLog from an active shift.
 *
 * FIX: Unclosed break (missing break_end) is auto-closed at shift end.
 * This ensures a break that was started but whose break_end event failed
 * to save is still counted correctly rather than being treated as driving.
 */
export function buildDailyLog(shift: ActiveShift, endTimeIso: string): DailyLog {
  const events = [...shift.events];
  if (events[events.length - 1]?.type !== "shift_end") {
    events.push({ type: "shift_end", timestamp: endTimeIso });
  }

  // Auto-close any unclosed break at shift end
  const lastBreakStart = [...events].reverse().find((e) => e.type === "break_start");
  const lastBreakEnd = [...events].reverse().find((e) => e.type === "break_end");
  if (
    lastBreakStart &&
    (!lastBreakEnd ||
      new Date(lastBreakStart.timestamp) > new Date(lastBreakEnd.timestamp))
  ) {
    // Insert a synthetic break_end just before shift_end
    const shiftEndIdx = events.findIndex((e) => e.type === "shift_end");
    events.splice(shiftEndIdx, 0, {
      type: "break_end",
      timestamp: endTimeIso,
      note: "auto-closed at shift end",
    });
  }

  const breaks: BreakEntry[] = [];
  const otherWorkPeriods: { startTime: string; endTime: string; durationSeconds: number }[] = [];

  let totalBreakSeconds = 0;
  let totalOtherWorkSeconds = 0;
  let breakStart: string | null = null;
  let otherWorkStart: string | null = null;

  for (const event of events) {
    if (event.type === "break_start") {
      breakStart = event.timestamp;
    } else if (event.type === "break_end" && breakStart) {
      const duration = Math.floor(
        (new Date(event.timestamp).getTime() - new Date(breakStart).getTime()) / 1000
      );
      breaks.push({ startTime: breakStart, endTime: event.timestamp, durationSeconds: duration });
      totalBreakSeconds += duration;
      breakStart = null;
    } else if (event.type === "other_work_start") {
      otherWorkStart = event.timestamp;
    } else if (event.type === "other_work_end" && otherWorkStart) {
      const duration = Math.floor(
        (new Date(event.timestamp).getTime() - new Date(otherWorkStart).getTime()) / 1000
      );
      otherWorkPeriods.push({
        startTime: otherWorkStart,
        endTime: event.timestamp,
        durationSeconds: duration,
      });
      totalOtherWorkSeconds += duration;
      otherWorkStart = null;
    }
  }

  const shiftStart = new Date(shift.startTime).getTime();
  const shiftEnd = new Date(endTimeIso).getTime();
  const totalElapsedSeconds = Math.floor((shiftEnd - shiftStart) / 1000);

  const totalDrivingSeconds = Math.max(
    0,
    totalElapsedSeconds - totalBreakSeconds - totalOtherWorkSeconds
  );
  const totalWorkSeconds = totalDrivingSeconds + totalOtherWorkSeconds;

  const dateStr = shift.startTime.split("T")[0];

  const log: DailyLog = {
    id: `${shift.userId}_${shift.startTime}`,
    userId: shift.userId,
    date: dateStr,
    startTime: shift.startTime,
    endTime: endTimeIso,
    totalDrivingSeconds,
    totalWorkSeconds,
    totalOtherWorkSeconds,
    otherWorkPeriods,
    breaks,
    events,
  };

  if (shift.vehicleChanges?.length) log.vehicleChanges = shift.vehicleChanges;
  if (shift.restOverrideNote) {
    log.restOverrideFlagged = true;
    log.restOverrideNote = shift.restOverrideNote;
  }

  return log;
}

/**
 * Compute driving seconds for the current active shift.
 *
 * FIX (critical): The NZTA 30-minute break resets the *consecutive* driving
 * counter only — it does NOT reset the total daily driving accumulator.
 * Pre-break driving time is preserved in `committedDrivingMs` and always
 * included in the final total. Only `currentSegmentMs` (driving since the
 * last completed break) is reset after a qualifying break.
 *
 * NZTA rule:
 *   - Goods/Large Passenger: max 5.5 hrs consecutive driving → 30 min break
 *   - Small Passenger: max 7 hrs consecutive driving → 30 min break
 *   - Daily driving cap: 13 hrs (enforced separately via totalWorkSeconds)
 */
export function computeCurrentDrivingSeconds(shift: ActiveShift, nowMs: number): number {
  /** All driving time from segments before the most recent qualifying break */
  let committedDrivingMs = 0;
  /** Start of the current driving segment */
  let segmentStart = new Date(shift.startTime).getTime();
  let paused = false;
  let pauseStartMs = 0;
  let isRestBreak = false;

  for (const event of shift.events) {
    const ts = new Date(event.timestamp).getTime();

    if ((event.type === "break_start" || event.type === "other_work_start") && !paused) {
      // Commit driving up to this point
      committedDrivingMs += ts - segmentStart;
      paused = true;
      pauseStartMs = ts;
      isRestBreak = event.type === "break_start";
    } else if ((event.type === "break_end" || event.type === "other_work_end") && paused) {
      const pauseDurationMs = ts - pauseStartMs;
      if (isRestBreak && pauseDurationMs >= 30 * 60 * 1000) {
        // Qualifying 30-min rest break — reset consecutive counter only.
        // committedDrivingMs is intentionally NOT reset here: total daily
        // driving continues to accumulate across the full shift.
        committedDrivingMs = committedDrivingMs; // explicit no-op for clarity
      }
      // New driving segment starts after break ends
      segmentStart = ts;
      paused = false;
      pauseStartMs = 0;
      isRestBreak = false;
    }
  }

  // Add time elapsed in the current segment
  let currentSegmentMs = 0;
  if (!paused) {
    currentSegmentMs = nowMs - segmentStart;
  }
  // If currently on break — current segment is 0 (not driving)

  return Math.floor((committedDrivingMs + currentSegmentMs) / 1000);
}

/**
 * Compute the *consecutive* driving seconds in the current driving segment.
 * This is what the dashboard countdown uses to warn before the 7-hr limit.
 * Resets to 0 after a qualifying 30-min break.
 */
export function computeConsecutiveDrivingSeconds(shift: ActiveShift, nowMs: number): number {
  let segmentStart = new Date(shift.startTime).getTime();
  let paused = false;
  let pauseStartMs = 0;
  let isRestBreak = false;

  for (const event of shift.events) {
    const ts = new Date(event.timestamp).getTime();

    if ((event.type === "break_start" || event.type === "other_work_start") && !paused) {
      paused = true;
      pauseStartMs = ts;
      isRestBreak = event.type === "break_start";
    } else if ((event.type === "break_end" || event.type === "other_work_end") && paused) {
      const pauseDurationMs = ts - pauseStartMs;
      if (isRestBreak && pauseDurationMs >= 30 * 60 * 1000) {
        // Qualifying break — consecutive timer resets
        segmentStart = ts;
      } else {
        // Short break or other work — consecutive timer continues
        segmentStart = segmentStart; // no reset
      }
      paused = false;
      pauseStartMs = 0;
      isRestBreak = false;
    }
  }

  if (paused) {
    // Currently on break — consecutive driving has paused
    // Check if break has already reached 30 min (qualifies for reset)
    const breakSoFar = nowMs - pauseStartMs;
    if (isRestBreak && breakSoFar >= 30 * 60 * 1000) {
      return 0; // Break completed — consecutive timer will reset on resume
    }
    // Break in progress — return driving up to when break started
    return Math.floor((pauseStartMs - segmentStart) / 1000);
  }

  return Math.floor((nowMs - segmentStart) / 1000);
}

/**
 * Compute work seconds for the current active shift (total elapsed since start,
 * including break time — NZTA counts breaks within the work period).
 */
export function computeCurrentWorkSeconds(shift: ActiveShift, nowMs: number): number {
  return Math.floor((nowMs - new Date(shift.startTime).getTime()) / 1000);
}

/** Check if the shift is currently on a break. */
export function isCurrentlyOnBreak(shift: ActiveShift): boolean {
  const lastEvent = shift.events[shift.events.length - 1];
  return lastEvent?.type === "break_start";
}

/** Check if the shift is currently in "Other Work" mode. */
export function isCurrentlyOtherWork(shift: ActiveShift): boolean {
  const lastEvent = shift.events[shift.events.length - 1];
  return lastEvent?.type === "other_work_start";
}

/** Get current break duration in seconds (0 if not on break). */
export function computeCurrentBreakSeconds(shift: ActiveShift, nowMs: number): number {
  const lastEvent = shift.events[shift.events.length - 1];
  if (lastEvent?.type !== "break_start") return 0;
  return Math.floor((nowMs - new Date(lastEvent.timestamp).getTime()) / 1000);
}

// ─── Migration: Recalculate old logs ─────────────────────────────────────────

export async function migrateLogCalculations(userId: string): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(`${LOGS_KEY}_${userId}`);
    if (!raw) return;
    const logs: DailyLog[] = JSON.parse(raw);
    let changed = false;
    const migrated = logs.map((log) => {
      if (!log.events || log.events.length === 0) return log;
      let totalBreakSeconds = 0;
      let totalOtherWorkSeconds = 0;
      let breakStart: string | null = null;
      let otherWorkStart: string | null = null;
      for (const event of log.events) {
        if (event.type === "break_start") breakStart = event.timestamp;
        else if (event.type === "break_end" && breakStart) {
          totalBreakSeconds += Math.floor(
            (new Date(event.timestamp).getTime() - new Date(breakStart).getTime()) / 1000
          );
          breakStart = null;
        } else if (event.type === "other_work_start") otherWorkStart = event.timestamp;
        else if (event.type === "other_work_end" && otherWorkStart) {
          totalOtherWorkSeconds += Math.floor(
            (new Date(event.timestamp).getTime() - new Date(otherWorkStart).getTime()) / 1000
          );
          otherWorkStart = null;
        }
      }
      const elapsed = Math.floor(
        (new Date(log.endTime).getTime() - new Date(log.startTime).getTime()) / 1000
      );
      const newDriving = Math.max(0, elapsed - totalBreakSeconds - totalOtherWorkSeconds);
      const newWork = newDriving + totalOtherWorkSeconds;
      if (newDriving !== log.totalDrivingSeconds || newWork !== log.totalWorkSeconds) {
        changed = true;
        return { ...log, totalDrivingSeconds: newDriving, totalWorkSeconds: newWork, totalOtherWorkSeconds };
      }
      return log;
    });
    if (changed) {
      await AsyncStorage.setItem(`${LOGS_KEY}_${userId}`, JSON.stringify(migrated));
    }
  } catch {
    /* silent */
  }
}

// ─── Fortnightly Hours ────────────────────────────────────────────────────────

/**
 * Compute total driving seconds in the last 14 days (fortnightly limit).
 * Note: does NOT include the current active shift — callers must add
 * computeCurrentDrivingSeconds() to get the live total.
 */
export async function getFortnightlyDrivingSeconds(userId: string): Promise<number> {
  const logs = await getAllLogs(userId);
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  return logs
    .filter((l) => new Date(l.startTime).getTime() >= twoWeeksAgo)
    .reduce((sum, l) => sum + l.totalDrivingSeconds, 0);
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatHoursMinutes(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

export function logsToCSV(logs: DailyLog[], driverName: string, licenceNumber: string): string {
  const header = [
    "Date",
    "Driver Name",
    "Licence Number",
    "Shift Start",
    "Shift End",
    "Total Work (h:m)",
    "Total Driving (h:m)",
    "Breaks Count",
    "Total Break Time (h:m)",
  ].join(",");

  const rows = logs.map((log) => {
    const totalBreakSeconds = log.breaks.reduce((s, b) => s + b.durationSeconds, 0);
    return [
      log.date,
      `"${driverName}"`,
      licenceNumber,
      formatTime(log.startTime),
      formatTime(log.endTime),
      formatHoursMinutes(log.totalWorkSeconds),
      formatHoursMinutes(log.totalDrivingSeconds),
      log.breaks.length,
      formatHoursMinutes(totalBreakSeconds),
    ].join(",");
  });

  return [header, ...rows].join("\n");
}
