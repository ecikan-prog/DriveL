/**
 * NZTA compliance calculations for Drive Legal.
 *
 * Important terminology:
 * - Continuous work includes driving and other work.
 * - A qualifying 30-minute break resets continuous work.
 * - The applicable continuous-work limit comes from WorkTimeRule:
 *   - standard_5_5_hour
 *   - sps_short_fares_7_hour
 * - The cumulative work-period limit is 70 hours of work, not driving only.
 */

import type { WorkTimeRule } from "@/lib/logbook-storage";

export type ComplianceWarning = {
  id: string;
  level: "warning" | "critical";
  title: string;
  message: string;
};

export type ComplianceStatus = {
  warnings: ComplianceWarning[];

  /** Continuous-work limit has been reached. */
  isDrivingWarning: boolean;

  /** Continuous-work limit is between 15 and 5 minutes away. */
  isDrivingWarning15Min: boolean;

  /** Continuous-work limit is less than 5 minutes away. */
  isDrivingWarning5Min: boolean;

  /** The 13-hour cumulative work-day limit has been reached. */
  isWorkWarning: boolean;

  /** The 70-hour cumulative work-period warning threshold has been reached. */
  isFortnightWarning: boolean;

  /** The 70-hour cumulative work-period limit has been reached. */
  isFortnightCritical: boolean;

  /** The 70-hour limit is between 15 and 5 minutes away. */
  isCwp15MinWarning: boolean;

  /** The 70-hour limit is less than 5 minutes away. */
  isCwp5MinWarning: boolean;
};

// ─── Limits ───────────────────────────────────────────────────────────────────

const STANDARD_CONTINUOUS_WORK_SECONDS = 5.5 * 60 * 60;
const SPS_SHORT_FARES_CONTINUOUS_WORK_SECONDS = 7 * 60 * 60;

const CUMULATIVE_WORK_DAY_LIMIT_SECONDS = 13 * 60 * 60;
const CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS = 70 * 60 * 60;

const CUMULATIVE_WORK_PERIOD_WARNING_SECONDS = 63 * 60 * 60;

const CWP_15MIN_WARNING_SECONDS =
  CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS - 15 * 60;

const CWP_5MIN_WARNING_SECONDS =
  CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS - 5 * 60;

// ─── Rule helpers ─────────────────────────────────────────────────────────────

function isSevenHourRule(workTimeRule: WorkTimeRule): boolean {
  return workTimeRule === "sps_short_fares_7_hour";
}

export function getDrivingLimitSeconds(
  workTimeRule: WorkTimeRule = "standard_5_5_hour"
): number {
  return isSevenHourRule(workTimeRule)
    ? SPS_SHORT_FARES_CONTINUOUS_WORK_SECONDS
    : STANDARD_CONTINUOUS_WORK_SECONDS;
}

export function getDrivingLimitHours(
  workTimeRule: WorkTimeRule = "standard_5_5_hour"
): string {
  return isSevenHourRule(workTimeRule) ? "7" : "5.5";
}

function getContinuousWorkLimitLabel(
  workTimeRule: WorkTimeRule
): string {
  return isSevenHourRule(workTimeRule)
    ? "7 hours"
    : "5 hours 30 minutes";
}

// ─── Core compliance evaluation ───────────────────────────────────────────────

/**
 * Evaluate the driver's current NZTA work-time status.
 *
 * @param continuousWorkSeconds
 * Work since the last qualifying 30-minute break, including driving and
 * other work.
 *
 * @param cumulativeWorkDaySeconds
 * Total work in the current cumulative work day, including completed work
 * and the active shift.
 *
 * @param cumulativeWorkPeriodSeconds
 * Total work in the current cumulative work period, including completed
 * work and the active shift.
 *
 * @param workTimeRule
 * The rule captured when the active shift started.
 */
export function evaluateCompliance(
  continuousWorkSeconds: number,
  cumulativeWorkDaySeconds: number,
  cumulativeWorkPeriodSeconds: number,
  workTimeRule: WorkTimeRule = "standard_5_5_hour"
): ComplianceStatus {
  const warnings: ComplianceWarning[] = [];

  const continuousWorkLimitSeconds =
    getDrivingLimitSeconds(workTimeRule);

  const continuousWorkLimitLabel =
    getContinuousWorkLimitLabel(workTimeRule);

  const breakDue15MinSeconds =
    continuousWorkLimitSeconds - 15 * 60;

  const breakDue5MinSeconds =
    continuousWorkLimitSeconds - 5 * 60;

  const isDrivingWarning =
    continuousWorkSeconds >= continuousWorkLimitSeconds;

  const isDrivingWarning15Min =
    continuousWorkSeconds >= breakDue15MinSeconds &&
    continuousWorkSeconds < breakDue5MinSeconds;

  const isDrivingWarning5Min =
    continuousWorkSeconds >= breakDue5MinSeconds &&
    continuousWorkSeconds < continuousWorkLimitSeconds;

  const isWorkWarning =
    cumulativeWorkDaySeconds >=
    CUMULATIVE_WORK_DAY_LIMIT_SECONDS;

  const isFortnightWarning =
    cumulativeWorkPeriodSeconds >=
    CUMULATIVE_WORK_PERIOD_WARNING_SECONDS;

  const isFortnightCritical =
    cumulativeWorkPeriodSeconds >=
    CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS;

  const isCwp15MinWarning =
    cumulativeWorkPeriodSeconds >= CWP_15MIN_WARNING_SECONDS &&
    cumulativeWorkPeriodSeconds < CWP_5MIN_WARNING_SECONDS;

  const isCwp5MinWarning =
    cumulativeWorkPeriodSeconds >= CWP_5MIN_WARNING_SECONDS &&
    cumulativeWorkPeriodSeconds <
      CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS;

  // Continuous-work warnings
  if (isDrivingWarning) {
    warnings.push({
      id: "continuous_work_limit",
      level: "critical",
      title: "Rest Break Required",
      message:
        `You have reached the ${continuousWorkLimitLabel} ` +
        "continuous-work limit. Take a qualifying 30-minute rest break now.",
    });
  } else if (isDrivingWarning5Min) {
    warnings.push({
      id: "continuous_work_5min_warning",
      level: "critical",
      title: "Rest Break Due in 5 Minutes",
      message:
        "You are within 5 minutes of your continuous-work limit. " +
        "Stop work and begin a qualifying 30-minute rest break.",
    });
  } else if (isDrivingWarning15Min) {
    warnings.push({
      id: "continuous_work_15min_warning",
      level: "warning",
      title: "Rest Break Due in 15 Minutes",
      message:
        `You are approaching the ${continuousWorkLimitLabel} ` +
        "continuous-work limit. Plan your qualifying 30-minute rest break.",
    });
  }

  // Cumulative work-day warning
  if (isWorkWarning) {
    warnings.push({
      id: "cumulative_work_day_limit",
      level: "critical",
      title: "Maximum Work Time Reached",
      message:
        "You have reached the 13-hour cumulative work-day limit. " +
        "A continuous 10-hour rest period is required.",
    });
  }

  // Cumulative work-period warnings
  if (isFortnightCritical) {
    warnings.push({
      id: "cumulative_work_period_limit",
      level: "critical",
      title: "70-Hour Work Limit Reached",
      message:
        "You have reached the 70-hour cumulative work-period limit. " +
        "A continuous 24-hour rest period is required before the period resets.",
    });
  } else if (isCwp5MinWarning) {
    warnings.push({
      id: "cwp_5min_warning",
      level: "critical",
      title: "70-Hour Limit in 5 Minutes",
      message:
        "You are within 5 minutes of the 70-hour cumulative work-period limit. " +
        "Stop work and begin the required continuous 24-hour rest period.",
    });
  } else if (isCwp15MinWarning) {
    warnings.push({
      id: "cwp_15min_warning",
      level: "warning",
      title: "70-Hour Limit in 15 Minutes",
      message:
        "You are within 15 minutes of the 70-hour cumulative work-period limit. " +
        "Plan to stop work and begin the required continuous 24-hour rest period.",
    });
  } else if (isFortnightWarning) {
    warnings.push({
      id: "cumulative_work_period_warning",
      level: "warning",
      title: "Approaching 70-Hour Work Limit",
      message:
        `You have recorded ${Math.floor(
          cumulativeWorkPeriodSeconds / 3600
        )} hours in the current cumulative work period. ` +
        "The limit is 70 hours.",
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

// ─── UI progress helpers ──────────────────────────────────────────────────────

export function getDrivingProgressPercent(
  continuousWorkSeconds: number,
  workTimeRule: WorkTimeRule = "standard_5_5_hour"
): number {
  const limit = getDrivingLimitSeconds(workTimeRule);

  return Math.min(
    100,
    Math.max(0, (continuousWorkSeconds / limit) * 100)
  );
}

export function getWorkProgressPercent(
  cumulativeWorkDaySeconds: number
): number {
  return Math.min(
    100,
    Math.max(
      0,
      (cumulativeWorkDaySeconds /
        CUMULATIVE_WORK_DAY_LIMIT_SECONDS) *
        100
    )
  );
}

export function getFortnightProgressPercent(
  cumulativeWorkPeriodSeconds: number
): number {
  return Math.min(
    100,
    Math.max(
      0,
      (cumulativeWorkPeriodSeconds /
        CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS) *
        100
    )
  );
}

// ─── Backward-compatible exported constants ───────────────────────────────────

export const LIMITS = {
  GOODS_DRIVING_WARNING_SECONDS:
    STANDARD_CONTINUOUS_WORK_SECONDS,

  PASSENGER_DRIVING_WARNING_SECONDS:
    SPS_SHORT_FARES_CONTINUOUS_WORK_SECONDS,

  WORK_WARNING_SECONDS:
    CUMULATIVE_WORK_DAY_LIMIT_SECONDS,

  FORTNIGHT_WARNING_SECONDS:
    CUMULATIVE_WORK_PERIOD_WARNING_SECONDS,

  FORTNIGHT_LIMIT_SECONDS:
    CUMULATIVE_WORK_PERIOD_LIMIT_SECONDS,

  CWP_15MIN_WARNING_SECONDS,
  CWP_5MIN_WARNING_SECONDS,
};
