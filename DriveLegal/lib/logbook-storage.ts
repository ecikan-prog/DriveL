/**
 * DriveLegal logbook storage and NZ work-time calculation engine.
 *
 * Core rules implemented:
 * - Standard drivers: at least 30 minutes rest after 5.5 hours of continuous work.
 * - Eligible small passenger short-fare drivers: at least 30 minutes rest
 *   after 7 hours of continuous work.
 * - Maximum 13 hours of work in a cumulative work day.
 * - At least 10 continuous hours of rest between cumulative work days.
 * - Maximum 70 hours of work in a cumulative work period.
 * - At least 24 continuous hours of rest resets the cumulative work period.
 *
 * Important:
 * - "Work time" includes driving and other work.
 * - Recorded rest-break time is excluded from total work.
 * - A break shorter than 30 minutes pauses work but does not reset the
 *   continuous-work counter.
 * - The 7-hour rule must only be selected when the driver is legally eligible
 *   for the small-passenger short-fare provision.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const ACTIVE_SHIFT_KEY = "gnzl_active_shift";
const LOGS_KEY = "gnzl_logs";

export const WORK_TIME_LIMITS = {
  QUALIFYING_BREAK_SECONDS: 30 * 60,
  STANDARD_CONTINUOUS_WORK_SECONDS: 5.5 * 60 * 60,
  SPS_SHORT_FARES_CONTINUOUS_WORK_SECONDS: 7 * 60 * 60,
  CUMULATIVE_WORK_DAY_SECONDS: 13 * 60 * 60,
  CUMULATIVE_WORK_DAY_REST_SECONDS: 10 * 60 * 60,
  CUMULATIVE_WORK_PERIOD_SECONDS: 70 * 60 * 60,
  CUMULATIVE_WORK_PERIOD_REST_SECONDS: 24 * 60 * 60,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkTimeRule =
  | "standard_5_5_hour"
  | "sps_short_fares_7_hour";

export type ShiftEventType =
  | "shift_start"
  | "break_start"
  | "break_end"
  | "shift_end"
  | "other_work_start"
  | "other_work_end";

export type LogLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
};

export type ShiftEvent = {
  type: ShiftEventType;
  timestamp: string;
  note?: string;
  location?: LogLocation;
  odometer?: number;
};

export type VehicleChange = {
  timestamp: string;
  registration: string;
  odometer: number;
  reason?: string;
};

export type ActiveShift = {
  userId: string;
  startTime: string;
  events: ShiftEvent[];
  workTimeRule?: WorkTimeRule;
  vehicleChanges?: VehicleChange[];
  /** Stored when the driver overrides the 10-hour-rest start block. */
  restOverrideNote?: string;
};

export type BreakEntry = {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  qualifiesForReset?: boolean;
  autoClosed?: boolean;
};

export type OtherWorkPeriod = {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  autoClosed?: boolean;
};

export type Amendment = {
  timestamp: string;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
};

export type DailyLog = {
  id: string;
  userId: string;
  date: string;
  workTimeRule?: WorkTimeRule;
  startTime: string;
  endTime: string;
  totalDrivingSeconds: number;
  totalWorkSeconds: number;
  totalOtherWorkSeconds?: number;
  otherWorkPeriods?: OtherWorkPeriod[];
  breaks: BreakEntry[];
  events: ShiftEvent[];
  startLocation?: LogLocation;
  endLocation?: LogLocation;
  startOdometer?: number;
  endOdometer?: number;
  distanceKm?: number;
  odometerInverted?: boolean;
  amendments?: Amendment[];
  vehicleChanges?: VehicleChange[];
  restOverrideFlagged?: boolean;
  restOverrideNote?: string;
};

export type ComplianceSnapshot = {
  workTimeRule: WorkTimeRule;
  continuousWorkSeconds: number;
  continuousWorkLimitSeconds: number;
  continuousWorkRemainingSeconds: number;
  continuousWorkExceeded: boolean;
  qualifyingBreakInProgress: boolean;
  currentBreakSeconds: number;
  cumulativeWorkDaySeconds: number;
  cumulativeWorkDayRemainingSeconds: number;
  cumulativeWorkDayExceeded: boolean;
  cumulativeWorkPeriodSeconds: number;
  cumulativeWorkPeriodRemainingSeconds: number;
  cumulativeWorkPeriodExceeded: boolean;
};

type ActivityState = "driving" | "break" | "other_work";

type ActivityTotals = {
  drivingSeconds: number;
  workSeconds: number;
  otherWorkSeconds: number;
  breakSeconds: number;
  breaks: BreakEntry[];
  otherWorkPeriods: OtherWorkPeriod[];
};

type WorkInterval = {
  startMs: number;
  endMs: number;
  workSeconds: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toMs(value: string | number): number | null {
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function nonNegativeSeconds(startMs: number, endMs: number): number {
  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function sortEvents(events: ShiftEvent[]): ShiftEvent[] {
  return [...events].sort((a, b) => {
    const aMs = toMs(a.timestamp) ?? Number.MAX_SAFE_INTEGER;
    const bMs = toMs(b.timestamp) ?? Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });
}

function getRule(rule?: WorkTimeRule): WorkTimeRule {
  return rule ?? "standard_5_5_hour";
}

export function getContinuousWorkLimitSeconds(
  rule?: WorkTimeRule
): number {
  return getRule(rule) === "sps_short_fares_7_hour"
    ? WORK_TIME_LIMITS.SPS_SHORT_FARES_CONTINUOUS_WORK_SECONDS
    : WORK_TIME_LIMITS.STANDARD_CONTINUOUS_WORK_SECONDS;
}

function getLastEventOfType(
  events: ShiftEvent[],
  type: ShiftEventType
): ShiftEvent | undefined {
  return [...events].reverse().find((event) => event.type === type);
}

function hasOpenEventPair(
  events: ShiftEvent[],
  startType: ShiftEventType,
  endType: ShiftEventType
): boolean {
  const lastStart = getLastEventOfType(events, startType);
  if (!lastStart) return false;

  const lastEnd = getLastEventOfType(events, endType);
  if (!lastEnd) return true;

  const startMs = toMs(lastStart.timestamp);
  const endMs = toMs(lastEnd.timestamp);

  return startMs !== null && (endMs === null || startMs > endMs);
}

function calculateActivityTotals(
  shiftStartIso: string,
  events: ShiftEvent[],
  endMs: number
): ActivityTotals {
  const startMs = toMs(shiftStartIso);

  if (startMs === null || !Number.isFinite(endMs) || endMs < startMs) {
    return {
      drivingSeconds: 0,
      workSeconds: 0,
      otherWorkSeconds: 0,
      breakSeconds: 0,
      breaks: [],
      otherWorkPeriods: [],
    };
  }

  let state: ActivityState = "driving";
  let cursorMs = startMs;
  let breakStartMs: number | null = null;
  let otherWorkStartMs: number | null = null;

  let drivingSeconds = 0;
  let otherWorkSeconds = 0;
  let breakSeconds = 0;

  const breaks: BreakEntry[] = [];
  const otherWorkPeriods: OtherWorkPeriod[] = [];

  const commitStateDuration = (untilMs: number): void => {
    const seconds = nonNegativeSeconds(cursorMs, untilMs);

    if (state === "driving") drivingSeconds += seconds;
    else if (state === "other_work") otherWorkSeconds += seconds;
    else breakSeconds += seconds;

    cursorMs = untilMs;
  };

  for (const event of sortEvents(events)) {
    const eventMs = toMs(event.timestamp);

    if (
      eventMs === null ||
      eventMs < startMs ||
      eventMs > endMs ||
      event.type === "shift_start"
    ) {
      continue;
    }

    commitStateDuration(eventMs);

    if (event.type === "break_start" && state !== "break") {
      if (state === "other_work" && otherWorkStartMs !== null) {
        otherWorkPeriods.push({
          startTime: new Date(otherWorkStartMs).toISOString(),
          endTime: new Date(eventMs).toISOString(),
          durationSeconds: nonNegativeSeconds(otherWorkStartMs, eventMs),
          autoClosed: true,
        });
        otherWorkStartMs = null;
      }

      state = "break";
      breakStartMs = eventMs;
    } else if (event.type === "break_end" && state === "break") {
      const start = breakStartMs ?? eventMs;
      const durationSeconds = nonNegativeSeconds(start, eventMs);

      breaks.push({
        startTime: new Date(start).toISOString(),
        endTime: new Date(eventMs).toISOString(),
        durationSeconds,
        qualifiesForReset:
          durationSeconds >= WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS,
        autoClosed: event.note === "auto-closed at shift end",
      });

      state = "driving";
      breakStartMs = null;
    } else if (
      event.type === "other_work_start" &&
      state !== "other_work"
    ) {
      if (state === "break" && breakStartMs !== null) {
        const durationSeconds = nonNegativeSeconds(breakStartMs, eventMs);
        breaks.push({
          startTime: new Date(breakStartMs).toISOString(),
          endTime: new Date(eventMs).toISOString(),
          durationSeconds,
          qualifiesForReset:
            durationSeconds >= WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS,
          autoClosed: true,
        });
        breakStartMs = null;
      }

      state = "other_work";
      otherWorkStartMs = eventMs;
    } else if (
      event.type === "other_work_end" &&
      state === "other_work"
    ) {
      const start = otherWorkStartMs ?? eventMs;

      otherWorkPeriods.push({
        startTime: new Date(start).toISOString(),
        endTime: new Date(eventMs).toISOString(),
        durationSeconds: nonNegativeSeconds(start, eventMs),
        autoClosed: event.note === "auto-closed at shift end",
      });

      state = "driving";
      otherWorkStartMs = null;
    } else if (event.type === "shift_end") {
      break;
    }
  }

  commitStateDuration(endMs);

  if (state === "break" && breakStartMs !== null) {
    const durationSeconds = nonNegativeSeconds(breakStartMs, endMs);
    breaks.push({
      startTime: new Date(breakStartMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      durationSeconds,
      qualifiesForReset:
        durationSeconds >= WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS,
      autoClosed: true,
    });
  } else if (state === "other_work" && otherWorkStartMs !== null) {
    otherWorkPeriods.push({
      startTime: new Date(otherWorkStartMs).toISOString(),
      endTime: new Date(endMs).toISOString(),
      durationSeconds: nonNegativeSeconds(otherWorkStartMs, endMs),
      autoClosed: true,
    });
  }

  return {
    drivingSeconds,
    workSeconds: drivingSeconds + otherWorkSeconds,
    otherWorkSeconds,
    breakSeconds,
    breaks,
    otherWorkPeriods,
  };
}

function createNormalisedCompletedEvents(
  shift: ActiveShift,
  endTimeIso: string
): ShiftEvent[] {
  const events = sortEvents(shift.events);
  const endMs = toMs(endTimeIso) ?? Date.now();

  if (hasOpenEventPair(events, "break_start", "break_end")) {
    events.push({
      type: "break_end",
      timestamp: new Date(endMs).toISOString(),
      note: "auto-closed at shift end",
    });
  }

  if (
    hasOpenEventPair(
      events,
      "other_work_start",
      "other_work_end"
    )
  ) {
    events.push({
      type: "other_work_end",
      timestamp: new Date(endMs).toISOString(),
      note: "auto-closed at shift end",
    });
  }

  if (!events.some((event) => event.type === "shift_end")) {
    events.push({
      type: "shift_end",
      timestamp: new Date(endMs).toISOString(),
    });
  }

  return sortEvents(events);
}

function buildCompletedWorkIntervals(logs: DailyLog[]): WorkInterval[] {
  return logs
    .map((log) => {
      const startMs = toMs(log.startTime);
      const endMs = toMs(log.endTime);

      if (startMs === null || endMs === null || endMs < startMs) {
        return null;
      }

      return {
        startMs,
        endMs,
        workSeconds: Math.max(0, log.totalWorkSeconds || 0),
      };
    })
    .filter((interval): interval is WorkInterval => interval !== null)
    .sort((a, b) => a.startMs - b.startMs);
}

function sumSinceLatestQualifyingRest(
  intervals: WorkInterval[],
  requiredRestSeconds: number,
  nowMs: number
): number {
  if (intervals.length === 0) return 0;

  const restMs = requiredRestSeconds * 1000;
  let periodStartIndex = 0;

  for (let index = 1; index < intervals.length; index += 1) {
    const gapMs = intervals[index].startMs - intervals[index - 1].endMs;

    if (gapMs >= restMs) {
      periodStartIndex = index;
    }
  }

  const last = intervals[intervals.length - 1];
  if (nowMs - last.endMs >= restMs) {
    return 0;
  }

  return intervals
    .slice(periodStartIndex)
    .reduce((sum, interval) => sum + interval.workSeconds, 0);
}

// ─── Active Shift Storage ─────────────────────────────────────────────────────

export async function getActiveShift(
  userId: string
): Promise<ActiveShift | null> {
  try {
    const raw = await AsyncStorage.getItem(
      `${ACTIVE_SHIFT_KEY}_${userId}`
    );

    if (!raw) return null;

    const parsed = JSON.parse(raw) as ActiveShift;

    return {
      ...parsed,
      workTimeRule: getRule(parsed.workTimeRule),
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return null;
  }
}

export async function saveActiveShift(
  shift: ActiveShift
): Promise<void> {
  await AsyncStorage.setItem(
    `${ACTIVE_SHIFT_KEY}_${shift.userId}`,
    JSON.stringify({
      ...shift,
      workTimeRule: getRule(shift.workTimeRule),
    })
  );
}

export async function clearActiveShift(
  userId: string
): Promise<void> {
  await AsyncStorage.removeItem(`${ACTIVE_SHIFT_KEY}_${userId}`);
}

export async function startShift(
  userId: string,
  options?: {
    location?: LogLocation;
    odometer?: number;
    restOverrideNote?: string;
    workTimeRule?: WorkTimeRule;
  }
): Promise<ActiveShift> {
  const now = new Date().toISOString();

  const startEvent: ShiftEvent = {
    type: "shift_start",
    timestamp: now,
  };

  if (options?.location) {
    startEvent.location = options.location;
  }

  if (
    options?.odometer !== undefined &&
    Number.isFinite(options.odometer)
  ) {
    startEvent.odometer = options.odometer;
  }

  const shift: ActiveShift = {
    userId,
    startTime: now,
    events: [startEvent],
    workTimeRule: getRule(options?.workTimeRule),
  };

  if (options?.restOverrideNote?.trim()) {
    shift.restOverrideNote = options.restOverrideNote.trim();
  }

  await saveActiveShift(shift);
  return shift;
}

export async function startBreak(
  userId: string,
  options?: { location?: LogLocation }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  if (
    isCurrentlyOnBreak(shift) ||
    isCurrentlyOtherWork(shift)
  ) {
    return shift;
  }

  const event: ShiftEvent = {
    type: "break_start",
    timestamp: new Date().toISOString(),
  };

  if (options?.location) event.location = options.location;

  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function endBreak(
  userId: string,
  options?: { location?: LogLocation }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  if (!hasOpenEventPair(shift.events, "break_start", "break_end")) {
    return shift;
  }

  const event: ShiftEvent = {
    type: "break_end",
    timestamp: new Date().toISOString(),
  };

  if (options?.location) event.location = options.location;

  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function updateLastEventLocation(
  userId: string,
  location: LogLocation
): Promise<void> {
  const shift = await getActiveShift(userId);
  if (!shift || shift.events.length === 0) return;

  shift.events[shift.events.length - 1].location = location;
  await saveActiveShift(shift);
}

export async function startOtherWork(
  userId: string,
  options?: {
    location?: LogLocation;
    note?: string;
  }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  if (
    isCurrentlyOnBreak(shift) ||
    isCurrentlyOtherWork(shift)
  ) {
    return shift;
  }

  const event: ShiftEvent = {
    type: "other_work_start",
    timestamp: new Date().toISOString(),
  };

  if (options?.location) event.location = options.location;
  if (options?.note?.trim()) event.note = options.note.trim();

  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function endOtherWork(
  userId: string,
  options?: { location?: LogLocation }
): Promise<ActiveShift | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  if (
    !hasOpenEventPair(
      shift.events,
      "other_work_start",
      "other_work_end"
    )
  ) {
    return shift;
  }

  const event: ShiftEvent = {
    type: "other_work_end",
    timestamp: new Date().toISOString(),
  };

  if (options?.location) event.location = options.location;

  shift.events.push(event);
  await saveActiveShift(shift);
  return shift;
}

export async function endShift(
  userId: string,
  options?: {
    location?: LogLocation;
    odometer?: number;
  }
): Promise<DailyLog | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  const now = new Date().toISOString();

  const endEvent: ShiftEvent = {
    type: "shift_end",
    timestamp: now,
  };

  if (options?.location) {
    endEvent.location = options.location;
  }

  if (
    options?.odometer !== undefined &&
    Number.isFinite(options.odometer)
  ) {
    endEvent.odometer = options.odometer;
  }

  shift.events.push(endEvent);

  const log = buildDailyLog(shift, now);
  const startEvent = shift.events.find(
    (event) => event.type === "shift_start"
  );

  if (startEvent?.location) log.startLocation = startEvent.location;
  if (endEvent.location) log.endLocation = endEvent.location;

  if (startEvent?.odometer !== undefined) {
    log.startOdometer = startEvent.odometer;
  }

  if (endEvent.odometer !== undefined) {
    log.endOdometer = endEvent.odometer;
  }

  if (
    log.startOdometer !== undefined &&
    log.endOdometer !== undefined
  ) {
    if (log.endOdometer >= log.startOdometer) {
      log.distanceKm = log.endOdometer - log.startOdometer;
    } else {
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

  if (
    !shift ||
    !registration.trim() ||
    !Number.isFinite(odometer)
  ) {
    return shift;
  }

  const change: VehicleChange = {
    timestamp: new Date().toISOString(),
    registration: registration.trim().toUpperCase(),
    odometer,
  };

  if (reason?.trim()) change.reason = reason.trim();

  shift.vehicleChanges ??= [];
  shift.vehicleChanges.push(change);

  await saveActiveShift(shift);
  return shift;
}

// ─── Daily Logs ───────────────────────────────────────────────────────────────

export async function getAllLogs(
  userId: string
): Promise<DailyLog[]> {
  try {
    const raw = await AsyncStorage.getItem(`${LOGS_KEY}_${userId}`);
    const logs = raw ? (JSON.parse(raw) as DailyLog[]) : [];

    return logs.sort((a, b) => {
      const bMs = toMs(b.startTime) ?? 0;
      const aMs = toMs(a.startTime) ?? 0;
      return bMs - aMs;
    });
  } catch {
    return [];
  }
}

export async function saveDailyLog(
  log: DailyLog
): Promise<void> {
  const logs = await getAllLogs(log.userId);
  const existingIndex = logs.findIndex(
    (existing) => existing.id === log.id
  );

  if (existingIndex >= 0) logs[existingIndex] = log;
  else logs.unshift(log);

  await AsyncStorage.setItem(
    `${LOGS_KEY}_${log.userId}`,
    JSON.stringify(logs)
  );
}

export async function getLogById(
  userId: string,
  logId: string
): Promise<DailyLog | null> {
  const logs = await getAllLogs(userId);
  return logs.find((log) => log.id === logId) ?? null;
}

// ─── Calculations ─────────────────────────────────────────────────────────────

export function buildDailyLog(
  shift: ActiveShift,
  endTimeIso: string
): DailyLog {
  const shiftStartMs = toMs(shift.startTime);
  const shiftEndMs = toMs(endTimeIso);

  if (shiftStartMs === null || shiftEndMs === null) {
    throw new Error("Cannot build log with invalid shift timestamps.");
  }

  const events = createNormalisedCompletedEvents(shift, endTimeIso);
  const totals = calculateActivityTotals(
    shift.startTime,
    events,
    shiftEndMs
  );

  const log: DailyLog = {
    id: `${shift.userId}_${shift.startTime}`,
    userId: shift.userId,
    date: shift.startTime.split("T")[0],
    workTimeRule: getRule(shift.workTimeRule),
    startTime: shift.startTime,
    endTime: endTimeIso,
    totalDrivingSeconds: totals.drivingSeconds,
    totalWorkSeconds: totals.workSeconds,
    totalOtherWorkSeconds: totals.otherWorkSeconds,
    otherWorkPeriods: totals.otherWorkPeriods,
    breaks: totals.breaks,
    events,
  };

  if (shift.vehicleChanges?.length) {
    log.vehicleChanges = [...shift.vehicleChanges];
  }

  if (shift.restOverrideNote) {
    log.restOverrideFlagged = true;
    log.restOverrideNote = shift.restOverrideNote;
  }

  return log;
}

/** Total driving time in the active shift. */
export function computeCurrentDrivingSeconds(
  shift: ActiveShift,
  nowMs: number
): number {
  return calculateActivityTotals(
    shift.startTime,
    shift.events,
    nowMs
  ).drivingSeconds;
}

/** Total work time in the active shift: driving plus other work. */
export function computeCurrentWorkSeconds(
  shift: ActiveShift,
  nowMs: number
): number {
  return calculateActivityTotals(
    shift.startTime,
    shift.events,
    nowMs
  ).workSeconds;
}

/**
 * Consecutive driving is retained for driving-time reporting.
 * Do not use this function as the legal rest-break countdown because
 * the statutory threshold is based on continuous work, including other work.
 */
export function computeConsecutiveDrivingSeconds(
  shift: ActiveShift,
  nowMs: number
): number {
  const startMs = toMs(shift.startTime);
  if (startMs === null || nowMs < startMs) return 0;

  let consecutiveDrivingMs = 0;
  let drivingStartMs = startMs;
  let state: ActivityState = "driving";
  let pauseStartMs: number | null = null;

  for (const event of sortEvents(shift.events)) {
    const eventMs = toMs(event.timestamp);

    if (
      eventMs === null ||
      eventMs < startMs ||
      eventMs > nowMs ||
      event.type === "shift_start"
    ) {
      continue;
    }

    if (
      (event.type === "break_start" ||
        event.type === "other_work_start") &&
      state === "driving"
    ) {
      consecutiveDrivingMs += Math.max(0, eventMs - drivingStartMs);
      pauseStartMs = eventMs;
      state =
        event.type === "break_start" ? "break" : "other_work";
    } else if (
      event.type === "break_end" &&
      state === "break"
    ) {
      const breakDurationMs = Math.max(
        0,
        eventMs - (pauseStartMs ?? eventMs)
      );

      if (
        breakDurationMs >=
        WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS * 1000
      ) {
        consecutiveDrivingMs = 0;
      }

      drivingStartMs = eventMs;
      pauseStartMs = null;
      state = "driving";
    } else if (
      event.type === "other_work_end" &&
      state === "other_work"
    ) {
      drivingStartMs = eventMs;
      pauseStartMs = null;
      state = "driving";
    }
  }

  if (state === "break") {
    const breakDurationMs = Math.max(
      0,
      nowMs - (pauseStartMs ?? nowMs)
    );

    if (
      breakDurationMs >=
      WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS * 1000
    ) {
      return 0;
    }

    return Math.floor(consecutiveDrivingMs / 1000);
  }

  if (state === "other_work") {
    return Math.floor(consecutiveDrivingMs / 1000);
  }

  consecutiveDrivingMs += Math.max(0, nowMs - drivingStartMs);
  return Math.floor(consecutiveDrivingMs / 1000);
}

/**
 * Continuous work includes driving and other work.
 * Break time is excluded. A break shorter than 30 minutes does not reset
 * the accumulated continuous-work total. A qualifying 30-minute break resets it.
 */
export function computeContinuousWorkSeconds(
  shift: ActiveShift,
  nowMs: number
): number {
  const startMs = toMs(shift.startTime);
  if (startMs === null || nowMs < startMs) return 0;

  let accumulatedWorkMs = 0;
  let workSegmentStartMs = startMs;
  let onBreak = false;
  let breakStartMs: number | null = null;

  for (const event of sortEvents(shift.events)) {
    const eventMs = toMs(event.timestamp);

    if (
      eventMs === null ||
      eventMs < startMs ||
      eventMs > nowMs ||
      event.type === "shift_start"
    ) {
      continue;
    }

    if (event.type === "break_start" && !onBreak) {
      accumulatedWorkMs += Math.max(
        0,
        eventMs - workSegmentStartMs
      );
      onBreak = true;
      breakStartMs = eventMs;
    } else if (event.type === "break_end" && onBreak) {
      const durationMs = Math.max(
        0,
        eventMs - (breakStartMs ?? eventMs)
      );

      if (
        durationMs >=
        WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS * 1000
      ) {
        accumulatedWorkMs = 0;
      }

      onBreak = false;
      breakStartMs = null;
      workSegmentStartMs = eventMs;
    }
  }

  if (onBreak) {
    const durationMs = Math.max(
      0,
      nowMs - (breakStartMs ?? nowMs)
    );

    if (
      durationMs >=
      WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS * 1000
    ) {
      return 0;
    }

    return Math.floor(accumulatedWorkMs / 1000);
  }

  accumulatedWorkMs += Math.max(0, nowMs - workSegmentStartMs);
  return Math.floor(accumulatedWorkMs / 1000);
}

export function isCurrentlyOnBreak(
  shift: ActiveShift
): boolean {
  return hasOpenEventPair(shift.events, "break_start", "break_end");
}

export function isCurrentlyOtherWork(
  shift: ActiveShift
): boolean {
  return hasOpenEventPair(
    shift.events,
    "other_work_start",
    "other_work_end"
  );
}

export function computeCurrentBreakSeconds(
  shift: ActiveShift,
  nowMs: number
): number {
  if (!isCurrentlyOnBreak(shift)) return 0;

  const start = getLastEventOfType(shift.events, "break_start");
  const startMs = start ? toMs(start.timestamp) : null;

  return startMs === null
    ? 0
    : nonNegativeSeconds(startMs, nowMs);
}

// ─── Cumulative Work-Time Calculations ────────────────────────────────────────

/**
 * Completed work in the current cumulative work day.
 * A gap of at least 10 continuous hours resets the cumulative work day.
 * The active shift is intentionally excluded.
 */
export async function getCompletedCumulativeWorkDaySeconds(
  userId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const logs = await getAllLogs(userId);

  return sumSinceLatestQualifyingRest(
    buildCompletedWorkIntervals(logs),
    WORK_TIME_LIMITS.CUMULATIVE_WORK_DAY_REST_SECONDS,
    nowMs
  );
}

/**
 * Completed work in the current cumulative work period.
 * A gap of at least 24 continuous hours resets the cumulative work period.
 * The active shift is intentionally excluded.
 */
export async function getCompletedCumulativeWorkPeriodSeconds(
  userId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const logs = await getAllLogs(userId);

  return sumSinceLatestQualifyingRest(
    buildCompletedWorkIntervals(logs),
    WORK_TIME_LIMITS.CUMULATIVE_WORK_PERIOD_REST_SECONDS,
    nowMs
  );
}

/**
 * Live cumulative work-day work, including the active shift.
 */
export async function getCumulativeWorkDaySeconds(
  userId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const active = await getActiveShift(userId);
  const activeStartMs = active ? toMs(active.startTime) : null;

  // When a shift is active, measure the rest gap only up to the moment
  // that work resumed. Time spent working must never be mistaken for rest.
  const restReferenceMs = activeStartMs ?? nowMs;
  const completed = await getCompletedCumulativeWorkDaySeconds(
    userId,
    restReferenceMs
  );

  return completed + (active
    ? computeCurrentWorkSeconds(active, nowMs)
    : 0);
}

/**
 * Live cumulative work-period work, including the active shift.
 */
export async function getCumulativeWorkPeriodSeconds(
  userId: string,
  nowMs: number = Date.now()
): Promise<number> {
  const active = await getActiveShift(userId);
  const activeStartMs = active ? toMs(active.startTime) : null;

  // When a shift is active, measure the rest gap only up to the moment
  // that work resumed. Time spent working must never be mistaken for rest.
  const restReferenceMs = activeStartMs ?? nowMs;
  const completed = await getCompletedCumulativeWorkPeriodSeconds(
    userId,
    restReferenceMs
  );

  return completed + (active
    ? computeCurrentWorkSeconds(active, nowMs)
    : 0);
}

/**
 * Backward-compatible export retained so existing screens continue compiling.
 * Despite the legacy name, this now returns completed WORK time in the current
 * cumulative work period, not driving time in a rolling 14-day window.
 */
export async function getFortnightlyDrivingSeconds(
  userId: string
): Promise<number> {
  return getCompletedCumulativeWorkPeriodSeconds(userId);
}

export async function getComplianceSnapshot(
  userId: string,
  nowMs: number = Date.now()
): Promise<ComplianceSnapshot | null> {
  const shift = await getActiveShift(userId);
  if (!shift) return null;

  const workTimeRule = getRule(shift.workTimeRule);
  const continuousWorkSeconds = computeContinuousWorkSeconds(
    shift,
    nowMs
  );
  const continuousWorkLimitSeconds =
    getContinuousWorkLimitSeconds(workTimeRule);
  const currentBreakSeconds = computeCurrentBreakSeconds(
    shift,
    nowMs
  );
  const cumulativeWorkDaySeconds =
    await getCumulativeWorkDaySeconds(userId, nowMs);
  const cumulativeWorkPeriodSeconds =
    await getCumulativeWorkPeriodSeconds(userId, nowMs);

  return {
    workTimeRule,
    continuousWorkSeconds,
    continuousWorkLimitSeconds,
    continuousWorkRemainingSeconds: Math.max(
      0,
      continuousWorkLimitSeconds - continuousWorkSeconds
    ),
    continuousWorkExceeded:
      continuousWorkSeconds > continuousWorkLimitSeconds,
    qualifyingBreakInProgress:
      isCurrentlyOnBreak(shift) &&
      currentBreakSeconds >=
        WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS,
    currentBreakSeconds,
    cumulativeWorkDaySeconds,
    cumulativeWorkDayRemainingSeconds: Math.max(
      0,
      WORK_TIME_LIMITS.CUMULATIVE_WORK_DAY_SECONDS -
        cumulativeWorkDaySeconds
    ),
    cumulativeWorkDayExceeded:
      cumulativeWorkDaySeconds >
      WORK_TIME_LIMITS.CUMULATIVE_WORK_DAY_SECONDS,
    cumulativeWorkPeriodSeconds,
    cumulativeWorkPeriodRemainingSeconds: Math.max(
      0,
      WORK_TIME_LIMITS.CUMULATIVE_WORK_PERIOD_SECONDS -
        cumulativeWorkPeriodSeconds
    ),
    cumulativeWorkPeriodExceeded:
      cumulativeWorkPeriodSeconds >
      WORK_TIME_LIMITS.CUMULATIVE_WORK_PERIOD_SECONDS,
  };
}

// ─── Migration ────────────────────────────────────────────────────────────────

export async function migrateLogCalculations(
  userId: string
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(`${LOGS_KEY}_${userId}`);
    if (!raw) return;

    const logs = JSON.parse(raw) as DailyLog[];
    let changed = false;

    const migrated = logs.map((log) => {
      const endMs = toMs(log.endTime);

      if (
        endMs === null ||
        !Array.isArray(log.events) ||
        log.events.length === 0
      ) {
        return log;
      }

      const totals = calculateActivityTotals(
        log.startTime,
        log.events,
        endMs
      );

      const next: DailyLog = {
        ...log,
        workTimeRule: getRule(log.workTimeRule),
        totalDrivingSeconds: totals.drivingSeconds,
        totalWorkSeconds: totals.workSeconds,
        totalOtherWorkSeconds: totals.otherWorkSeconds,
        breaks: totals.breaks,
        otherWorkPeriods: totals.otherWorkPeriods,
      };

      if (JSON.stringify(next) !== JSON.stringify(log)) {
        changed = true;
      }

      return next;
    });

    if (changed) {
      await AsyncStorage.setItem(
        `${LOGS_KEY}_${userId}`,
        JSON.stringify(migrated)
      );
    }
  } catch {
    // Keep migration non-fatal.
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  return [
    hours,
    minutes,
    remainingSeconds,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

export function formatHoursMinutes(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

export function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-NZ", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function csvCell(value: string | number | undefined): string {
  const text = value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function logsToCSV(
  logs: DailyLog[],
  driverName: string,
  licenceNumber: string
): string {
  const header = [
    "Date",
    "Driver Name",
    "Licence Number",
    "Work Time Rule",
    "Shift Start",
    "Shift End",
    "Total Work",
    "Total Driving",
    "Other Work",
    "Breaks Count",
    "Total Break Time",
    "Start Odometer",
    "End Odometer",
    "Distance Km",
    "Odometer Amendment Required",
  ].map(csvCell).join(",");

  const rows = logs.map((log) => {
    const totalBreakSeconds = log.breaks.reduce(
      (sum, entry) => sum + Math.max(0, entry.durationSeconds),
      0
    );

    return [
      log.date,
      driverName,
      licenceNumber,
      getRule(log.workTimeRule),
      formatTime(log.startTime),
      formatTime(log.endTime),
      formatHoursMinutes(log.totalWorkSeconds),
      formatHoursMinutes(log.totalDrivingSeconds),
      formatHoursMinutes(log.totalOtherWorkSeconds ?? 0),
      log.breaks.length,
      formatHoursMinutes(totalBreakSeconds),
      log.startOdometer,
      log.endOdometer,
      log.distanceKm,
      log.odometerInverted ? "YES" : "NO",
    ].map(csvCell).join(",");
  });

  return [header, ...rows].join("\n");
}
