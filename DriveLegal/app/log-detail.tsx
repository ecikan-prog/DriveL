import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getLogById,
  formatDate,
  formatTime,
  formatHoursMinutes,
  type DailyLog,
  type ShiftEvent,
} from "@/lib/logbook-storage";
import { getDrivingLimitSeconds } from "@/hooks/use-nzta-compliance";

function EventRow({ event }: { event: ShiftEvent }) {
  const config: Record<string, { icon: string; label: string; color: string }> = {
    shift_start: { icon: "▶", label: "Shift Started", color: "#22C55E" },
    break_start: { icon: "☕", label: "Break Started", color: "#F59E0B" },
    break_end: { icon: "▶", label: "Break Ended", color: "#5980E9" },
    shift_end: { icon: "⏹", label: "Shift Ended", color: "#EF4444" },
  };
  const c = config[event.type] ?? { icon: "•", label: event.type, color: "#6B7A99" };

  return (
    <View className="flex-row items-center py-3 border-b border-[#F0F4FF]">
      <View
        className="w-8 h-8 rounded-full items-center justify-center mr-3"
        style={{ backgroundColor: c.color + "20" }}
      >
        <Text style={{ color: c.color }} className="text-sm">
          {c.icon}
        </Text>
      </View>
      <View className="flex-1">
        <Text className="text-sm font-semibold text-[#0D1B2A]">{c.label}</Text>
        {event.note ? (
          <Text className="text-xs text-[#6B7A99]">{event.note}</Text>
        ) : null}
      </View>
      <Text className="text-sm text-[#6B7A99] font-mono">
        {formatTime(event.timestamp)}
      </Text>
    </View>
  );
}

export default function LogDetailScreen() {
  const router = useRouter();
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const { user } = useAuthContext();
  const [log, setLog] = useState<DailyLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !logId) return;
    getLogById(user.id, logId).then((l) => {
      setLog(l);
      setLoading(false);
    });
  }, [user, logId]);

  if (loading) {
    return (
      <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
        <View className="flex-1 items-center justify-center">
          <Text className="text-white">Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  if (!log) {
    return (
      <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-white text-lg font-bold mb-2">Log Not Found</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text className="text-blue-200">← Go Back</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  const breaks = log.breaks ?? [];
const events = log.events ?? [];

const totalBreakSeconds = breaks.reduce(
  (sum, breakEntry) => sum + (breakEntry.durationSeconds ?? 0),
  0
);
  const drivingHours = log.totalDrivingSeconds / 3600;
  const workHours = log.totalWorkSeconds / 3600;
  const driverType = (user as any)?.driverType ?? "small_passenger";
  const drivingLimitHours = getDrivingLimitSeconds(driverType) / 3600;
  const isCompliant = drivingHours <= drivingLimitHours && workHours <= 13;

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View className="px-5 pt-2 pb-4">
        <TouchableOpacity onPress={() => router.back()} className="mb-3">
          <Text className="text-blue-200 text-sm">← Back to History</Text>
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">{formatDate(log.startTime)}</Text>
        <Text className="text-blue-200 text-xs mt-0.5">
          {formatTime(log.startTime)} — {formatTime(log.endTime)}
        </Text>
      </View>

      <View className="flex-1 bg-[#F0F4FF] rounded-t-3xl">
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Compliance Badge */}
          <View
            className={`rounded-2xl p-4 mb-4 ${
              isCompliant ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
            }`}
          >
            <Text
              className={`font-bold text-sm ${
                isCompliant ? "text-green-700" : "text-red-700"
              }`}
            >
              {isCompliant ? "✅ Within NZTA Limits" : "⚠️ Review Required"}
            </Text>
            <Text
              className={`text-xs mt-0.5 ${
                isCompliant ? "text-green-600" : "text-red-600"
              }`}
            >
              {isCompliant
                ? "This shift meets NZTA driving hour requirements."
                : "One or more NZTA limits were exceeded during this shift."}
            </Text>
          </View>

          {/* Rest Override Badge — shown when shift was started via emergency override */}
          {log.restOverrideFlagged && (
            <View className="rounded-2xl p-4 mb-4 bg-amber-50 border border-amber-300">
              <Text className="font-bold text-sm text-amber-800 mb-1">⚠️ Rest Requirement Not Met — Driver-Reported Unavoidable Delay</Text>
              <Text className="text-xs text-amber-700 leading-relaxed">
                This shift was started before the required 10-hour rest period was completed. The driver recorded the following reason:
              </Text>
              <View className="mt-3 bg-white rounded-xl p-3 border border-amber-200">
                <Text className="text-xs font-semibold text-[#003366] mb-1">Driver's Statement (immutable):</Text>
                <Text className="text-sm text-[#1A2B4A] leading-relaxed">{log.restOverrideNote}</Text>
              </View>
              <Text className="text-[10px] text-amber-600 mt-2">
                Land Transport Rule: Work Time and Logbooks 2007 — unavoidable delay exception
              </Text>
            </View>
          )}

          {/* Stats Grid */}
          <View className="flex-row gap-3 mb-4">
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1">Driving Time</Text>
              <Text className="text-xl font-bold text-[#003366]">
                {formatHoursMinutes(log.totalDrivingSeconds)}
              </Text>
              <Text className="text-xs text-[#9BA8C0] mt-0.5">Limit: 7h</Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1">Work Time</Text>
              <Text className="text-xl font-bold text-[#003366]">
                {formatHoursMinutes(log.totalWorkSeconds)}
              </Text>
              <Text className="text-xs text-[#9BA8C0] mt-0.5">Limit: 13h</Text>
            </View>
          </View>

          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1">Breaks Taken</Text>
              <Text className="text-xl font-bold text-[#003366]">{breaks.length}</Text>
              <Text className="text-xs text-[#9BA8C0] mt-0.5">
               {breaks.length > 0
  ? formatHoursMinutes(totalBreakSeconds) + " total"
  : "No breaks"}
              </Text>
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1">Shift Duration</Text>
              <Text className="text-xl font-bold text-[#003366]">
                {formatHoursMinutes(log.totalWorkSeconds)}
              </Text>
              <Text className="text-xs text-[#9BA8C0] mt-0.5">Start to end</Text>
            </View>
          </View>

          {/* Break Details */}
          {breaks.length > 0 && (
            <View className="bg-white rounded-2xl p-4 mb-4 border border-[#E8EEF8]">
              <Text className="text-xs font-bold text-[#003366] uppercase tracking-wide mb-3">
                Break Details
              </Text>
              {breaks.map((b, i) => (
                <View key={i} className="flex-row items-center py-2 border-b border-[#F0F4FF]">
                  <View className="w-6 h-6 rounded-full bg-amber-100 items-center justify-center mr-3">
                    <Text className="text-amber-600 text-xs font-bold">{i + 1}</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-sm text-[#0D1B2A]">
                      {formatTime(b.startTime)} — {formatTime(b.endTime)}
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-amber-600">
                    {formatHoursMinutes(b.durationSeconds)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Event Timeline */}
          <View className="bg-white rounded-2xl p-4 border border-[#E8EEF8]">
            <Text className="text-xs font-bold text-[#003366] uppercase tracking-wide mb-1">
              Event Timeline
            </Text>
            {events.map((event, i) => (
              <EventRow key={i} event={event} />
            ))}
          </View>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
