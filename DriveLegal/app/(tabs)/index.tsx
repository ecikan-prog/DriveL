import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  TextInput,
  Image,
} from "react-native";
import { Redirect, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { useShiftContext } from "@/lib/shift-context";
import { formatDuration, formatHoursMinutes, formatTime } from "@/lib/logbook-storage";
import {
  getDrivingLimitSeconds,
  getDrivingLimitHours,
  getDrivingProgressPercent,
  getWorkProgressPercent,
  getFortnightProgressPercent,
  LIMITS,
} from "@/hooks/use-nzta-compliance";

import { validateRestPeriod } from "@/lib/rest-validation";
import Svg, { Circle } from "react-native-svg";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

// Break duration constant (30 minutes)
const BREAK_DURATION_SECONDS = 30 * 60;

// NZTA cumulative work-day cap (13 hours). The continuous-driving countdown
// (7h SPS short-fares / 5.5h standard) must never show more time than is
// actually left in the driver's 13-hour work day, even immediately after a
// qualifying break resets the continuous-driving clock to zero.
const DAILY_WORK_LIMIT_SECONDS = 13 * 60 * 60;

// Circular countdown timer component
function CountdownRing({
  remainingSeconds,
  totalSeconds,
  size = 220,
  strokeWidth = 12,
  mode = "driving",
  context = "shift",
}: {
  remainingSeconds: number;
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
  mode?: "driving" | "break" | "break_complete";
  /** "shift" = mid-shift break; "rest" = inter-shift rest period */
  context?: "shift" | "rest";
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, remainingSeconds / totalSeconds));
  const strokeDashoffset = circumference * (1 - progress);

  // Determine ring color based on mode
  let ringColor = "#22C55E"; // green for driving / break complete
  if (mode === "break") {
    ringColor = "#F59E0B"; // amber/orange during break countdown
  } else if (mode === "driving" && remainingSeconds <= 1800) {
    ringColor = "#EF4444"; // red when low on driving time
  }

  // Format time display
  let timeDisplay: string;
  let topLabel: string;
  let bottomLabel: string;

  if (mode === "break") {
    // Break countdown
    if (context === "rest") {
      // Inter-shift rest: show hours:minutes counting down
      const hours = Math.floor(Math.max(0, remainingSeconds) / 3600);
      const minutes = Math.floor((Math.max(0, remainingSeconds) % 3600) / 60);
      timeDisplay = `${hours}:${minutes.toString().padStart(2, "0")}`;
      topLabel = "TIME REMAINING";
      bottomLabel = "ON REST BREAK";
    } else {
      // Mid-shift break: show minutes:seconds
      const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
      const secs = Math.max(0, remainingSeconds) % 60;
      timeDisplay = `${mins}:${secs.toString().padStart(2, "0")}`;
      topLabel = "BREAK TIME";
      bottomLabel = "REMAINING";
    }
  } else if (mode === "break_complete") {
    if (context === "rest") {
      // Rest period complete — show checkmark-style
      timeDisplay = "0:00";
      topLabel = "REST COMPLETE";
      bottomLabel = "READY TO DRIVE";
    } else {
      // Mid-shift break complete: show remaining work hours
      const hours = Math.floor(Math.max(0, remainingSeconds) / 3600);
      const minutes = Math.floor((Math.max(0, remainingSeconds) % 3600) / 60);
      timeDisplay = `${hours}:${minutes.toString().padStart(2, "0")}`;
      topLabel = "READY TO";
      bottomLabel = "RESUME DRIVING";
    }
  } else {
    // Normal driving countdown
    const hours = Math.floor(Math.max(0, remainingSeconds) / 3600);
    const minutes = Math.floor((Math.max(0, remainingSeconds) % 3600) / 60);
    timeDisplay = `${hours}:${minutes.toString().padStart(2, "0")}`;
    topLabel = "HOURS REMAINING";
    bottomLabel = "UNTIL REST BREAK";
  }

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        {/* Background ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress ring */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {/* Center text */}
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: size,
          height: size,
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10,
          elevation: 10,
        }}
      >
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase" }}>
          {topLabel}
        </Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 48,
            fontWeight: "800",
            marginVertical: 6,
            fontVariant: ["tabular-nums"],
            textShadowColor: "rgba(0,0,0,0.35)",
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }}
        >
          {timeDisplay}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "600", letterSpacing: 1.5, textTransform: "uppercase" }}>
          {bottomLabel}
        </Text>
      </View>
    </View>
  );
}

// Stats card component
function StatCard({
  icon,
  label,
  value,
  unit,
  limit,
  percent,
  isWarning,
}: {
  icon: string;
  label: string;
  value: string;
  unit: string;
  limit: string;
  percent: number;
  isWarning?: boolean;
}) {
  const barColor = percent >= 90 ? "#EF4444" : percent >= 75 ? "#F59E0B" : "#2563EB";
  const textColor = percent >= 90 ? "#EF4444" : "#0D1B2A";

  return (
    <View style={{ flex: 1, backgroundColor: "#FFFFFF", borderRadius: 16, padding: 12, marginHorizontal: 4, borderWidth: 1, borderColor: "#E8EEF8", alignItems: "center" }}>
      <Text style={{ fontSize: 16, marginBottom: 4 }}>{icon}</Text>
      <Text style={{ fontSize: 9, fontWeight: "700", color: "#6B7A99", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 28, fontWeight: "800", color: textColor, fontVariant: ["tabular-nums"] }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: "#6B7A99", marginBottom: 6 }}>{unit}</Text>
      {/* Progress bar */}
      <View style={{ width: "100%", height: 4, backgroundColor: "#E8EEF8", borderRadius: 2, overflow: "hidden" }}>
        <View style={{ width: `${Math.min(100, percent)}%`, height: "100%", backgroundColor: barColor, borderRadius: 2 }} />
      </View>
      <Text style={{ fontSize: 9, color: "#9BA8C0", marginTop: 4 }}>{limit}</Text>
    </View>
  );
}

function WarningBanner({
  title,
  message,
  level,
  onDismiss,
}: {
  title: string;
  message: string;
  level: "warning" | "critical";
  onDismiss: () => void;
}) {
  const isCritical = level === "critical";
  return (
    <View
      style={{
        borderRadius: 16,
        padding: 14,
        marginBottom: 8,
        flexDirection: "row",
        alignItems: "flex-start",
        backgroundColor: isCritical ? "#FEF2F2" : "#FFFBEB",
        borderWidth: 1,
        borderColor: isCritical ? "#FECACA" : "#FDE68A",
      }}
    >
      <Text style={{ fontSize: 18, marginRight: 10 }}>{isCritical ? "🚨" : "⚠️"}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: "700", fontSize: 13, color: isCritical ? "#B91C1C" : "#92400E", marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 11, color: isCritical ? "#DC2626" : "#D97706", lineHeight: 16 }}>
          {message}
        </Text>
      </View>
      <TouchableOpacity onPress={onDismiss} style={{ marginLeft: 8, padding: 4 }}>
        <Text style={{ color: "#9BA8C0", fontSize: 14 }}>✕</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function DashboardScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const {
    isShiftActive,
    isOnBreak,
    drivingSeconds,
    consecutiveDrivingSeconds,
    continuousWorkSeconds,
    workSeconds,
    breakSeconds,
    fortnightlyDrivingSeconds,
    compliance,
    startShift,
    endShift,
    startBreak,
    endBreak,
    activeShift,
    loading,
    subscriptionState,
    isTrialExpired,
    currentLocation,
    restValidation,
    checkRestValidation,
  } = useShiftContext();

  const [dismissedWarnings, setDismissedWarnings] = useState<Set<string>>(new Set());
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showEndBreakConfirm, setShowEndBreakConfirm] = useState(false);
  const [showStartOdometer, setShowStartOdometer] = useState(false);
  const [odometerInput, setOdometerInput] = useState("");
  const [endOdometerInput, setEndOdometerInput] = useState("");
  const [lastLogSummary, setLastLogSummary] = useState<{
    driving: string;
    work: string;
    breaks: number;
  } | null>(null);
  const [showMandatoryBreakAlert, setShowMandatoryBreakAlert] = useState(false);
  const [startShiftError, setStartShiftError] = useState<string | null>(null);
  useEffect(() => {
    if (isShiftActive) {
      setDismissedWarnings(new Set());
    }
  }, [isShiftActive]);

  // Live rest countdown: refresh restValidation every 60s while off-duty
  // Also refresh immediately when shift ends (isShiftActive flips to false)
  const restRefreshRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!isShiftActive) {
      // Refresh immediately when shift ends
      checkRestValidation();
      // Then refresh every 60 seconds so the countdown ticks
      restRefreshRef.current = setInterval(() => {
        checkRestValidation();
      }, 60_000);
    } else {
      if (restRefreshRef.current) {
        clearInterval(restRefreshRef.current);
        restRefreshRef.current = null;
      }
    }
    return () => {
      if (restRefreshRef.current) {
        clearInterval(restRefreshRef.current);
        restRefreshRef.current = null;
      }
    };
  }, [isShiftActive, checkRestValidation]);

  // ── Countdown calculation — FIXED for build 32 ─────────────────────────────
  // drivingLimitSeconds = the continuous-driving limit (7h SPS short-fares or
  // 5.5h standard). This is what a qualifying 30-min break resets.
  // dailyRemainingSeconds = what's actually left in the 13-hour cumulative
  // work day, regardless of any break reset.
  // The dashboard must show whichever is SMALLER — a break reset can never
  // grant more driving time than the driver has left in their work day.
  const driverType = (user as any)?.driverType ?? "small_passenger";
  const drivingLimitSeconds = getDrivingLimitSeconds(driverType);
  const dailyRemainingSeconds = Math.max(0, DAILY_WORK_LIMIT_SECONDS - workSeconds);
  const remainingDrivingSeconds = Math.max(
  0,
  Math.min(
    drivingLimitSeconds - continuousWorkSeconds,
    dailyRemainingSeconds
  )
);

  // Mandatory break alert — fires once when consecutive driving hits the limit
  // (also fires if the daily cap is hit first, which is the correct NZTA behaviour)
  const mandatoryBreakFiredRef = useRef(false);
  useEffect(() => {
    if (
      isShiftActive &&
      !isOnBreak &&
      remainingDrivingSeconds <= 0 &&
      !mandatoryBreakFiredRef.current
    ) {
      mandatoryBreakFiredRef.current = true;
      setShowMandatoryBreakAlert(true);
    }
    if (isOnBreak) {
      mandatoryBreakFiredRef.current = false;
      setShowMandatoryBreakAlert(false);
    }
  }, [isShiftActive, isOnBreak, remainingDrivingSeconds]);

  // FIX: removed the auto-end-break effect that used to call endBreak()
  // automatically the instant breakSeconds hit 30 minutes. That silently
  // resumed driving without the driver ever confirming they're back behind
  // the wheel — a real compliance risk, since "driving" time would start
  // accumulating on the record before the driver actually started driving
  // again. Once breakSeconds >= BREAK_DURATION_SECONDS, the ring below
  // already switches to "READY TO RESUME DRIVING" and stays there — the
  // driver must tap END BREAK themselves to resume.

  const visibleWarnings = compliance.warnings.filter(
    (w) => !dismissedWarnings.has(w.id)
  );

  const dismissWarning = (id: string) => {
    setDismissedWarnings((prev) => new Set([...prev, id]));
  };

  const handleStartShift = async () => {
    if (isTrialExpired) {
      router.push("/paywall" as any);
      return;
    }
    setStartShiftError(null);
    setShowStartOdometer(true);
  };

  const confirmStartShift = async () => {
    setStartShiftError(null);
    const odo = odometerInput.trim() ? parseInt(odometerInput.trim(), 10) : undefined;
    // startShift now returns a result — use it to show inline errors instead of
    // relying on Alert.alert (which is a no-op on web)
    const result = await startShift(isNaN(odo as number) ? undefined : odo);
    if (!result.success) {
      // Keep modal open and show error inline
      setStartShiftError(result.error ?? "Could not start shift. Please try again.");
      return;
    }
    // Success — close modal and reset
    setShowStartOdometer(false);
    setLastLogSummary(null);
    setOdometerInput("");
  };

  const handleEndShift = async () => {
    setShowEndConfirm(false);
    const odo = endOdometerInput.trim() ? parseInt(endOdometerInput.trim(), 10) : undefined;
    setEndOdometerInput("");
    const log = await endShift(isNaN(odo as number) ? undefined : odo);
    if (log) {
      setLastLogSummary({
        driving: formatHoursMinutes(log.totalDrivingSeconds),
        work: formatHoursMinutes(log.totalWorkSeconds),
        breaks: log.breaks.length,
      });
    }
  };

  // Confirmation before resuming driving. Particularly important if the
  // break hasn't reached the 30-minute qualifying mark yet — ending early
  // means the continuous-driving clock does NOT reset, so the driver should
  // consciously confirm before giving up the rest of their qualifying break.
  const handleEndBreak = async () => {
    setShowEndBreakConfirm(false);
    await endBreak();
  };

  // Stats calculations — NZTA correct limits
  // Today's work time vs 13h max work per shift
  const todayWorkHours = isShiftActive ? workSeconds / 3600 : 0;
  const todayWorkLimit = 13;
  // Fortnightly driving vs 70h CWP limit
  // fortnightlyDrivingSeconds = completed shifts in last 14 days (from storage)
  // drivingSeconds = total driving in the CURRENT active shift
  // Together they give the live fortnightly total
  const fortnightlyHours = (fortnightlyDrivingSeconds + (isShiftActive ? drivingSeconds : 0)) / 3600;
  const fortnightlyLimit = 70;

  const todayWorkPercent = (todayWorkHours / todayWorkLimit) * 100;
  const fortnightlyPercent = (fortnightlyHours / fortnightlyLimit) * 100;

  if (authLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#003366",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: "600",
          }}
        >
          Loading Drive Legal...
        </Text>
      </View>
    );
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  // ── Off-duty rest break state ────────────────────────────────────────────
  // Determine whether the driver is in a mandatory rest period between shifts.
  // Three off-duty sub-states:
  //   1. "no_shifts"     — brand new account, never started a shift → Ready to Drive
  //   2. "resting"       — last shift ended, rest period not yet complete → ON REST BREAK
  //   3. "rest_complete" — rest period elapsed → Rest Complete, Ready to Drive
  const REST_REQUIRED_SECONDS = (restValidation?.restType === "cwp_reset" ? 24 : 10) * 3600;
  const hasHadShift = restValidation !== null && restValidation.lastShiftEnd !== undefined;
  const restElapsedSeconds = hasHadShift
    ? Math.floor((Date.now() - new Date(restValidation!.lastShiftEnd!).getTime()) / 1000)
    : 0;
  const restRemainingSeconds = Math.max(0, REST_REQUIRED_SECONDS - restElapsedSeconds);
  const isRestComplete = hasHadShift && restRemainingSeconds === 0;
  const isResting = hasHadShift && restRemainingSeconds > 0;

  // Status text — 5 states total
  let statusText: string;
  let statusColor: string;
 if (isShiftActive) {
  if (isOnBreak) {
    statusText = "ON BREAK";
    statusColor = "#F59E0B";
  } else if (isOtherWork) {
    statusText = "OTHER WORK";
    statusColor = "#14B8A6";
  } else {
    statusText = "DRIVING";
    statusColor = "#22C55E";
  }

 } else if (isResting) {
    statusText = restValidation?.restType === "cwp_reset" ? "24-HR REST REQUIRED" : "ON REST BREAK";
    statusColor = "#F59E0B"; // amber
  } else if (isRestComplete) {
    statusText = "REST COMPLETE";
    statusColor = "#22C55E";
  } else {
    // No shifts yet
    statusText = "READY TO DRIVE";
    statusColor = "#22C55E";
  }

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#003366",
        }}
        contentContainerStyle={{
          flexGrow: 1,
          backgroundColor: "#003366",
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            {/* D Logo */}
            <Image
              source={require("@/assets/images/icon.png")}
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
              }}
              resizeMode="cover"
            />
            <View>
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800", letterSpacing: 1 }}>
                DRIVE <Text style={{ color: "#22C55E" }}>LEGAL</Text>
              </Text>
              <Text style={{ color: "#93C5FD", fontSize: 10, fontWeight: "600", letterSpacing: 1.5 }}>
                DRIVER LOGBOOK
              </Text>
            </View>
          </View>
          <TouchableOpacity style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.1)", alignItems: "center", justifyContent: "center" }}>
            <MaterialIcons name="notifications-none" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Dark section - Status + Countdown */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 24 }}>
          {/* NZTA Warnings */}
          {visibleWarnings.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              {visibleWarnings.map((w) => (
                <WarningBanner
                  key={w.id}
                  title={w.title}
                  message={w.message}
                  level={w.level}
                  onDismiss={() => dismissWarning(w.id)}
                />
              ))}
            </View>
          )}

          {/* Current Status Card */}
          <View style={{ backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 20, padding: 20, alignItems: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }}>
            <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 10, fontWeight: "700", letterSpacing: 2, marginBottom: 8 }}>
              CURRENT STATUS
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: statusColor }} />
              <Text style={{ color: statusColor, fontSize: 20, fontWeight: "800", letterSpacing: 1 }}>
                {statusText}
              </Text>
            </View>

            {/* Countdown Ring — 5 states */}
            {isShiftActive ? (
              isOnBreak ? (
                // ON BREAK (mid-shift): show 30-min countdown or "break complete"
                breakSeconds >= BREAK_DURATION_SECONDS ? (
                  // FIX: previously hardcoded to drivingLimitSeconds (always full 7:00).
                  // Now shows the correctly capped remainingDrivingSeconds so the
                  // "ready to resume" ring reflects the daily allowance too.
                  <CountdownRing
                    remainingSeconds={remainingDrivingSeconds}
                    totalSeconds={drivingLimitSeconds}
                    size={Platform.OS === "web" ? 200 : 220}
                    strokeWidth={12}
                    mode="break_complete"
                  />
                ) : (
                  <CountdownRing
                    remainingSeconds={BREAK_DURATION_SECONDS - breakSeconds}
                    totalSeconds={BREAK_DURATION_SECONDS}
                    size={Platform.OS === "web" ? 200 : 220}
                    strokeWidth={12}
                    mode="break"
                  />
                )
              ) : (
                // DRIVING: normal hours countdown — now correctly capped by
                // the remaining daily allowance (see remainingDrivingSeconds above)
                <CountdownRing
                  remainingSeconds={remainingDrivingSeconds}
                  totalSeconds={drivingLimitSeconds}
                  size={Platform.OS === "web" ? 200 : 220}
                  strokeWidth={12}
                  mode="driving"
                />
              )
            ) : isResting ? (
              // OFF DUTY — rest period in progress: amber ring counting down to 0
              <CountdownRing
                remainingSeconds={restRemainingSeconds}
                totalSeconds={REST_REQUIRED_SECONDS}
                size={Platform.OS === "web" ? 200 : 220}
                strokeWidth={12}
                mode="break"
                context="rest"
              />
            ) : isRestComplete ? (
              // OFF DUTY — rest complete: green ring, full
              <CountdownRing
                remainingSeconds={0}
                totalSeconds={REST_REQUIRED_SECONDS}
                size={Platform.OS === "web" ? 200 : 220}
                strokeWidth={12}
                mode="break_complete"
                context="rest"
              />
            ) : (
              // OFF DUTY — no shifts yet (brand new account): green full ring
              <CountdownRing
                remainingSeconds={drivingLimitSeconds}
                totalSeconds={drivingLimitSeconds}
                size={Platform.OS === "web" ? 200 : 220}
                strokeWidth={12}
                mode="driving"
              />
            )}

            {/* Shift Started */}
            {isShiftActive && activeShift && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}>
                <MaterialIcons name="access-time" size={16} color="#22C55E" />
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600", letterSpacing: 1 }}>
                    SHIFT STARTED
                  </Text>
                  <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "600" }}>
                    Today, {formatTime(activeShift.startTime)}
                  </Text>
                </View>
              </View>
            )}

            {/* Rest break info — shown when off-duty and resting */}
            {!isShiftActive && isResting && restValidation?.lastShiftEnd && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}>
                <MaterialIcons name="hotel" size={16} color="#F59E0B" />
                <View>
                  <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, fontWeight: "600", letterSpacing: 1 }}>
                    {restValidation.restType === "cwp_reset" ? "24-HR CWP REST STARTED" : "10-HR REST STARTED"}
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.8)", fontSize: 13, fontWeight: "600" }}>
                    {new Date(restValidation.lastShiftEnd).toLocaleTimeString("en-NZ", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </Text>
                </View>
              </View>
            )}

            {/* Rest complete info */}
            {!isShiftActive && isRestComplete && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 16 }}>
                <MaterialIcons name="check-circle" size={16} color="#22C55E" />
                <Text style={{ color: "#22C55E", fontSize: 13, fontWeight: "700" }}>Ready to start your next shift</Text>
              </View>
            )}

            {/* Location */}
            {isShiftActive && currentLocation && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>📍</Text>
                <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{currentLocation.displayName}</Text>
              </View>
            )}
          </View>
        </View>

        {/* White section - Stats + Actions */}
        <View style={{ flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32 }}>
          {/* Shift Summary after ending */}
          {lastLogSummary && !isShiftActive && (
            <View style={{ backgroundColor: "#F0FDF4", borderWidth: 1, borderColor: "#BBF7D0", borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: "#15803D", fontWeight: "700", fontSize: 14, marginBottom: 8 }}>✅ Shift Completed</Text>
              <View style={{ flexDirection: "row", gap: 16 }}>
                <View>
                  <Text style={{ fontSize: 11, color: "#16A34A" }}>Driving</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#15803D" }}>{lastLogSummary.driving}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: "#16A34A" }}>Work Time</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#15803D" }}>{lastLogSummary.work}</Text>
                </View>
                <View>
                  <Text style={{ fontSize: 11, color: "#16A34A" }}>Breaks</Text>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#15803D" }}>{lastLogSummary.breaks}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Stats Row */}
          <View style={{ flexDirection: "row", marginBottom: 16, marginHorizontal: -4 }}>
            <StatCard
              icon="⏱"
              label="TODAY WORK"
              value={todayWorkHours.toFixed(1)}
              unit="hrs"
              limit="/ 13 HRS"
              percent={todayWorkPercent}
            />
            <StatCard
              icon="📅"
              label="FORTNIGHTLY"
              value={fortnightlyHours.toFixed(0)}
              unit="hrs"
              limit="/ 70 HRS"
              percent={fortnightlyPercent}
              isWarning={fortnightlyPercent >= 80}
            />
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 12 }}>
            {!isShiftActive ? (
              <TouchableOpacity
                style={{ backgroundColor: "#003366", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                onPress={handleStartShift}
                disabled={loading}
                activeOpacity={0.8}
              >
                <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>START SHIFT</Text>
              </TouchableOpacity>
            ) : (
              <>
                {!isOnBreak ? (
                  <TouchableOpacity
                    style={{ backgroundColor: "#F59E0B", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                    onPress={startBreak}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="free-breakfast" size={20} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>START BREAK</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                    onPress={() => setShowEndBreakConfirm(true)}
                    activeOpacity={0.8}
                  >
                    <MaterialIcons name="play-arrow" size={20} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>END BREAK</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{ backgroundColor: "#B91C1C", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
                  onPress={() => setShowEndConfirm(true)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="stop" size={20} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 15 }}>END SHIFT</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Start Shift Odometer Modal */}
      <Modal
        visible={showStartOdometer}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStartOdometer(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>Start Shift</Text>
            <Text style={{ fontSize: 13, color: "#6B7A99", marginBottom: 16 }}>
              Enter your odometer reading (optional, for RUC-liable vehicles).
            </Text>
            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>ODOMETER (km)</Text>
              <TextInput
                style={{ fontSize: 18, fontWeight: "700", color: "#003366", paddingVertical: 8 }}
                placeholder="e.g. 125430"
                placeholderTextColor="#9BA8C0"
                keyboardType="numeric"
                value={odometerInput}
                onChangeText={setOdometerInput}
                returnKeyType="done"
              />
            </View>
            <Text style={{ fontSize: 11, color: "#9BA8C0", marginBottom: 16 }}>📍 GPS location will be captured automatically.</Text>
            {/* Inline error for rest validation or trial expiry — replaces Alert.alert which is a no-op on web */}
            {startShiftError && (
              <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "600", lineHeight: 18 }}>{startShiftError}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setShowStartOdometer(false); setOdometerInput(""); setStartShiftError(null); }}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#003366", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={confirmStartShift}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Start</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Shift Confirmation Modal */}
      <Modal
        visible={showEndConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>End Shift</Text>
            <Text style={{ fontSize: 13, color: "#6B7A99", marginBottom: 8 }}>
              Current session:
            </Text>
            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16, gap: 4 }}>
              <Text style={{ fontSize: 13, color: "#0D1B2A" }}>
                Driving: <Text style={{ fontWeight: "700" }}>{formatDuration(drivingSeconds)}</Text>
              </Text>
              <Text style={{ fontSize: 13, color: "#0D1B2A" }}>
                Work time: <Text style={{ fontWeight: "700" }}>{formatDuration(workSeconds)}</Text>
              </Text>
            </View>
            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>END ODOMETER (km)</Text>
              <TextInput
                style={{ fontSize: 18, fontWeight: "700", color: "#003366", paddingVertical: 8 }}
                placeholder="e.g. 125580"
                placeholderTextColor="#9BA8C0"
                keyboardType="numeric"
                value={endOdometerInput}
                onChangeText={setEndOdometerInput}
                returnKeyType="done"
              />
            </View>
            <Text style={{ fontSize: 11, color: "#9BA8C0", marginBottom: 16 }}>📍 GPS location will be captured automatically.</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => setShowEndConfirm(false)}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#B91C1C", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={handleEndShift}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>End Shift</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Break Confirmation Modal */}
      <Modal
        visible={showEndBreakConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEndBreakConfirm(false)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>End Break?</Text>

            {breakSeconds >= BREAK_DURATION_SECONDS ? (
              <Text style={{ fontSize: 13, color: "#6B7A99", marginBottom: 16, lineHeight: 19 }}>
                Your break has met the 30-minute qualifying rest period. Ending it now will resume driving.
              </Text>
            ) : (
              // Prominent warning — matches the WarningBanner style used elsewhere
              // so an early end reads with the same visual weight as an NZTA warning.
              <View
                style={{
                  borderRadius: 14,
                  padding: 14,
                  marginBottom: 16,
                  flexDirection: "row",
                  alignItems: "flex-start",
                  backgroundColor: "#FFFBEB",
                  borderWidth: 1,
                  borderColor: "#FDE68A",
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 10 }}>⚠️</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "700", fontSize: 13, color: "#92400E", marginBottom: 4 }}>
                    Break Not Yet Qualifying
                  </Text>
                  <Text style={{ fontSize: 12, color: "#D97706", lineHeight: 17 }}>
                    You need{" "}
                    <Text style={{ fontWeight: "700" }}>
                      {formatDuration(Math.max(0, BREAK_DURATION_SECONDS - breakSeconds))}
                    </Text>{" "}
                    more to reach the 30-minute qualifying rest period. Ending now resumes driving,
                    but your continuous-driving countdown will NOT reset.
                  </Text>
                </View>
              </View>
            )}

            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>BREAK TIME SO FAR</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#003366" }}>{formatDuration(breakSeconds)}</Text>
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => setShowEndBreakConfirm(false)}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>
                  {breakSeconds >= BREAK_DURATION_SECONDS ? "Cancel" : "Keep Resting"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: breakSeconds >= BREAK_DURATION_SECONDS ? "#2563EB" : "#D97706",
                  borderRadius: 12,
                  paddingVertical: 14,
                  alignItems: "center",
                }}
                onPress={handleEndBreak}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>
                  {breakSeconds >= BREAK_DURATION_SECONDS ? "End Break" : "End Early Anyway"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Mandatory Break Alert — non-dismissible, NZTA compliant */}
      <Modal
        visible={showMandatoryBreakAlert}
        transparent
        animationType="fade"
        onRequestClose={() => {}} // Prevent back-button dismiss
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.7)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>🚨</Text>
            <Text style={{ fontSize: 20, fontWeight: "800", color: "#B91C1C", textAlign: "center", marginBottom: 8 }}>
              MANDATORY BREAK REQUIRED
            </Text>
            <Text style={{ fontSize: 14, color: "#374151", textAlign: "center", lineHeight: 22, marginBottom: 20 }}>
              You have reached the maximum continuous driving limit under the NZTA Work Time &amp; Logbooks Rule.{"\n\n"}
              You must take a <Text style={{ fontWeight: "700" }}>30-minute rest break</Text> before continuing to drive.
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 16, alignItems: "center" }}
              onPress={startBreak}
              activeOpacity={0.8}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>☕ START BREAK NOW</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
