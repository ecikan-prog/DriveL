/**
 * Activity Grid — NZTA Compliance Feature (Specs 3.2.10 & 5.1.2)
 *
 * Visual timeline showing work/driving/rest/non-driving blocks across the
 * entire Cumulative Work Period (CWP). Each row represents one day, with
 * colored blocks indicating activity type across 24 hours.
 *
 * Activity Types:
 * - Driving (dark blue): Active driving time
 * - Other Work (light blue): Non-driving work activities
 * - Rest Break (green): Short rest breaks during shift
 * - Off Duty (grey): Time between shifts / not working
 */
import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal } from "react-native";
import { type DailyLog, type ShiftEvent } from "@/lib/logbook-storage";

// ─── Types ──────────────────────────────────────────────────────────────────

type ActivityType = "driving" | "other_work" | "rest_break" | "off_duty";

type ActivityBlock = {
  type: ActivityType;
  startMinute: number; // minutes from midnight (0–1440)
  endMinute: number;
  location?: string;
};

type DayRow = {
  date: string; // YYYY-MM-DD
  dateLabel: string; // e.g., "Mon 16 Jun"
  blocks: ActivityBlock[];
};

// ─── Colors ─────────────────────────────────────────────────────────────────

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  driving: "#003366", // Dark navy blue
  other_work: "#5980E9", // Action blue
  rest_break: "#22C55E", // Green
  off_duty: "#E2E8F0", // Light grey
};

const ACTIVITY_LABELS: Record<ActivityType, string> = {
  driving: "Driving",
  other_work: "Other Work",
  rest_break: "Rest Break",
  off_duty: "Off Duty",
};

// ─── Utility Functions ──────────────────────────────────────────────────────

function getMinuteOfDay(isoString: string): number {
  const d = new Date(isoString);
  return d.getHours() * 60 + d.getMinutes();
}

function getDateKey(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-NZ", {
    timeZone: "Pacific/Auckland",
  }).split("/").reverse().join("-");
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function formatMinutesDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}min`;
}

/**
 * Convert a DailyLog's events into ActivityBlocks for a single day.
 * Events are mapped to minute-of-day positions (0–1440).
 */
function logToBlocks(log: DailyLog): ActivityBlock[] {
  const blocks: ActivityBlock[] = [];
  const events = log.events;

  if (events.length === 0) return blocks;

  // Walk through events and create blocks
  for (let i = 0; i < events.length - 1; i++) {
    const current = events[i];
    const next = events[i + 1];

    const startMin = getMinuteOfDay(current.timestamp);
    const endMin = getMinuteOfDay(next.timestamp);

    // Determine activity type based on current event
    let type: ActivityType = "driving";
    if (current.type === "shift_start" || current.type === "break_end" || current.type === "other_work_end") {
      type = "driving"; // Active driving after shift start, break end, or other work end
    } else if (current.type === "break_start") {
      type = "rest_break"; // On break
    } else if (current.type === "other_work_start") {
      type = "other_work"; // Non-driving work
    }

    // Handle overnight shifts (endMin < startMin means crosses midnight)
    if (endMin > startMin) {
      blocks.push({ type, startMinute: startMin, endMinute: endMin });
    } else if (endMin < startMin) {
      // Crosses midnight — clip to end of day
      blocks.push({ type, startMinute: startMin, endMinute: 1440 });
    }
  }

  return blocks;
}

/**
 * Build day rows from logs for the entire CWP.
 * Fills in off-duty time for days without shifts and gaps within days.
 */
function buildDayRows(logs: DailyLog[]): DayRow[] {
  if (logs.length === 0) return [];

  // Sort logs oldest first
  const sorted = [...logs].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  // Determine date range
  const firstDate = new Date(sorted[0].startTime);
  const lastDate = new Date(sorted[sorted.length - 1].endTime);

  // Generate all dates in range
  const dayRows: DayRow[] = [];
  const currentDate = new Date(firstDate);
  currentDate.setHours(0, 0, 0, 0);
  const endDate = new Date(lastDate);
  endDate.setHours(23, 59, 59, 999);

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dateLabel = formatDateLabel(dateStr);

    // Find logs that overlap this day
    const dayLogs = sorted.filter((log) => {
      const logDate = log.startTime.split("T")[0];
      return logDate === dateStr;
    });

    let blocks: ActivityBlock[] = [];

    if (dayLogs.length > 0) {
      // Build blocks from each log
      for (const log of dayLogs) {
        const logBlocks = logToBlocks(log);
        blocks.push(...logBlocks);
      }

      // Fill gaps with off-duty
      blocks.sort((a, b) => a.startMinute - b.startMinute);
      const filledBlocks: ActivityBlock[] = [];
      let lastEnd = 0;

      for (const block of blocks) {
        if (block.startMinute > lastEnd) {
          filledBlocks.push({
            type: "off_duty",
            startMinute: lastEnd,
            endMinute: block.startMinute,
          });
        }
        filledBlocks.push(block);
        lastEnd = Math.max(lastEnd, block.endMinute);
      }

      // Fill remaining time as off-duty
      if (lastEnd < 1440) {
        filledBlocks.push({
          type: "off_duty",
          startMinute: lastEnd,
          endMinute: 1440,
        });
      }

      blocks = filledBlocks;
    } else {
      // Entire day is off-duty
      blocks = [{ type: "off_duty", startMinute: 0, endMinute: 1440 }];
    }

    dayRows.push({ date: dateStr, dateLabel, blocks });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dayRows;
}

// ─── Component ──────────────────────────────────────────────────────────────

type ActivityGridProps = {
  logs: DailyLog[];
  compact?: boolean; // Compact mode for enforcement view
};

export function ActivityGrid({ logs, compact = false }: ActivityGridProps) {
  const dayRows = buildDayRows(logs);
  const [tooltip, setTooltip] = useState<{ block: ActivityBlock; date: string } | null>(null);

  if (dayRows.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="text-sm text-[#6B7A99]">No activity data available</Text>
      </View>
    );
  }

  const barHeight = compact ? 20 : 28;
  const labelWidth = compact ? 70 : 80;

  return (
    <View>
      {/* Legend */}
      <View className="flex-row flex-wrap gap-3 mb-3 px-1">
        {(Object.keys(ACTIVITY_COLORS) as ActivityType[]).map((type) => (
          <View key={type} className="flex-row items-center gap-1.5">
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                backgroundColor: ACTIVITY_COLORS[type],
              }}
            />
            <Text className="text-xs text-[#4A5568]">{ACTIVITY_LABELS[type]}</Text>
          </View>
        ))}
      </View>

      {/* Time axis header */}
      <View className="flex-row mb-1" style={{ paddingLeft: labelWidth }}>
        <Text className="text-[10px] text-[#9CA3AF] flex-1 text-left">00:00</Text>
        <Text className="text-[10px] text-[#9CA3AF] flex-1 text-center">06:00</Text>
        <Text className="text-[10px] text-[#9CA3AF] flex-1 text-center">12:00</Text>
        <Text className="text-[10px] text-[#9CA3AF] flex-1 text-center">18:00</Text>
        <Text className="text-[10px] text-[#9CA3AF] text-right">24:00</Text>
      </View>

      {/* Grid rows */}
      <ScrollView
        style={{ maxHeight: compact ? 200 : 350 }}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled={true}
      >
        {dayRows.map((row) => (
          <View key={row.date} className="flex-row items-center mb-1">
            {/* Date label */}
            <View style={{ width: labelWidth }}>
              <Text
                className="text-[10px] text-[#4A5568] font-medium"
                numberOfLines={1}
              >
                {row.dateLabel}
              </Text>
            </View>

            {/* Timeline bar */}
            <View
              className="flex-1 flex-row rounded overflow-hidden"
              style={{ height: barHeight }}
            >
              {row.blocks.map((block, idx) => {
                const widthPercent =
                  ((block.endMinute - block.startMinute) / 1440) * 100;
                if (widthPercent <= 0) return null;

                return (
                  <TouchableOpacity
                    key={`${row.date}-${idx}`}
                    style={{
                      width: `${widthPercent}%`,
                      height: "100%",
                      backgroundColor: ACTIVITY_COLORS[block.type],
                    }}
                    activeOpacity={0.7}
                    onPress={() => setTooltip({ block, date: row.date })}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Summary stats */}
      {!compact && dayRows.length > 0 && (
        <View className="flex-row justify-between mt-3 px-1">
          <Text className="text-[10px] text-[#6B7A99]">
            CWP: {dayRows.length} day{dayRows.length !== 1 ? "s" : ""}
          </Text>
          <Text className="text-[10px] text-[#6B7A99]">
            {logs.length} shift{logs.length !== 1 ? "s" : ""} recorded
          </Text>
        </View>
      )}

      {/* Tap-to-inspect Tooltip Modal */}
      {tooltip && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setTooltip(null)}>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}
            activeOpacity={1}
            onPress={() => setTooltip(null)}
          >
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 20, width: "100%", maxWidth: 300, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: ACTIVITY_COLORS[tooltip.block.type], marginRight: 8 }} />
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#003366" }}>{ACTIVITY_LABELS[tooltip.block.type]}</Text>
              </View>
              <View style={{ backgroundColor: "#F0F4FF", borderRadius: 10, padding: 12, gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#6B7A99" }}>Date</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366" }}>{tooltip.date}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#6B7A99" }}>Start</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366" }}>{minutesToTime(tooltip.block.startMinute)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#6B7A99" }}>End</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366" }}>{minutesToTime(tooltip.block.endMinute)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#6B7A99" }}>Duration</Text>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366" }}>{formatMinutesDuration(tooltip.block.endMinute - tooltip.block.startMinute)}</Text>
                </View>
                {tooltip.block.location && (
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 11, color: "#6B7A99" }}>Location</Text>
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366" }}>{tooltip.block.location}</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={{ marginTop: 12, alignItems: "center", paddingVertical: 10, backgroundColor: "#003366", borderRadius: 10 }}
                onPress={() => setTooltip(null)}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 13 }}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </View>
  );
}
