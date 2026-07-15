import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "../components/screen-container";
import { useAuthContext } from "../lib/auth-context";
import { getApiBaseUrl } from "../lib/api-base-url";

import {
 getAllLogs,
 logsToCSV,
 formatDate,
 formatTime,
 formatHoursMinutes,
 type DailyLog,
} from "../lib/logbook-storage";
import { isAmended } from "../lib/amendments";
import { ActivityGrid } from "../components/activity-grid";
import { getDrivingLimitSeconds } from "../hooks/use-nzta-compliance";

function LogCard({
  log,
  onPress,
  driverType,
}: {
  log: DailyLog;
  onPress: () => void;
  driverType?: string;
}) {
  const totalBreakSeconds = log.breaks.reduce((s, b) => s + b.durationSeconds, 0);
  const drivingHours = log.totalDrivingSeconds / 3600;
  const workHours = log.totalWorkSeconds / 3600;
  const drivingLimitHours = getDrivingLimitSeconds(driverType as any) / 3600;

  const isCompliant = drivingHours <= drivingLimitHours && workHours <= 13;
  const statusIcon = isCompliant ? "✓" : "⚠";
  const statusColor = isCompliant ? "#22C55E" : "#F59E0B";
  const bgColor = isCompliant ? "#F0FDF4" : "#FFFBEB";
  const borderColor = isCompliant ? "#DCFCE7" : "#FEF3C7";

  return (
    <TouchableOpacity
      className="rounded-2xl p-4 mb-3 border active:opacity-75"
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        borderWidth: 1,
      }}
      onPress={onPress}
    >
      {/* Header Row */}
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text style={{ color: statusColor }} className="text-lg font-bold">
              {statusIcon}
            </Text>
            <Text className="text-base font-bold text-[#003366]">
              {formatDate(log.startTime)}
            </Text>
            {isAmended(log) && (
              <Text style={{ color: "#D97706", fontSize: 18, fontWeight: "800" }}> *</Text>
            )}
          </View>
          <Text className="text-xs text-[#6B7A99] ml-6">
            {formatTime(log.startTime)} -- {formatTime(log.endTime)}
          </Text>
        </View>
        <View
          className="px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: statusColor,
          }}
        >
          <Text className="text-xs font-bold text-white">
            {isCompliant ? "Compliant" : "Review"}
          </Text>
        </View>
      </View>

      {/* Stats Grid */}
      <View className="flex-row gap-2">
        <View className="flex-1 bg-white rounded-xl p-3 border border-[#E8EEF8]">
          <Text className="text-xs text-[#6B7A99] mb-0.5 font-medium">🚗 Driving</Text>
          <Text className="text-sm font-bold text-[#003366]">
            {formatHoursMinutes(log.totalDrivingSeconds)}
          </Text>
        </View>
        <View className="flex-1 bg-white rounded-xl p-3 border border-[#E8EEF8]">
          <Text className="text-xs text-[#6B7A99] mb-0.5 font-medium">⏱ Work</Text>
          <Text className="text-sm font-bold text-[#003366]">
            {formatHoursMinutes(log.totalWorkSeconds)}
          </Text>
        </View>
        <View className="flex-1 bg-white rounded-xl p-3 border border-[#E8EEF8]">
          <Text className="text-xs text-[#6B7A99] mb-0.5 font-medium">☕ Breaks</Text>
          <Text className="text-sm font-bold text-[#003366]">
            {log.breaks.length > 0
              ? `${log.breaks.length}`
              : "--"}
          </Text>
          {log.breaks.length > 0 && (
            <Text className="text-xs text-[#9BA8C0] mt-0.5">
              {formatHoursMinutes(totalBreakSeconds)}
            </Text>
          )}
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
  const [filterPeriod, setFilterPeriod] = useState<"week" | "fortnight" | "month" | "all">("all");

  const loadLogs = useCallback(async () => {
    if (!user) return;
    const data = await getAllLogs(user.id);
    setLogs(data);
  }, [user]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  }, [loadLogs]);

  const getFilteredLogs = () => {
    const now = new Date();
    let cutoffDate = new Date();

    switch (filterPeriod) {
      case "week":
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case "fortnight":
        cutoffDate.setDate(now.getDate() - 14);
        break;
      case "month":
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case "all":
      default:
        return logs;
    }

    return logs.filter((log) => new Date(log.startTime) >= cutoffDate);
  };

  const handleExportPDF = async () => {
    if (!user || logs.length === 0) {
      Alert.alert("No Logs", "There are no logs to export yet.");
      return;
    }
    setExporting(true);
    try {
      const { generateAndSharePDF } = await import("../lib/pdf-export");
      await generateAndSharePDF({
        logs: getFilteredLogs(),
        driverName: user.name ?? "Driver",
        licenceNumber: user.licenceNumber,
        vehicleRegistration: user.vehicleRegistration,
        vehicleType: user.vehicleType,
        driverType: user.driverType,
      });
    } catch (e) {
      Alert.alert("PDF Export Failed", "Could not generate PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    if (!user || logs.length === 0) {
      Alert.alert("No Logs", "There are no logs to export yet.");
      return;
    }

    setExporting(true);
    try {
      const csv = logsToCSV(logs, user.name ?? "Driver", user.licenceNumber);
      const fileName = `gnzl_export_${new Date().toISOString().split("T")[0]}.csv`;

      if (Platform.OS === "web") {
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Native iOS: POST to server, get download URL, open in Safari
        const { getApiBaseUrl } = await import("../server/oauth");
        const { Linking } = await import("react-native");
        const apiBase = getApiBaseUrl();
        const resp = await fetch(`${apiBase}/api/export/csv`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ logs, driverName: user.name ?? "Driver", licenceNumber: user.licenceNumber }),
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: "Server error" }));
          throw new Error(err.error || "Failed to export CSV.");
        }
        const { url } = await resp.json();
        if (url) await Linking.openURL(url);
      }
    } catch (e) {
      Alert.alert("Export Failed", "Could not export logs. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const filteredLogs = getFilteredLogs();

  // Group logs by month
  const groupedLogs = filteredLogs.reduce<Record<string, DailyLog[]>>((acc, log) => {
    const d = new Date(log.startTime);
    const key = d.toLocaleDateString("en-NZ", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = [];
    acc[key].push(log);
    return acc;
  }, {});

  const totalDrivingSeconds = filteredLogs.reduce((s, l) => s + l.totalDrivingSeconds, 0);
  const totalWorkSeconds = filteredLogs.reduce((s, l) => s + l.totalWorkSeconds, 0);
  const driverType = (user as any)?.driverType ?? "small_passenger";
  const drivingLimitHours = getDrivingLimitSeconds(driverType) / 3600;
  const compliantCount = filteredLogs.filter((l) => {
    const dh = l.totalDrivingSeconds / 3600;
    const wh = l.totalWorkSeconds / 3600;
    return dh <= drivingLimitHours && wh <= 13;
  }).length;

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View className="px-5 pt-2 pb-4 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Image
            source={require("../assets/images/icon.png")}
            style={{ width: 36, height: 36, borderRadius: 8 }}
            resizeMode="cover"
          />
          <View>
            <Text className="text-white text-xs font-bold tracking-widest">
              <Text className="text-white">DRIVE </Text><Text style={{ color: "#4ADE80" }}>LEGAL</Text>
            </Text>
            <Text className="text-blue-200 text-xs">📋 Shift History</Text>
          </View>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            className="px-3 py-2 rounded-full flex-row items-center gap-1 bg-[#276749]"
            onPress={() => router.push("/enforcement-view" as any)}
          >
            <Text className="text-white text-sm">🔒</Text>
            <Text className="text-white text-xs font-bold">Officer</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`px-3 py-2 rounded-full flex-row items-center gap-1 ${
              exporting ? "bg-[#1A3A6B]" : "bg-[#5980E9]"
            }`}
            onPress={handleExportPDF}
            disabled={exporting}
          >
            <Text className="text-white text-sm">📄</Text>
            <Text className="text-white text-xs font-bold">PDF</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className={`px-3 py-2 rounded-full flex-row items-center gap-1 ${
              exporting ? "bg-[#1A3A6B]" : "bg-[#1A3A6B]"
            }`}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text className="text-white text-sm">📥</Text>
            <Text className="text-white text-xs font-bold">CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sole Use Notice -- NZTA spec 4.1.2 */}
      <View className="mx-5 mb-2 px-3 py-2 bg-[#1A3A6B] rounded-lg border border-[#2A4A7B]">
        <Text className="text-blue-200 text-xs text-center">
          ⚠️ This logbook is for the sole use of the registered driver: {user?.name ?? "--"}
        </Text>
      </View>

      <View className="flex-1 bg-[#F0F4FF] rounded-t-3xl">
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Filter Tabs */}
          <View className="flex-row gap-2 mb-4">
            {(["week", "fortnight", "month", "all"] as const).map((period) => (
              <TouchableOpacity
                key={period}
                className={`px-3 py-2 rounded-full border ${
                  filterPeriod === period
                    ? "bg-[#003366] border-[#003366]"
                    : "bg-white border-[#D1DCF0]"
                }`}
                onPress={() => setFilterPeriod(period)}
              >
                <Text
                  className={`text-xs font-semibold ${
                    filterPeriod === period ? "text-white" : "text-[#003366]"
                  }`}
                >
                  {period === "week"
                    ? "Week"
                    : period === "fortnight"
                    ? "Fortnight"
                    : period === "month"
                    ? "Month"
                    : "All"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Summary Card */}
          {filteredLogs.length > 0 && (
            <View className="bg-[#003366] rounded-2xl p-4 mb-5 border border-[#4A6AB0]">
              <Text className="text-blue-200 text-xs font-semibold uppercase tracking-wide mb-3">
                📊 {filterPeriod === "all" ? "All-Time" : filterPeriod === "week" ? "This Week" : filterPeriod === "fortnight" ? "This Fortnight" : "This Month"} Summary
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Text className="text-blue-300 text-xs mb-0.5">Shifts</Text>
                  <Text className="text-white text-xl font-bold">{filteredLogs.length}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-blue-300 text-xs mb-0.5">Driving</Text>
                  <Text className="text-white text-xl font-bold">
                    {formatHoursMinutes(totalDrivingSeconds)}
                  </Text>
                </View>
                <View className="flex-1">
                  <Text className="text-blue-300 text-xs mb-0.5">Compliant</Text>
                  <Text className="text-green-300 text-xl font-bold">{compliantCount}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Activity Grid -- CWP Timeline */}
          {filteredLogs.length > 0 && (
            <View className="bg-white rounded-2xl p-4 mb-5 border border-[#E2E8F0]">
              <Text className="text-[#003366] text-sm font-bold mb-3 tracking-wide">
                📊 ACTIVITY GRID -- CWP TIMELINE
              </Text>
              <ActivityGrid logs={filteredLogs} />
            </View>
          )}

          {filteredLogs.length === 0 ? (
            <View className="items-center py-16">
              <Text className="text-5xl mb-4">📋</Text>
              <Text className="text-lg font-bold text-[#003366] mb-2">No Logs Yet</Text>
              <Text className="text-sm text-[#6B7A99] text-center leading-relaxed px-8">
                Start your first shift from the Dashboard to begin recording your driving hours.
              </Text>
            </View>
          ) : (
            Object.entries(groupedLogs).map(([month, monthLogs]) => (
              <View key={month} className="mb-3">
                <Text className="text-xs font-bold text-[#6B7A99] uppercase tracking-widest mb-2 px-1">
                  {month}
                </Text>
                {monthLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    driverType={driverType}
                    onPress={() =>
                      router.push({
                        pathname: "/shift-detail",
                        params: { logId: log.id },
                      } as any)
                    }
                  />
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}

