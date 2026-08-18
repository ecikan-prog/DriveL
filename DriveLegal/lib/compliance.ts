/**
 * Shared NZTA shift-compliance evaluation for completed DailyLogs.
 *
 * Single source of truth for whether a completed shift complied with:
 *  - the continuous driving/work limit (resets after a qualifying 30-minute
 *    break), using the existing per-driver-type limits from
 *    hooks/use-nzta-compliance.ts (7h small passenger, 5.5h goods/large/
 *    recovery)
 *  - the 13-hour daily work-time limit
 *
 * Continuous work is derived by walking the log's own event timeline
 * (log.events), NOT by comparing total daily driving against the
 * continuous-work limit — a long day that included a valid qualifying
 * break must not be flagged just because total driving for the day
 * exceeded the continuous limit.
 *
 * This is the only place this evaluation is implemented. Both the
 * History screen's LogCard and its summary compliant count must call
 * this function so they can never disagree.
 */
import { getDrivingLimitSeconds } from "@/hooks/use-nzta-compliance";
import { WORK_TIME_LIMITS, type DailyLog, type WorkTimeRule } from "@/lib/logbook-storage";
import type { DriverType } from "@/lib/local-auth";

export type ComplianceEvaluation = {
  isCompliant: boolean;
  continuousWorkExceeded: boolean;
  dailyWorkExceeded: boolean;
  maxContinuousWorkSeconds: number;
  continuousWorkLimitSeconds: number;
  totalWorkSeconds: number;
  dailyWorkLimitSeconds: number;
};

function toMs(value?: string | null): number | null {
  if (!value) return null;

  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function sortByTimestamp<T extends { timestamp: string }>(
  events: T[]
): T[] {
  return [...events].sort((a, b) => {
    const aMs = toMs(a.timestamp) ?? Number.MAX_SAFE_INTEGER;
    const bMs = toMs(b.timestamp) ?? Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });
}

/**
 * The longest continuous driving/work stretch reached at any point in the
 * shift, resetting to 0 whenever a break of at least 30 minutes occurs.
 * Falls back to totalWorkSeconds for older logs recorded before the event
 * timeline existed (log.events missing or empty), so legacy logs don't
 * crash or silently pass.
 */
function getMaxContinuousWorkSeconds(log: DailyLog): number {
  const startMs = toMs(log.startTime);
  const endMs = toMs(log.endTime);
  const events = Array.isArray(log.events) ? log.events : [];

  if (
    startMs === null ||
    endMs === null ||
    endMs < startMs ||
    events.length === 0
  ) {
    return Math.max(0, log.totalWorkSeconds ?? 0);
  }

  let accumulatedWorkMs = 0;
  let maxWorkMs = 0;
  let workSegmentStartMs = startMs;
  let onBreak = false;
  let breakStartMs: number | null = null;

  for (const event of sortByTimestamp(events)) {
    const eventMs = toMs(event.timestamp);

    if (
      eventMs === null ||
      eventMs < startMs ||
      eventMs > endMs ||
      event.type === "shift_start"
    ) {
      continue;
    }

    if (event.type === "break_start" && !onBreak) {
      accumulatedWorkMs += Math.max(0, eventMs - workSegmentStartMs);
      maxWorkMs = Math.max(maxWorkMs, accumulatedWorkMs);
      onBreak = true;
      breakStartMs = eventMs;
    } else if (event.type === "break_end" && onBreak) {
      const breakDurationMs = Math.max(
        0,
        eventMs - (breakStartMs ?? eventMs)
      );

      if (
        breakDurationMs >=
        WORK_TIME_LIMITS.QUALIFYING_BREAK_SECONDS * 1000
      ) {
        // Qualifying 30-minute break: continuous work resets to zero.
        accumulatedWorkMs = 0;
      }

      onBreak = false;
      breakStartMs = null;
      workSegmentStartMs = eventMs;
    } else if (event.type === "shift_end") {
      break;
    }
    // other_work_start/end intentionally does not pause or reset the
    // continuous-work counter — only a qualifying break does.
  }

  if (!onBreak) {
    accumulatedWorkMs += Math.max(0, endMs - workSegmentStartMs);
  }

  maxWorkMs = Math.max(maxWorkMs, accumulatedWorkMs);
  return Math.floor(maxWorkMs / 1000);
}

/**
 * Evaluate a completed shift against the NZTA continuous-work and
 * daily work-time rules, using the same per-driver-type continuous
 * limits as the rest of the app (hooks/use-nzta-compliance.ts).
 *
 * The daily work-time limit is fixed at exactly 13 hours with no
 * warning-threshold shortcut — a shift is only flagged once it has
 * actually exceeded 13 hours of total work.
 */
export function evaluateLogCompliance(
  log: DailyLog,
  driverType: DriverType = "small_passenger"
): ComplianceEvaluation {
  // getDrivingLimitSeconds expects a WorkTimeRule, not a DriverType string.
  // Prefer log.workTimeRule (authoritative — set at shift start), then derive
  // from driverType as fallback so SPS always gets the 7-hour threshold.
  const workTimeRule: WorkTimeRule =
    log.workTimeRule ??
    (driverType === "small_passenger"
      ? "sps_short_fares_7_hour"
      : "standard_5_5_hour");
  const continuousWorkLimitSeconds = getDrivingLimitSeconds(workTimeRule);
  const maxContinuousWorkSeconds = getMaxContinuousWorkSeconds(log);
  const continuousWorkExceeded =
    maxContinuousWorkSeconds > continuousWorkLimitSeconds;

  const totalWorkSeconds = Math.max(0, log.totalWorkSeconds ?? 0);
  const dailyWorkLimitSeconds = 13 * 60 * 60;
  const dailyWorkExceeded = totalWorkSeconds > dailyWorkLimitSeconds;

  return {
    isCompliant: !continuousWorkExceeded && !dailyWorkExceeded,
    continuousWorkExceeded,
    dailyWorkExceeded,
    maxContinuousWorkSeconds,
    continuousWorkLimitSeconds,
    totalWorkSeconds,
    dailyWorkLimitSeconds,
  };
}
