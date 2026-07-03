/**
 * NZTA Compliance — Drive Legal
 * Evaluates driving/work hours against NZ Land Transport Rule:
 * Work Time and Logbooks 2007.
 *
 * IMPORTANT DISTINCTION (fixed in v2):
 *
 *   consecutiveDrivingSeconds — driving since the last qualifying 30-min break.
 *     Used for the dashboard countdown and break-required warning.
 *     Resets to 0 after each qualifying break.
 *
 *   totalDrivingSeconds — all driving across the full shift.
 *     Used for the End Shift summary and daily 13-hr work cap.
 *     NEVER resets mid-shift.
 *
 * Callers must pass the correct value to evaluateCompliance().
 * See logbook-storage.ts: computeConsecutiveDrivingSeconds() and
 * computeCurrentDrivingSeconds() for how to obtain each value.
 *
 * Rules summary:
 *   Goods / Large Passenger / Vehicle Recovery:
 *     - 5.5 hrs consecutive driving → mandatory 30-min break
 *   Small Passenger Service:
 *     - 7 hrs consecutive driving → mandatory 30-min break
 *   All types:
 *     - 13 hrs max work time in any 24-hour period (10-hr rest required after)
 *     - 70 hrs max driving in any 14-day (fortnightly) period
 *     - CWP warnings at 69h 45m and 69h 55m
 */

import type { DriverType } from "@/lib/local-auth";

export type ComplianceWarning = {
  id: string;
  level: "warning" | "critical";
  title: string;
  message: string;
};

export type ComplianceStatus = {
  warnings: ComplianceWarning[];
  /** True when consecutive driving >= per-type limit (break required) */
  isDrivingWarning: boolean;
  /** True when consecutive driving is within 15 min of limit */
  isDrivingWarning15Min: boolean;
  /** True when consecutive driving is within 5 min of limit */
  isDrivingWarning5Min: boolean;
  /** True when total work time >= 13 hrs */
  isWorkWarning: boolean;
  isFortnightWarning: boolean;
  isFortnightCritical: boolean;
  isCwp15MinWarning: boolean;
  isCwp5MinWarning: boolean;
};

// ─── Limits ───────────────────────────────────────────────────────────────────

/** Consecutive driving limit before a break is required — Goods/Large/Recovery */
const GOODS_DRIVING_WARNING_SECONDS = 5.5 * 3600;   // 5 h 30 m

/** Consecutive driving limit before a break is required — Small Passenger */
const PASSENGER_DRIVING_WARNING_SECONDS = 7 * 3600; // 7 h 00 m

/** Maximum work time in any 24-hour period */
const WORK_WARNING_SECONDS = 13 * 3600;             // 13 h

/** Fortnightly driving warning threshold (90% of limit) */
const FORTNIGHT_WARNING_SECONDS = 63 * 3600;        // 63 h

/** Fortnightly driving hard limit */
const FORTNIGHT_LIMIT_SECONDS = 70 * 3600;          // 70 h

/** CWP warning thresholds (NZTA Spec 3.4.3) */
const CWP_15MIN_WARNING_SECONDS = 70 * 3600 - 15 * 60; // 69 h 45 m
const CWP_5MIN_WARNING_SECONDS  = 70 * 3600 -  5 * 60; // 69 h 55 m

/** Pre-break warnings: 15 min and 5 min before consecutive driving limit */
const BREAK_DUE_15MIN_SECONDS_GOODS = GOODS_DRIVING_WARNING_SECONDS - 15 * 60;     // 5h 15m
const BREAK_DUE_5MIN_SECONDS_GOODS  = GOODS_DRIVING_WARNING_SECONDS -  5 * 60;     // 5h 25m
const BREAK_DUE_15MIN_SECONDS_PASS  = PASSENGER_DRIVING_WARNING_SECONDS - 15 * 60; // 6h 45m
const BREAK_DUE_5MIN_SECONDS_PASS   = PASSENGER_DRIVING_WARNING_SECONDS -  5 * 60; // 6h 55m

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getDrivingLimitSeconds(driverType: DriverType = "small_passenger"): number {
  return driverType === "small_passenger"
    ? PASSENGER_DRIVING_WARNING_SECONDS
    : GOODS_DRIVING_WARNING_SECONDS;
}

export function getDrivingLimitHours(driverType: DriverType = "small_passenger"): string {
  return driverType === "small_passenger" ? "7" : "5.5";
}

// ─── Core evaluation ─────────────────────────────────────────────────────────

/**
 * Evaluate NZTA compliance for the current moment.
 *
 * @param consecutiveDrivingSeconds  Driving since last qualifying break
 *   (use computeConsecutiveDrivingSeconds from logbook-storage)
 * @param workSeconds                Total work time this shift
 *   (use computeCurrentWorkSeconds)
 * @param fortnightlyDrivingSeconds  Total driving in the last 14 days
 *   (use getFortnightlyDrivingSeconds + computeCurrentDrivingSeconds)
 * @param driverType                 Driver classification
 */
export function evaluateCompliance(
  consecutiveDrivingSeconds: number,
  workSeconds: number,
  fortnightlyDrivingSeconds: number,
  driverType: DriverType = "small_passenger"
): ComplianceStatus {
  const warnings: ComplianceWarning[] = [];
  const drivingLimitSeconds = getDrivingLimitSeconds(driverType);
  const drivingLimitLabel = driverType === "small_passenger" ? "7 hours" : "5 hours 30 minutes";

  const isDrivingWarning = consecutiveDrivingSeconds >= drivingLimitSeconds;
  const isWorkWarning = workSeconds >= WORK_WARNING_SECONDS;
  const isFortnightWarning = fortnightlyDrivingSeconds >= FORTNIGHT_WARNING_SECONDS;
  const isFortnightCritical = fortnightlyDrivingSeconds >= FORTNIGHT_LIMIT_SECONDS;

  // Pre-break warnings — 15 min and 5 min before the consecutive limit (NZTA Spec 3.4.1)
  const breakDue15MinSeconds = driverType === "small_passenger"
    ? BREAK_DUE_15MIN_SECONDS_PASS
    : BREAK_DUE_15MIN_SECONDS_GOODS;
  const breakDue5MinSeconds = driverType === "small_passenger"
    ? BREAK_DUE_5MIN_SECONDS_PASS
    : BREAK_DUE_5MIN_SECONDS_GOODS;
  const isDrivingWarning15Min =
    consecutiveDrivingSeconds >= breakDue15MinSeconds &&
    consecutiveDrivingSeconds < breakDue5MinSeconds;
  const isDrivingWarning5Min =
    consecutiveDrivingSeconds >= breakDue5MinSeconds &&
    consecutiveDrivingSeconds < drivingLimitSeconds;

  if (isDrivingWarning5Min) {
    warnings.push({
      id: "driving_5min_warning",
      level: "critical",
      title: "⚠️ Break Due in 5 Minutes",
      message: `You must take a 30-minute rest break within 5 minutes. Plan to stop driving now.`,
    });
  } else if (isDrivingWarning15Min) {
    warnings.push({
      id: "driving_15min_warning",
      level: "warning",
      title: "Rest Break Due in 15 Minutes",
      message: `You are approaching the ${drivingLimitLabel} continuous driving limit. Plan your 30-minute rest break.`,
    });
  }

  if (isDrivingWarning) {
    warnings.push({
      id: "driving_limit",
      level: "critical",
      title: "Driving Break Required",
      message: `You have been driving for ${drivingLimitLabel}. Take a 30-minute break now!`,
    });
  }

  if (isWorkWarning) {
    warnings.push({
      id: "work_limit",
      level: "critical",
      title: "Maximum Work Time Reached",
      message:
        "You have worked for 13 hours. A 10-hour break is now required by NZTA regulations.",
    });
  }

  const isCwp15MinWarning =
    fortnightlyDrivingSeconds >= CWP_15MIN_WARNING_SECONDS &&
    fortnightlyDrivingSeconds < CWP_5MIN_WARNING_SECONDS;
  const isCwp5MinWarning =
    fortnightlyDrivingSeconds >= CWP_5MIN_WARNING_SECONDS &&
    fortnightlyDrivingSeconds < FORTNIGHT_LIMIT_SECONDS;

  if (isFortnightCritical) {
    warnings.push({
      id: "fortnight_critical",
      level: "critical",
      title: "Fortnightly Limit Exceeded",
      message:
        "You have reached the 70-hour fortnightly driving limit. You must not drive until the limit resets.",
    });
  } else if (isCwp5MinWarning) {
    warnings.push({
      id: "cwp_5min_warning",
      level: "critical",
      title: "⚠️ CWP Limit in 5 Minutes",
      message:
        "You are 5 minutes away from reaching the 70-hour Cumulative Work Period limit. Stop driving immediately and take a 24-hour rest break.",
    });
  } else if (isCwp15MinWarning) {
    warnings.push({
      id: "cwp_15min_warning",
      level: "warning",
      title: "CWP Limit in 15 Minutes",
      message:
        "You are 15 minutes away from reaching the 70-hour Cumulative Work Period limit. Plan to stop driving and take a 24-hour rest break.",
    });
  } else if (isFortnightWarning) {
    warnings.push({
      id: "fortnight_warning",
      level: "warning",
      title: "Approaching Fortnightly Limit",
      message: `You have driven ${Math.floor(fortnightlyDrivingSeconds / 3600)} hours this fortnight. The limit is 70 hours.`,
    });
  }

  return {
    warnings,
    isDrivingWarning,
    isDrivingWarning15Min,
    isDrivingWarning5Min,
    isWorkWarning,
    isFortnightWarning,
    isFortnightCritical,
    isCwp15MinWarning,
    isCwp5MinWarning,
  };
}

// ─── Progress helpers (for UI progress bars) ─────────────────────────────────

/** Progress toward the consecutive driving limit (0–100). */
export function getDrivingProgressPercent(
  consecutiveDrivingSeconds: number,
  driverType: DriverType = "small_passenger"
): number {
  const limit = getDrivingLimitSeconds(driverType);
  return Math.min(100, (consecutiveDrivingSeconds / limit) * 100);
}

export function getWorkProgressPercent(workSeconds: number): number {
  return Math.min(100, (workSeconds / WORK_WARNING_SECONDS) * 100);
}

export function getFortnightProgressPercent(fortnightlySeconds: number): number {
  return Math.min(100, (fortnightlySeconds / FORTNIGHT_LIMIT_SECONDS) * 100);
}

// ─── Exported constants ───────────────────────────────────────────────────────

export const LIMITS = {
  GOODS_DRIVING_WARNING_SECONDS,
  PASSENGER_DRIVING_WARNING_SECONDS,
  WORK_WARNING_SECONDS,
  FORTNIGHT_WARNING_SECONDS,
  FORTNIGHT_LIMIT_SECONDS,
  CWP_15MIN_WARNING_SECONDS,
  CWP_5MIN_WARNING_SECONDS,
};
