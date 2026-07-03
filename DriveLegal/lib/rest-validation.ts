/**
 * Rest Period Validation — NZTA Work Time & Logbooks 2007
 * 
 * Rules:
 * - After ending a shift, driver must take a minimum 10-hour continuous rest
 *   before starting a new shift (daily rest requirement).
 * - After completing a Cumulative Work Period (70 hours in 14 days),
 *   driver must take a minimum 24-hour continuous rest before starting
 *   a new CWP (CWP reset requirement).
 */
import { getAllLogs, type DailyLog } from "./logbook-storage";

const TEN_HOURS_MS = 10 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const CWP_LIMIT_SECONDS = 70 * 60 * 60; // 70 hours

export type RestValidationResult = {
  canStartShift: boolean;
  reason?: string;
  restRequired?: number; // minutes of rest still needed
  restType?: "daily" | "cwp_reset";
  lastShiftEnd?: string; // ISO string of last shift end
  timeSinceLastShift?: number; // minutes since last shift ended
};

/**
 * Check if the driver has rested enough to start a new shift.
 * Returns validation result with reason if blocked.
 */
export async function validateRestPeriod(userId: string): Promise<RestValidationResult> {
  const logs = await getAllLogs(userId);
  if (logs.length === 0) {
    // No previous shifts — can always start
    return { canStartShift: true };
  }

  // Get the most recent completed shift (sorted by startTime desc)
  const lastLog = logs[0]; // Already sorted desc by getAllLogs
  if (!lastLog.endTime) {
    return { canStartShift: true };
  }

  const lastEndMs = new Date(lastLog.endTime).getTime();
  const nowMs = Date.now();
  const elapsedMs = nowMs - lastEndMs;
  const elapsedMinutes = Math.floor(elapsedMs / (60 * 1000));

  // Check CWP limit first (more restrictive)
  const cwpCheck = checkCwpReset(logs, nowMs);
  if (cwpCheck.needsReset) {
    // CWP limit reached — need 24h rest
    if (elapsedMs < TWENTY_FOUR_HOURS_MS) {
      const remainingMinutes = Math.ceil((TWENTY_FOUR_HOURS_MS - elapsedMs) / (60 * 1000));
      return {
        canStartShift: false,
        reason: `70-hour Cumulative Work Period reached. You must take a 24-hour continuous rest before starting a new work period. ${formatRestTime(remainingMinutes)} remaining.`,
        restRequired: remainingMinutes,
        restType: "cwp_reset",
        lastShiftEnd: lastLog.endTime,
        timeSinceLastShift: elapsedMinutes,
      };
    }
  }

  // Check 10-hour daily rest
  if (elapsedMs < TEN_HOURS_MS) {
    const remainingMinutes = Math.ceil((TEN_HOURS_MS - elapsedMs) / (60 * 1000));
    return {
      canStartShift: false,
      reason: `Minimum 10-hour rest period not met. You need ${formatRestTime(remainingMinutes)} more rest before starting a new shift.`,
      restRequired: remainingMinutes,
      restType: "daily",
      lastShiftEnd: lastLog.endTime,
      timeSinceLastShift: elapsedMinutes,
    };
  }

  return {
    canStartShift: true,
    lastShiftEnd: lastLog.endTime,
    timeSinceLastShift: elapsedMinutes,
  };
}

/**
 * Check if the driver has exceeded the 70-hour CWP limit.
 */
function checkCwpReset(logs: DailyLog[], nowMs: number): { needsReset: boolean; totalSeconds: number } {
  const fourteenDaysAgo = nowMs - FOURTEEN_DAYS_MS;
  const recentLogs = logs.filter(
    (l) => new Date(l.startTime).getTime() >= fourteenDaysAgo
  );

  const totalDrivingSeconds = recentLogs.reduce(
    (sum, l) => sum + l.totalDrivingSeconds,
    0
  );

  return {
    needsReset: totalDrivingSeconds >= CWP_LIMIT_SECONDS,
    totalSeconds: totalDrivingSeconds,
  };
}

/**
 * Format remaining rest time in human-readable format.
 */
function formatRestTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}min`;
  }
  return `${minutes} min`;
}
