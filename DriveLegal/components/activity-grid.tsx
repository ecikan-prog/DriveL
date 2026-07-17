import React, { useMemo } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { DailyLog } from "@/lib/logbook-storage";

type ActivityGridProps = {
  logs: DailyLog[];
  compact?: boolean;
};

type DayActivity = {
  key: string;
  label: string;
  drivingSeconds: number;
  workSeconds: number;
  breakSeconds: number;
  shifts: number;
};

const DAY_SECONDS = 24 * 60 * 60;
const MAX_WORK_SECONDS = 13 * 60 * 60;

function getDateKey(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function formatDayLabel(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }

  return date.toLocaleDateString("en-NZ", {
    weekday: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number): string {
  const safeSeconds = Math.max(0, seconds || 0);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);

  if (hours === 0) {
    return `${minutes}m`;
  }

  if (minutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

export function ActivityGrid({
  logs,
  compact = false,
}: ActivityGridProps) {
  const activities = useMemo<DayActivity[]>(() => {
    const grouped = new Map<string, DayActivity>();

    for (const log of logs ?? []) {
      if (!log?.startTime) continue;

      const key = getDateKey(log.startTime);

      const existing = grouped.get(key) ?? {
        key,
        label: formatDayLabel(key),
        drivingSeconds: 0,
        workSeconds: 0,
        breakSeconds: 0,
        shifts: 0,
      };

      const breakSeconds = (log.breaks ?? []).reduce(
        (sum, breakEntry) =>
          sum + Math.max(0, breakEntry?.durationSeconds ?? 0),
        0
      );

      existing.drivingSeconds += Math.max(
        0,
        log.totalDrivingSeconds ?? 0
      );

      existing.workSeconds += Math.max(
        0,
        log.totalWorkSeconds ?? 0
      );

      existing.breakSeconds += breakSeconds;
      existing.shifts += 1;

      grouped.set(key, existing);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
  }, [logs]);

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No activity recorded</Text>
        <Text style={styles.emptyText}>
          Completed shifts will appear here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {activities.map((day) => {
        const drivingPercent = Math.min(
          100,
          (day.drivingSeconds / MAX_WORK_SECONDS) * 100
        );

        const workPercent = Math.min(
          100,
          (day.workSeconds / MAX_WORK_SECONDS) * 100
        );

        const breakPercent = Math.min(
          100,
          (day.breakSeconds / DAY_SECONDS) * 100
        );

        return (
          <View
            key={day.key}
            style={[
              styles.dayCard,
              compact && styles.dayCardCompact,
            ]}
          >
            <Text style={styles.dayLabel}>{day.label}</Text>

            <View
              style={[
                styles.chartArea,
                compact && styles.chartAreaCompact,
              ]}
            >
              <View style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.drivingBar,
                      {
                        height: `${Math.max(
                          drivingPercent,
                          day.drivingSeconds > 0 ? 4 : 0
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>Drive</Text>
              </View>

              <View style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.workBar,
                      {
                        height: `${Math.max(
                          workPercent,
                          day.workSeconds > 0 ? 4 : 0
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>Work</Text>
              </View>

              <View style={styles.barColumn}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.breakBar,
                      {
                        height: `${Math.max(
                          breakPercent,
                          day.breakSeconds > 0 ? 4 : 0
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>Break</Text>
              </View>
            </View>

            <Text style={styles.durationText}>
              {formatDuration(day.drivingSeconds)}
            </Text>

            {!compact && (
              <>
                <Text style={styles.detailText}>
                  Work: {formatDuration(day.workSeconds)}
                </Text>

                <Text style={styles.detailText}>
                  Breaks: {formatDuration(day.breakSeconds)}
                </Text>

                <Text style={styles.shiftText}>
                  {day.shifts} {day.shifts === 1 ? "shift" : "shifts"}
                </Text>
              </>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

export default ActivityGrid;

const styles = StyleSheet.create({
  scrollContent: {
    paddingVertical: 4,
    paddingRight: 8,
  },

  dayCard: {
    width: 126,
    minHeight: 220,
    marginRight: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFF",
  },

  dayCardCompact: {
    width: 104,
    minHeight: 166,
    padding: 10,
  },

  dayLabel: {
    marginBottom: 8,
    color: "#003366",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },

  chartArea: {
    height: 104,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    marginBottom: 8,
  },

  chartAreaCompact: {
    height: 76,
  },

  barColumn: {
    alignItems: "center",
  },

  barTrack: {
    width: 18,
    height: "85%",
    overflow: "hidden",
    justifyContent: "flex-end",
    borderRadius: 5,
    backgroundColor: "#E8EEF8",
  },

  drivingBar: {
    width: "100%",
    borderRadius: 5,
    backgroundColor: "#2563EB",
  },

  workBar: {
    width: "100%",
    borderRadius: 5,
    backgroundColor: "#003366",
  },

  breakBar: {
    width: "100%",
    borderRadius: 5,
    backgroundColor: "#F59E0B",
  },

  barLabel: {
    marginTop: 4,
    color: "#6B7A99",
    fontSize: 8,
    fontWeight: "600",
  },

  durationText: {
    color: "#003366",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },

  detailText: {
    marginTop: 3,
    color: "#6B7A99",
    fontSize: 10,
    textAlign: "center",
  },

  shiftText: {
    marginTop: 5,
    color: "#2563EB",
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyContainer: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: "#003366",
    fontSize: 14,
    fontWeight: "700",
  },

  emptyText: {
    marginTop: 4,
    color: "#6B7A99",
    fontSize: 12,
  },
});
