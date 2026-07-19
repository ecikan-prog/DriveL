import React, { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Image,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useRouter } from "expo-router";

import { ActivityGrid } from "@/components/activity-grid";
import { ScreenContainer } from "@/components/screen-container";
import { getDrivingLimitSeconds } from "@/hooks/use-nzta-compliance";
import { isAmended } from "@/lib/amendments";
import { useAuthContext } from "@/lib/auth-context";
import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  formatDate,
  formatHoursMinutes,
  formatTime,
  getAllLogs,
  logsToCSV,
  type DailyLog,
} from "@/lib/logbook-storage";

const COLORS = {
  navy: "#003366",
  navyDark: "#1A3A6B",
  blue: "#5980E9",
  blueLight: "#BFDBFE",
  page: "#F0F4FF",
  white: "#FFFFFF",
  green: "#22C55E",
  greenDark: "#276749",
  greenSoft: "#F0FDF4",
  warning: "#F59E0B",
  warningSoft: "#FFFBEB",
  text: "#10243E",
  muted: "#6B7A99",
  subtle: "#9BA8C0",
  border: "#D1DCF0",
  cardBorder: "#E2E8F0",
};

type FilterPeriod = "week" | "fortnight" | "month" | "all";

function LogCard({
  log,
  onPress,
  driverType,
}: {
  log: DailyLog;
  onPress: () => void;
  driverType?: string;
}) {
  const breaks = log.breaks ?? [];

  const totalBreakSeconds = breaks.reduce(
    (sum, breakEntry) => sum + (breakEntry.durationSeconds ?? 0),
    0
  );

  const drivingHours = (log.totalDrivingSeconds ?? 0) / 3600;
  const workHours = (log.totalWorkSeconds ?? 0) / 3600;
  const drivingLimitHours =
    getDrivingLimitSeconds(driverType as any) / 3600;

  const isCompliant =
    drivingHours <= drivingLimitHours && workHours <= 13;

  const statusColor = isCompliant ? COLORS.green : COLORS.warning;
  const backgroundColor = isCompliant
    ? COLORS.greenSoft
    : COLORS.warningSoft;
  const borderColor = isCompliant ? "#DCFCE7" : "#FEF3C7";

  return (
    <TouchableOpacity
      style={[
        styles.logCard,
        {
          backgroundColor,
          borderColor,
        },
      ]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <View style={styles.logHeaderRow}>
        <View style={styles.logHeaderMain}>
          <View style={styles.logDateRow}>
            <Text style={[styles.statusIcon, { color: statusColor }]}>
              {isCompliant ? "✓" : "⚠"}
            </Text>

            <Text style={styles.logDate}>
              {formatDate(log.startTime)}
            </Text>

            {isAmended(log) ? (
              <Text style={styles.amendedMark}>*</Text>
            ) : null}
          </View>

          <Text style={styles.logTime}>
            {formatTime(log.startTime)} – {formatTime(log.endTime)}
          </Text>
        </View>

        <View
          style={[
            styles.statusBadge,
            { backgroundColor: statusColor },
          ]}
        >
          <Text style={styles.statusBadgeText}>
            {isCompliant ? "Compliant" : "Review"}
          </Text>
        </View>
      </View>

      <View style={styles.logStatsRow}>
        <View style={styles.logStatBox}>
          <Text style={styles.logStatLabel}>🚗 Driving</Text>
          <Text style={styles.logStatValue}>
            {formatHoursMinutes(log.totalDrivingSeconds ?? 0)}
          </Text>
        </View>

        <View style={styles.logStatBox}>
          <Text style={styles.logStatLabel}>⏱ Work</Text>
          <Text style={styles.logStatValue}>
            {formatHoursMinutes(log.totalWorkSeconds ?? 0)}
          </Text>
        </View>

        <View style={styles.logStatBox}>
          <Text style={styles.logStatLabel}>☕ Breaks</Text>
          <Text style={styles.logStatValue}>
            {breaks.length > 0 ? breaks.length : "—"}
          </Text>

          {breaks.length > 0 ? (
            <Text style={styles.logStatSubtext}>
              {formatHoursMinutes(totalBreakSeconds)}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();

  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filterPeriod, setFilterPeriod] =
    useState<FilterPeriod>("all");

  const loadLogs = useCallback(async () => {
    if (!user) return;

    try {
      const data = await getAllLogs(user.id);
      setLogs(data);
    } catch (error) {
      console.error("Failed to load history logs:", error);
      setLogs([]);
    }
  }, [user]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      await loadLogs();
    } finally {
      setRefreshing(false);
    }
  }, [loadLogs]);

  const getFilteredLogs = () => {
    if (filterPeriod === "all") {
      return logs;
    }

    const now = new Date();
    const cutoffDate = new Date(now);

    if (filterPeriod === "week") {
      cutoffDate.setDate(now.getDate() - 7);
    } else if (filterPeriod === "fortnight") {
      cutoffDate.setDate(now.getDate() - 14);
    } else {
      cutoffDate.setMonth(now.getMonth() - 1);
    }

    return logs.filter((log) => {
      const start = new Date(log.startTime);
      return !Number.isNaN(start.getTime()) && start >= cutoffDate;
    });
  };

  const handleExportPDF = async () => {
    if (!user || logs.length === 0) {
      Alert.alert("No Logs", "There are no logs to export yet.");
      return;
    }

    setExporting(true);

    try {
      const { generateAndSharePDF } = await import(
        "@/lib/pdf-export"
      );

      await generateAndSharePDF({
        logs: getFilteredLogs(),
        driverName: user.name ?? "Driver",
        licenceNumber: user.licenceNumber,
        vehicleRegistration: user.vehicleRegistration,
        vehicleType: user.vehicleType,
        driverType: user.driverType,
      });
    } catch (error) {
      console.error("PDF export failed:", error);
      Alert.alert(
        "PDF Export Failed",
        "Could not generate PDF. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    if (!user || logs.length === 0) {
      Alert.alert("No Logs", "There are no logs to export yet.");
      return;
    }

    setExporting(true);

    try {
      const filteredLogs = getFilteredLogs();

      const csv = logsToCSV(
        filteredLogs,
        user.name ?? "Driver",
        user.licenceNumber
      );

      const fileName = `drivelegal_export_${
        new Date().toISOString().split("T")[0]
      }.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");

        anchor.href = url;
        anchor.download = fileName;
        anchor.click();

        URL.revokeObjectURL(url);
        return;
      }

      const apiBase = getApiBaseUrl();

      const response = await fetch(`${apiBase}/api/export/csv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          logs: filteredLogs,
          driverName: user.name ?? "Driver",
          licenceNumber: user.licenceNumber,
        }),
      });

      if (!response.ok) {
        const errorBody = await response
          .json()
          .catch(() => ({ error: "Server error" }));

        throw new Error(
          errorBody.error || "Failed to export CSV."
        );
      }

      const result = await response.json();

      if (result.url) {
        await Linking.openURL(result.url);
      }
    } catch (error) {
      console.error("CSV export failed:", error);
      Alert.alert(
        "Export Failed",
        "Could not export logs. Please try again."
      );
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = getFilteredLogs();

  const groupedLogs = filteredLogs.reduce<
    Record<string, DailyLog[]>
  >((groups, log) => {
    const date = new Date(log.startTime);

    const key = Number.isNaN(date.getTime())
      ? "Unknown date"
      : date.toLocaleDateString("en-NZ", {
          month: "long",
          year: "numeric",
        });

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(log);

    return groups;
  }, {});

  const totalDrivingSeconds = filteredLogs.reduce(
    (sum, log) => sum + (log.totalDrivingSeconds ?? 0),
    0
  );

  const driverType =
    (user as any)?.driverType ?? "small_passenger";

  const drivingLimitHours =
    getDrivingLimitSeconds(driverType) / 3600;

  const compliantCount = filteredLogs.filter((log) => {
    const drivingHours =
      (log.totalDrivingSeconds ?? 0) / 3600;
    const workHours = (log.totalWorkSeconds ?? 0) / 3600;

    return (
      drivingHours <= drivingLimitHours && workHours <= 13
    );
  }).length;

  const summaryTitle =
    filterPeriod === "all"
      ? "All-Time"
      : filterPeriod === "week"
      ? "This Week"
      : filterPeriod === "fortnight"
      ? "This Fortnight"
      : "This Month";

  return (
    <ScreenContainer style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={styles.logo}
            resizeMode="cover"
          />

          <View>
            <Text style={styles.brandTitle}>
              DRIVE{" "}
              <Text style={styles.brandAccent}>LEGAL</Text>
            </Text>
            <Text style={styles.pageTitle}>📋 Shift History</Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.headerButton,
              styles.officerButton,
            ]}
            activeOpacity={0.75}
            onPress={() =>
              router.push("/enforcement-view" as any)
            }
          >
            <Text style={styles.headerButtonIcon}>🔒</Text>
            <Text style={styles.headerButtonText}>Officer</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              exporting
                ? styles.disabledButton
                : styles.pdfButton,
            ]}
            activeOpacity={0.75}
            disabled={exporting}
            onPress={handleExportPDF}
          >
            <Text style={styles.headerButtonIcon}>📄</Text>
            <Text style={styles.headerButtonText}>PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerButton,
              styles.csvButton,
              exporting && styles.disabledButton,
            ]}
            activeOpacity={0.75}
            disabled={exporting}
            onPress={handleExportCSV}
          >
            <Text style={styles.headerButtonIcon}>📥</Text>
            <Text style={styles.headerButtonText}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.soleUseNotice}>
        <Text style={styles.soleUseText}>
          ⚠️ This logbook is for the sole use of the
          registered driver: {user?.name ?? "—"}
        </Text>
      </View>

      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.navy}
            />
          }
        >
          <View style={styles.filterRow}>
            {(
              [
                ["week", "Week"],
                ["fortnight", "Fortnight"],
                ["month", "Month"],
                ["all", "All"],
              ] as const
            ).map(([period, label]) => {
              const selected = filterPeriod === period;

              return (
                <TouchableOpacity
                  key={period}
                  style={[
                    styles.filterButton,
                    selected && styles.filterButtonSelected,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => setFilterPeriod(period)}
                >
                  <Text
                    style={[
                      styles.filterButtonText,
                      selected &&
                        styles.filterButtonTextSelected,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {filteredLogs.length > 0 ? (
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>
                📊 {summaryTitle} Summary
              </Text>

              <View style={styles.summaryStatsRow}>
                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>
                    Shifts
                  </Text>
                  <Text style={styles.summaryValue}>
                    {filteredLogs.length}
                  </Text>
                </View>

                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>
                    Driving
                  </Text>
                  <Text style={styles.summaryValue}>
                    {formatHoursMinutes(totalDrivingSeconds)}
                  </Text>
                </View>

                <View style={styles.summaryStat}>
                  <Text style={styles.summaryLabel}>
                    Compliant
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      styles.compliantValue,
                    ]}
                  >
                    {compliantCount}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}

          {filteredLogs.length > 0 ? (
            <View style={styles.activityCard}>
              <Text style={styles.activityTitle}>
                📊 ACTIVITY GRID — CWP TIMELINE
              </Text>
              <ActivityGrid logs={filteredLogs} />
            </View>
          ) : null}

          {filteredLogs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyTitle}>No Logs Yet</Text>
              <Text style={styles.emptyText}>
                Start your first shift from the Dashboard to
                begin recording your driving hours.
              </Text>
            </View>
          ) : (
            Object.entries(groupedLogs).map(
              ([month, monthLogs]) => (
                <View key={month} style={styles.monthGroup}>
                  <Text style={styles.monthTitle}>
                    {month}
                  </Text>

                  {monthLogs.map((log) => (
                    <LogCard
                      key={log.id}
                      log={log}
                      driverType={driverType}
                      onPress={() =>
                        router.push({
                          pathname: "/log-detail",
                          params: {
                            logId: log.id,
                          },
                        } as any)
                      }
                    />
                  ))}
                </View>
              )
            )
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginRight: 8,
  },
  brandTitle: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  brandAccent: {
    color: "#4ADE80",
  },
  pageTitle: {
    color: COLORS.blueLight,
    fontSize: 12,
    marginTop: 2,
  },
  headerActions: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: 12,
},
  headerButton: {
  flex: 1,
  minHeight: 38,
  paddingHorizontal: 10,
  borderRadius: 19,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  marginHorizontal: 4,
},
  officerButton: {
    backgroundColor: COLORS.greenDark,
  },
  pdfButton: {
    backgroundColor: COLORS.blue,
  },
  csvButton: {
    backgroundColor: COLORS.navyDark,
  },
  disabledButton: {
    opacity: 0.55,
  },
  headerButtonIcon: {
  fontSize: 16,
  marginRight: 5,
},
  headerButtonText: {
  color: COLORS.white,
  fontSize: 14,
  fontWeight: "700",
},
  soleUseNotice: {
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.navyDark,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2A4A7B",
  },
  soleUseText: {
    color: COLORS.blueLight,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  filterRow: {
    flexDirection: "row",
    marginBottom: 16,
  },
  filterButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginRight: 8,
  },
  filterButtonSelected: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.navy,
  },
  filterButtonText: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "600",
  },
  filterButtonTextSelected: {
    color: COLORS.white,
  },
  summaryCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: "#4A6AB0",
  },
  summaryTitle: {
    color: COLORS.blueLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 14,
  },
  summaryStatsRow: {
    flexDirection: "row",
  },
  summaryStat: {
    flex: 1,
  },
  summaryLabel: {
    color: "#93C5FD",
    fontSize: 11,
    marginBottom: 3,
  },
  summaryValue: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "700",
  },
  compliantValue: {
    color: "#86EFAC",
  },
  activityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  activityTitle: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 70,
    paddingHorizontal: 30,
  },
  emptyIcon: {
    fontSize: 46,
    marginBottom: 14,
  },
  emptyTitle: {
    color: COLORS.navy,
    fontSize: 19,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  monthGroup: {
    marginBottom: 10,
  },
  monthTitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  logCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  logHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 13,
  },
  logHeaderMain: {
    flex: 1,
    paddingRight: 10,
  },
  logDateRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  statusIcon: {
    fontSize: 18,
    fontWeight: "800",
    width: 24,
  },
  logDate: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: "700",
  },
  amendedMark: {
    color: "#D97706",
    fontSize: 18,
    fontWeight: "800",
    marginLeft: 4,
  },
  logTime: {
    color: COLORS.muted,
    fontSize: 12,
    marginLeft: 24,
  },
  statusBadge: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 14,
  },
  statusBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },
  logStatsRow: {
    flexDirection: "row",
  },
  logStatBox: {
    flex: 1,
    minHeight: 68,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E8EEF8",
    marginRight: 7,
  },
  logStatLabel: {
    color: COLORS.muted,
    fontSize: 10,
    fontWeight: "500",
    marginBottom: 4,
  },
  logStatValue: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "700",
  },
  logStatSubtext: {
    color: COLORS.subtle,
    fontSize: 10,
    marginTop: 2,
  },
});
