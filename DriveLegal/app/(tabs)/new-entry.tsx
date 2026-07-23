import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { useShiftContext } from "@/lib/shift-context";
import { formatDuration, formatTime } from "@/lib/logbook-storage";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

export default function NewEntryScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const {
    isShiftActive,
    isOnBreak,
    isOtherWork,
    drivingSeconds,
    workSeconds,
    startShift,
    endShift,
    startBreak,
    endBreak,
    startOtherWork,
    endOtherWork,
    changeVehicle,
    activeShift,
    loading,
    isTrialExpired,
    currentLocation,
    restValidation,
    checkRestValidation,
  } = useShiftContext();

  const [showStartOdometer, setShowStartOdometer] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [showVehicleChange, setShowVehicleChange] = useState(false);
  const [showRestOverride, setShowRestOverride] = useState(false);
  const [odometerInput, setOdometerInput] = useState("");
  const [endOdometerInput, setEndOdometerInput] = useState("");
  const [vehicleRegoInput, setVehicleRegoInput] = useState("");
  const [vehicleOdometerInput, setVehicleOdometerInput] = useState("");
  const [restOverrideNote, setRestOverrideNote] = useState("");
  const [restOverrideError, setRestOverrideError] = useState<string | null>(null);
  const [pendingRestTitle, setPendingRestTitle] = useState("");
  const [pendingRestMsg, setPendingRestMsg] = useState("");
  const [startShiftError, setStartShiftError] = useState<string | null>(null);
  const [vehicleChangeError, setVehicleChangeError] = useState<string | null>(null);
  const [vehicleChangeSuccess, setVehicleChangeSuccess] = useState<string | null>(null);

  const handleStartShift = async () => {
    if (isTrialExpired) {
      router.push("/paywall" as any);
      return;
    }
    // Check rest period before showing odometer modal
    const restCheck = await checkRestValidation();
    if (!restCheck.canStartShift) {
      const title = restCheck.restType === "cwp_reset" ? "24-Hour Rest Required" : "10-Hour Rest Required";
      const msg = restCheck.reason || "You must rest before starting a new shift.";
      // For 24-hour CWP reset, no override is permitted — hard block
      if (restCheck.restType === "cwp_reset") {
        if (Platform.OS !== "web") {
          const { Alert } = require("react-native");
          Alert.alert(title, msg + "\n\nThis rest requirement cannot be overridden.");
        } else {
          setStartShiftError(`${title}: ${msg}`);
          setShowStartOdometer(true);
        }
        return;
      }
      // For 10-hour rest, show the override modal
      setPendingRestTitle(title);
      setPendingRestMsg(msg);
      setShowRestOverride(true);
      return;
    }
    setStartShiftError(null);
    setShowStartOdometer(true);
  };

  const handleRestOverrideSubmit = () => {
    const note = restOverrideNote.trim();
    if (note.length < 10) {
      setRestOverrideError("Please describe the emergency or unavoidable delay (minimum 10 characters).");
      return;
    }
    setRestOverrideError(null);
    setShowRestOverride(false);
    // Proceed to odometer modal, carrying the override note
    setStartShiftError(null);
    setShowStartOdometer(true);
  };

  const confirmStartShift = async () => {
    setStartShiftError(null);
    const odo = odometerInput.trim() ? parseInt(odometerInput.trim(), 10) : undefined;
    // Pass override note if one was entered (may be empty string for normal starts)
    const overrideNote = restOverrideNote.trim() || undefined;
    const result = await startShift(isNaN(odo as number) ? undefined : odo, overrideNote);
    if (!result.success) {
      setStartShiftError(result.error ?? "Could not start shift. Please try again.");
      return;
    }
    setShowStartOdometer(false);
    setOdometerInput("");
    setRestOverrideNote("");
  };

  const handleEndShift = async () => {
    setShowEndConfirm(false);
    const odo = endOdometerInput.trim() ? parseInt(endOdometerInput.trim(), 10) : undefined;
    setEndOdometerInput("");
    await endShift(isNaN(odo as number) ? undefined : odo);
  };

  const handleVehicleChange = async () => {
    const rego = vehicleRegoInput.trim().toUpperCase();
    const odo = parseInt(vehicleOdometerInput.trim(), 10);
    if (!rego) {
      setVehicleChangeError("Please enter the new vehicle registration.");
      return;
    }
    if (isNaN(odo)) {
      setVehicleChangeError("Please enter the odometer reading for the new vehicle.");
      return;
    }
    setVehicleChangeError(null);
    setShowVehicleChange(false);
    await changeVehicle(rego, odo);
    setVehicleRegoInput("");
    setVehicleOdometerInput("");
    setVehicleChangeSuccess(`Vehicle changed: now driving ${rego} (odo: ${odo} km)`);
    setTimeout(() => setVehicleChangeSuccess(null), 4000);
  };

  if (!user) return null;

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>New Entry</Text>
        <Text style={{ color: "#93C5FD", fontSize: 12, marginTop: 4 }}>Record shift events</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 }}>
        {/* Current Status */}
        {/* Active mode banner */}
{isShiftActive && (
  <View
    style={{
      backgroundColor: isOnBreak
        ? "#9A6700"
        : isOtherWork
          ? "#0E7490"
          : "#12386E",
      borderRadius: 16,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 12,
      alignItems: "center",
    }}
  >
    <Text
      style={{
        color: "#C9D8F0",
        fontSize: 11,
        fontWeight: "800",
        letterSpacing: 1.8,
      }}
    >
      CURRENT STATUS
    </Text>

    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: 6,
      }}
    >
      <MaterialIcons
        name={
          isOnBreak
            ? "free-breakfast"
            : isOtherWork
              ? "build"
              : "directions-car"
        }
        size={24}
        color="#FFFFFF"
      />

      <Text
        style={{
          color: "#FFFFFF",
          fontSize: 23,
          fontWeight: "900",
          marginLeft: 8,
        }}
      >
        {isOnBreak
          ? "ON BREAK"
          : isOtherWork
            ? "OTHER WORK"
            : "DRIVING"}
      </Text>
    </View>

    <Text
      style={{
        color: "#E5EDF8",
        fontSize: 12,
        lineHeight: 17,
        marginTop: 6,
        textAlign: "center",
      }}
    >
      {isOnBreak
        ? "Driving and total work time are paused"
        : isOtherWork
          ? "Driving paused • Total work time continues"
          : "Driving and total work time are running"}
    </Text>
  </View>
)}
        {isShiftActive && activeShift && (
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "600", letterSpacing: 1, marginBottom: 8 }}>ACTIVE SHIFT</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 11, color: "#6B7A99" }}>Started</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatTime(activeShift.startTime)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 11, color: "#6B7A99" }}>Driving</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatDuration(drivingSeconds)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 11, color: "#6B7A99" }}>Work</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatDuration(workSeconds)}</Text>
              </View>
            </View>
            {currentLocation && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                <Text style={{ fontSize: 11, color: "#6B7A99" }}>📍 {currentLocation.displayName}</Text>
              </View>
            )}
            {/* Show vehicle changes count */}
            {activeShift.vehicleChanges && activeShift.vehicleChanges.length > 0 && (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: "#5980E9" }}>
                  🚗 Current: {activeShift.vehicleChanges[activeShift.vehicleChanges.length - 1].registration} ({activeShift.vehicleChanges.length} change{activeShift.vehicleChanges.length > 1 ? "s" : ""})
                </Text>
              </View>
            )}
            {/* Show rest override badge if this shift was started via override */}
            {activeShift.restOverrideNote && (
              <View style={{ marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: "#FEF3C7", borderRadius: 8, borderWidth: 1, borderColor: "#FCD34D" }}>
                <Text style={{ fontSize: 11, color: "#92400E", fontWeight: "700" }}>⚠️ Rest Override Active</Text>
                <Text style={{ fontSize: 10, color: "#78350F", marginTop: 2 }} numberOfLines={2}>{activeShift.restOverrideNote}</Text>
              </View>
            )}
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ gap: 12 }}>
          {!isShiftActive ? (
            <TouchableOpacity
              style={{ backgroundColor: "#003366", borderRadius: 16, paddingVertical: 20, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
              onPress={handleStartShift}
              disabled={loading}
              activeOpacity={0.8}
            >
              <MaterialIcons name="play-arrow" size={24} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 18 }}>START SHIFT</Text>
            </TouchableOpacity>
          ) : (
            <>
              {/* Break controls */}
              {!isOnBreak && !isOtherWork ? (
                <TouchableOpacity
                  style={{ backgroundColor: "#F59E0B", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                  onPress={startBreak}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="free-breakfast" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>START BREAK</Text>
                </TouchableOpacity>
              ) : isOnBreak ? (
                <TouchableOpacity
                  style={{ backgroundColor: "#2563EB", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                  onPress={endBreak}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="play-arrow" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>END BREAK</Text>
                </TouchableOpacity>
              ) : null}

              {/* Other Work controls */}
              {!isOnBreak && !isOtherWork ? (
                <TouchableOpacity
                  style={{ backgroundColor: "#5980E9", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                  onPress={() => startOtherWork()}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="build" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>OTHER WORK</Text>
                </TouchableOpacity>
              ) : isOtherWork ? (
                <TouchableOpacity
                  style={{ backgroundColor: "#003366", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                  onPress={endOtherWork}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="directions-car" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>RESUME DRIVING</Text>
                </TouchableOpacity>
              ) : null}

              {/* Change Vehicle — NZTA requirement */}
              {!isOnBreak && !isOtherWork && (
                <TouchableOpacity
                  style={{ backgroundColor: "#0E7490", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                  onPress={() => setShowVehicleChange(true)}
                  activeOpacity={0.8}
                >
                  <MaterialIcons name="swap-horiz" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>CHANGE VEHICLE</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={{ backgroundColor: "#B91C1C", borderRadius: 16, paddingVertical: 18, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 }}
                onPress={() => setShowEndConfirm(true)}
                activeOpacity={0.8}
              >
                <MaterialIcons name="stop" size={22} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>END SHIFT</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Vehicle Change Success Banner */}
        {vehicleChangeSuccess && (
          <View style={{ marginTop: 12, padding: 14, backgroundColor: "#F0FDF4", borderRadius: 14, borderWidth: 1, borderColor: "#BBF7D0" }}>
            <Text style={{ fontSize: 13, color: "#15803D", fontWeight: "600" }}>✅ {vehicleChangeSuccess}</Text>
          </View>
        )}

        {/* Rest Period Warning */}
        {!isShiftActive && restValidation && !restValidation.canStartShift && (
          <View style={{ marginTop: 16, padding: 16, backgroundColor: "#FEF2F2", borderRadius: 16, borderWidth: 1, borderColor: "#FECACA" }}>
            <Text style={{ fontSize: 13, color: "#991B1B", fontWeight: "700", marginBottom: 4 }}>
              {restValidation.restType === "cwp_reset" ? "⚠️ 24-Hour Rest Required" : "⚠️ 10-Hour Rest Required"}
            </Text>
            <Text style={{ fontSize: 12, color: "#B91C1C", lineHeight: 18 }}>
              {restValidation.reason}
            </Text>
            {restValidation.restType !== "cwp_reset" && (
              <Text style={{ fontSize: 11, color: "#7F1D1D", marginTop: 6, lineHeight: 16 }}>
                In a genuine emergency or unavoidable delay, you may override this requirement. Tap "START SHIFT" to record the reason.
              </Text>
            )}
          </View>
        )}

        {/* Info */}
        {!isShiftActive && (!restValidation || restValidation.canStartShift) && (
          <View style={{ marginTop: 24, padding: 16, backgroundColor: "#EFF6FF", borderRadius: 16, borderWidth: 1, borderColor: "#BFDBFE" }}>
            <Text style={{ fontSize: 13, color: "#1E40AF", fontWeight: "600", marginBottom: 4 }}>💡 Quick Tip</Text>
            <Text style={{ fontSize: 12, color: "#3B82F6", lineHeight: 18 }}>
              Start a shift to begin recording your driving time, breaks, GPS location, and odometer. All data is stored securely on your device.
            </Text>
          </View>
        )}
      </View>

      {/* ─── Rest Override Modal ─────────────────────────────────────────────── */}
      <Modal visible={showRestOverride} transparent animationType="fade" onRequestClose={() => setShowRestOverride(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)" }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 24, paddingVertical: 40 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 380 }}>
            {/* Warning header */}
            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#FECACA" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: "#991B1B", marginBottom: 4 }}>⚠️ {pendingRestTitle}</Text>
              <Text style={{ fontSize: 12, color: "#B91C1C", lineHeight: 18 }}>{pendingRestMsg}</Text>
            </View>

            <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366", marginBottom: 6 }}>
              Override — Unavoidable Delay or Emergency
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7A99", lineHeight: 18, marginBottom: 14 }}>
              Under the Land Transport Rule: Work Time and Logbooks 2007, you may continue driving in an unavoidable delay or emergency. This override will be permanently recorded in your logbook and visible to enforcement officers.
            </Text>

            {/* Mandatory reason text field */}
            <View style={{ backgroundColor: "#FFF7ED", borderRadius: 12, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: "#FED7AA" }}>
              <Text style={{ fontSize: 10, color: "#92400E", marginBottom: 6, fontWeight: "700", letterSpacing: 0.5 }}>
                DESCRIBE THE UNAVOIDABLE DELAY OR EMERGENCY *
              </Text>
              <TextInput
                style={{ fontSize: 14, color: "#003366", minHeight: 72, textAlignVertical: "top", lineHeight: 20 }}
                placeholder="e.g. Vehicle breakdown on remote road, no relief driver available for 3 hours..."
                placeholderTextColor="#C4A882"
                multiline
                value={restOverrideNote}
                onChangeText={setRestOverrideNote}
                returnKeyType="default"
                maxLength={500}
              />
              <Text style={{ fontSize: 10, color: "#92400E", marginTop: 4, textAlign: "right" }}>{restOverrideNote.trim().length}/500</Text>
            </View>
            {restOverrideError && (
              <Text style={{ fontSize: 12, color: "#B91C1C", marginBottom: 10, fontWeight: "600" }}>{restOverrideError}</Text>
            )}

            <Text style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 16, marginBottom: 16 }}>
              This record is immutable — it cannot be edited or deleted after the shift starts.
            </Text>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => {
                  setShowRestOverride(false);
                  setRestOverrideNote("");
                  setRestOverrideError(null);
                }}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#B45309", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={handleRestOverrideSubmit}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Override & Continue</Text>
              </TouchableOpacity>
            </View>
          </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* ─── Start Shift Odometer Modal ──────────────────────────────────────── */}
      <Modal visible={showStartOdometer} transparent animationType="fade" onRequestClose={() => setShowStartOdometer(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>Start Shift</Text>
            {/* Show override notice if this is an override start */}
            {restOverrideNote.trim().length > 0 && (
              <View style={{ backgroundColor: "#FEF3C7", borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: "#FCD34D" }}>
                <Text style={{ fontSize: 11, color: "#92400E", fontWeight: "700" }}>⚠️ Override recorded</Text>
                <Text style={{ fontSize: 11, color: "#78350F", marginTop: 2 }} numberOfLines={2}>{restOverrideNote.trim()}</Text>
              </View>
            )}
            <Text style={{ fontSize: 13, color: "#6B7A99", marginBottom: 16 }}>Enter your odometer reading (optional).</Text>
            {startShiftError && (
              <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 12, marginBottom: 12 }}>
                <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "600", lineHeight: 18 }}>{startShiftError}</Text>
              </View>
            )}
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
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => {
                  setShowStartOdometer(false);
                  setOdometerInput("");
                  setStartShiftError(null);
                  setRestOverrideNote("");
                }}
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

      {/* ─── End Shift Modal ─────────────────────────────────────────────────── */}
      <Modal visible={showEndConfirm} transparent animationType="fade" onRequestClose={() => setShowEndConfirm(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>End Shift</Text>
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

      {/* ─── Change Vehicle Modal ─────────────────────────────────────────────── */}
      <Modal visible={showVehicleChange} transparent animationType="fade" onRequestClose={() => setShowVehicleChange(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 4 }}>Change Vehicle</Text>
            <Text style={{ fontSize: 12, color: "#6B7A99", marginBottom: 16 }}>
              NZTA requires recording new vehicle registration and odometer when changing vehicles mid-shift.
            </Text>
            {vehicleChangeError && (
              <View style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 10, padding: 10, marginBottom: 10 }}>
                <Text style={{ color: "#B91C1C", fontSize: 12, fontWeight: "600" }}>{vehicleChangeError}</Text>
              </View>
            )}

            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>NEW VEHICLE REGISTRATION *</Text>
              <TextInput
                style={{ fontSize: 18, fontWeight: "700", color: "#003366", paddingVertical: 8 }}
                placeholder="e.g. ABC123"
                placeholderTextColor="#9BA8C0"
                autoCapitalize="characters"
                value={vehicleRegoInput}
                onChangeText={setVehicleRegoInput}
                returnKeyType="next"
              />
            </View>

            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>ODOMETER READING (km) *</Text>
              <TextInput
                style={{ fontSize: 18, fontWeight: "700", color: "#003366", paddingVertical: 8 }}
                placeholder="e.g. 45230"
                placeholderTextColor="#9BA8C0"
                keyboardType="numeric"
                value={vehicleOdometerInput}
                onChangeText={setVehicleOdometerInput}
                returnKeyType="done"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setShowVehicleChange(false); setVehicleRegoInput(""); setVehicleOdometerInput(""); }}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#0E7490", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={handleVehicleChange}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
