/**
 * Enforcement View -- Read-only display of driver logbook records
 * designed for roadside inspections by NZ Transport Officers.
 * Shows recent shifts in a clean, official format with verification status.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "../components/screen-container";
import { useAuthContext } from "../lib/auth-context";
import * as Logbook from "../lib/logbook-storage";
import { verifyLogIntegrity, verifyFullChain, formatHashShort } from "../lib/integrity";
import { ActivityGrid } from "../components/activity-grid";

type VerificationResult = {
  logId: string;
  verified: boolean;
  hash: string;
};

export default function EnforcementViewScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [logs, setLogs] = useState<Logbook.DailyLog[]>([]);
  const [verifications, setVerifications] = useState<Map<string, VerificationResult>>(new Map());
  const [chainStatus, setChainStatus] = useState<{ valid: boolean; total: number; verified: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  async function loadData() {
    if (!user) return;
    setLoading(true);

    // Load last 14 days of logs (fortnightly period)
    const allLogs = await Logbook.getAllLogs(user.id);
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const recentLogs = allLogs.filter(
      (l) => new Date(l.startTime).getTime() >= twoWeeksAgo
    );
    setLogs(recentLogs);

    // Verify chain integrity
    const chain = await verifyFullChain(user.id, allLogs);
    setChainStatus({ valid: chain.valid, total: chain.totalEntries, verified: chain.verifiedEntries });

    // Verify each log
    const verMap = new Map<string, VerificationResult>();
    for (const log of recentLogs) {
      const result = await verifyLogIntegrity(log);
      verMap.set(log.id, { logId: log.id, verified: result.verified, hash: result.hash });
    }
    setVerifications(verMap);
    setLoading(false);
  }

  const totalDriving = logs.reduce((s, l) => s + l.totalDrivingSeconds, 0);
  const totalWork = logs.reduce((s, l) => s + l.totalWorkSeconds, 0);
  const totalBreaks = logs.reduce(
    (s, l) => s + l.breaks.reduce((bs, b) => bs + b.durationSeconds, 0),
    0
  );

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View className="px-5 pt-2 pb-4">
        <View className="flex-row items-center justify-between mb-3">
          <TouchableOpacity
            className="px-3 py-2 rounded-full border border-[#4A6AB0]"
            onPress={() => router.back()}
          >
            <Text className="text-white text-sm font-bold">← Back</Text>
          </TouchableOpacity>
          <View className="bg-[#1A4D80] px-3 py-1 rounded-full">
            <Text className="text-[#7DD3FC] text-xs font-bold">🔒 READ ONLY</Text>
          </View>
        </View>
        <Text className="text-white text-xl font-bold text-center">
          ENFORCEMENT VIEW
        </Text>
        <Text className="text-[#7DD3FC] text-xs text-center mt-1 tracking-wider">
          NZ TRANSPORT OFFICER INSPECTION
        </Text>
      </View>

      <View className="flex-1 bg-white rounded-t-3xl">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#003366" />
            <Text className="text-[#6B7A99] mt-3">Verifying records...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
          >
            {/* Driver Info Card */}
            <View className="bg-[#F0F4FF] rounded-xl p-4 mb-4 border border-[#D0DCFF]">
              <Text className="text-[#003366] text-sm font-bold mb-2">DRIVER DETAILS</Text>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[#4A5568] text-sm">Name:</Text>
                <Text className="text-[#003366] text-sm font-bold">{user?.name ?? "--"}</Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[#4A5568] text-sm">Licence No:</Text>
                <Text className="text-[#003366] text-sm font-bold">{user?.licenceNumber ?? "--"}</Text>
              </View>
              <View className="flex-row justify-between mb-1">
                <Text className="text-[#4A5568] text-sm">Vehicle Rego:</Text>
                <Text className="text-[#003366] text-sm font-bold">{user?.vehicleRegistration ?? "--"}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[#4A5568] text-sm">Vehicle Type:</Text>
                <Text className="text-[#003366] text-sm font-bold">{user?.vehicleType ?? "--"}</Text>
              </View>
            </View>

            {/* Integrity Status */}
            <View
              className={`rounded-xl p-4 mb-4 border ${
                chainStatus?.valid
                  ? "bg-[#F0FFF4] border-[#C6F6D5]"
                  : "bg-[#FFF5F5] border-[#FED7D7]"
              }`}
            >
              <View className="flex-row items-center mb-2">
                <Text className="text-lg mr-2">
                  {chainStatus?.valid ? "✅" : "⚠️"}
                </Text>
                <Text
                  className={`text-sm font-bold ${
                    chainStatus?.valid ? "text-[#276749]" : "text-[#C53030]"
                  }`}
                >
                  {chainStatus?.valid
                    ? "INTEGRITY VERIFIED"
                    : "INTEGRITY CHECK FAILED"}
                </Text>
              </View>
              <Text className="text-xs text-[#4A5568]">
                Hash chain: {chainStatus?.verified ?? 0}/{chainStatus?.total ?? 0} records verified
                {chainStatus?.valid
                  ? " • No tampering detected"
                  : " • Records may have been modified"}
              </Text>
            </View>

            {/* Fortnightly Summary */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-[#E2E8F0]">
              <Text className="text-[#003366] text-sm font-bold mb-3">
                FORTNIGHTLY SUMMARY (Last 14 Days)
              </Text>
              <View className="flex-row justify-between mb-2">
                <View className="flex-1 items-center">
                  <Text className="text-[#003366] text-lg font-bold">
                    {Logbook.formatHoursMinutes(totalDriving)}
                  </Text>
                  <Text className="text-[#6B7A99] text-xs">Driving</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-[#003366] text-lg font-bold">
                    {Logbook.formatHoursMinutes(totalWork)}
                  </Text>
                  <Text className="text-[#6B7A99] text-xs">Work Time</Text>
                </View>
                <View className="flex-1 items-center">
                  <Text className="text-[#003366] text-lg font-bold">
                    {Logbook.formatHoursMinutes(totalBreaks)}
                  </Text>
                  <Text className="text-[#6B7A99] text-xs">Breaks</Text>
                </View>
              </View>
              <View className="mt-2 pt-2 border-t border-[#E2E8F0]">
                <View className="flex-row justify-between">
                  <Text className="text-[#4A5568] text-xs">Fortnightly Driving Limit:</Text>
                  <Text
                    className={`text-xs font-bold ${
                      totalDriving > 70 * 3600 ? "text-[#E53E3E]" : "text-[#276749]"
                    }`}
                  >
                    {Logbook.formatHoursMinutes(totalDriving)} / 70h
                  </Text>
                </View>
                <View className="flex-row justify-between mt-1">
                  <Text className="text-[#4A5568] text-xs">Total Shifts:</Text>
                  <Text className="text-xs font-bold text-[#003366]">{logs.length}</Text>
                </View>
              </View>
            </View>

            {/* Activity Grid -- CWP Timeline */}
            <View className="bg-white rounded-xl p-4 mb-4 border border-[#E2E8F0]">
              <Text className="text-[#003366] text-sm font-bold mb-3">
                ACTIVITY GRID -- CUMULATIVE WORK PERIOD
              </Text>
              <ActivityGrid logs={logs} compact />
            </View>

            {/* Individual Shift Records */}
            <Text className="text-[#003366] text-sm font-bold mb-3">
              SHIFT RECORDS ({logs.length})
            </Text>

            {logs.map((log) => {
              const ver = verifications.get(log.id);
              const totalBreakSec = log.breaks.reduce((s, b) => s + b.durationSeconds, 0);
              return (
                <View
                  key={log.id}
                  className="bg-white rounded-xl p-4 mb-3 border border-[#E2E8F0]"
                >
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="text-[#003366] text-sm font-bold">
                      {Logbook.formatDate(log.startTime)}
                    </Text>
                    <View
                      className={`px-2 py-1 rounded-full ${
                        ver?.verified
                          ? "bg-[#F0FFF4]"
                          : "bg-[#FFFBEB]"
                      }`}
                    >
                      <Text
                        className={`text-xs font-bold ${
                          ver?.verified
                            ? "text-[#276749]"
                            : "text-[#92400E]"
                        }`}
                      >
                        {ver?.verified ? "✓ Verified" : "○ Unverified"}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[#6B7A99] text-xs">Shift:</Text>
                    <Text className="text-[#003366] text-xs font-medium">
                      {Logbook.formatTime(log.startTime)} -- {Logbook.formatTime(log.endTime)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[#6B7A99] text-xs">Driving:</Text>
                    <Text className="text-[#003366] text-xs font-medium">
                      {Logbook.formatHoursMinutes(log.totalDrivingSeconds)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[#6B7A99] text-xs">Work Time:</Text>
                    <Text className="text-[#003366] text-xs font-medium">
                      {Logbook.formatHoursMinutes(log.totalWorkSeconds)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-[#6B7A99] text-xs">Breaks:</Text>
                    <Text className="text-[#003366] text-xs font-medium">
                      {log.breaks.length} ({Logbook.formatHoursMinutes(totalBreakSec)})
                    </Text>
                  </View>

                  {/* Rest override flag -- shown to enforcement officers */}
                  {log.restOverrideFlagged && (
                    <View className="mt-3 p-3 rounded-xl bg-[#FFFBEB] border border-[#FCD34D]">
                      <Text className="text-xs font-bold text-[#92400E] mb-1">⚠️ Rest requirement not met -- driver-reported unavoidable delay</Text>
                      <Text className="text-xs text-[#78350F] leading-relaxed">{log.restOverrideNote}</Text>
                      <Text className="text-[10px] text-[#B45309] mt-1">Land Transport Rule: Work Time and Logbooks 2007 -- unavoidable delay exception</Text>
                    </View>
                  )}

                  {ver?.hash && ver.hash !== "N/A" && (
                    <View className="mt-2 pt-2 border-t border-[#F0F4FF]">
                      <Text className="text-[#9CA3AF] text-[10px] font-mono">
                        SHA-256: {formatHashShort(ver.hash)}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}

            {logs.length === 0 && (
              <View className="items-center py-8">
                <Text className="text-[#6B7A99] text-sm">No shift records in the last 14 days</Text>
              </View>
            )}

            {/* Footer */}
            <View className="mt-4 pt-4 border-t border-[#E2E8F0]">
              <Text className="text-[#9CA3AF] text-[10px] text-center">
                Generated by Drive Legal v1.0 • Records protected by SHA-256 hash chain
              </Text>
              <Text className="text-[#9CA3AF] text-[10px] text-center mt-1">
                Land Transport Rule: Work Time and Logbooks 2007
              </Text>
            </View>
          </ScrollView>
        )}
      </View>
    </ScreenContainer>
  );
}
