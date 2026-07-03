/**
 * Audit Trail / Amendment System — NZTA Spec 3.1.21
 * Any amended entry shows a visible asterisk (*) and a viewable change history
 * showing what was changed, when, and by whom.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type DailyLog, type Amendment } from "./logbook-storage";

const LOGS_KEY = (userId: string) => `gnzl_logs_${userId}`;

/**
 * Amend a field on an existing DailyLog entry.
 * Records the change in the amendments array with timestamp, old/new values, and reason.
 */
export async function amendLogEntry(
  userId: string,
  logId: string,
  field: string,
  newValue: string,
  reason: string
): Promise<DailyLog | null> {
  const key = LOGS_KEY(userId);
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;

  const logs: DailyLog[] = JSON.parse(raw);
  const logIndex = logs.findIndex((l) => l.id === logId);
  if (logIndex === -1) return null;

  const log = logs[logIndex];

  // Get old value
  let oldValue = "";
  if (field === "startOdometer") {
    oldValue = log.startOdometer?.toString() ?? "—";
  } else if (field === "endOdometer") {
    oldValue = log.endOdometer?.toString() ?? "—";
  } else if (field === "startTime") {
    oldValue = log.startTime;
  } else if (field === "endTime") {
    oldValue = log.endTime;
  } else if (field === "note") {
    // Find the last event's note
    const lastEvent = log.events[log.events.length - 1];
    oldValue = lastEvent?.note ?? "";
  }

  // Create amendment record
  const amendment: Amendment = {
    timestamp: new Date().toISOString(),
    field,
    oldValue,
    newValue,
    reason,
  };

  // Apply the change
  if (field === "startOdometer") {
    log.startOdometer = parseFloat(newValue);
    if (log.endOdometer != null) {
      log.distanceKm = log.endOdometer - log.startOdometer;
    }
  } else if (field === "endOdometer") {
    log.endOdometer = parseFloat(newValue);
    if (log.startOdometer != null) {
      log.distanceKm = log.endOdometer - log.startOdometer;
    }
  } else if (field === "note") {
    // Add note to the last event
    if (log.events.length > 0) {
      log.events[log.events.length - 1].note = newValue;
    }
  }

  // Append amendment
  if (!log.amendments) {
    log.amendments = [];
  }
  log.amendments.push(amendment);

  // Save back
  logs[logIndex] = log;
  await AsyncStorage.setItem(key, JSON.stringify(logs));

  return log;
}

/**
 * Check if a log entry has been amended (for asterisk display).
 */
export function isAmended(log: DailyLog): boolean {
  return (log.amendments?.length ?? 0) > 0;
}

/**
 * Get the amendment history for a log entry.
 */
export function getAmendments(log: DailyLog): Amendment[] {
  return log.amendments ?? [];
}
