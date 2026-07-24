/**
 * Shift Detail Screen — NZTA Spec 3.1.21
 * Shows full shift details, amendment history (asterisk entries),
 * and allows editing ONLY via the formal amendment process.
 * Completed shifts (endTime set) are LOCKED — read-only by default.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getAllLogs,
  formatDate,
  formatTime,
  formatHoursMinutes,
  type DailyLog,
} from "@/lib/logbook-storage";
import { amendLogEntry, isAmended, getAmendments } from "@/lib/amendments";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

/**
 * Determine if a shift is locked (completed).
 * A shift is locked once it has an endTime — no direct edits allowed,
 * only formal amendments with mandatory reason field.
 */
function isShiftLocked(log: DailyLog): boolean {
  return !!log.endTime;
}

export default function ShiftDetailScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const params = useLocalSearchParams<{ logId: string }>();
  const [log, setLog] = useState<DailyLog | null>(null);
  const [showAmendModal, setShowAmendModal] = useState(false);
  const [amendField, setAmendField] = useState("");
  const [amendValue, setAmendValue] = useState("");
  const [amendReason, setAmendReason] = useState("");

  useEffect(() => {
    if (!user || !params.logId) return;
    getAllLogs(user.id).then((logs) => {
      const found = logs.find(
  (l) => String(l.id) === String(params.logId)
);
      if (found) setLog(found);
    });
  }, [user, params.logId]);

  const handleAmend = async () => {
    if (!user || !log) return;
    if (!amendReason.trim()) {
      Alert.alert("Reason Required", "NZTA requires a reason for all amendments.");
      return;
    }
    if (!amendValue.trim()) {
      Alert.alert("Value Required", "Please enter the new value.");
      return;
    }

    const updated = await amendLogEntry(
      user.id,
      log.id,
      amendField,
      amendValue.trim(),
      amendReason.trim()
    );

    if (updated) {
      setLog(updated);
      setShowAmendModal(false);
      setAmendField("");
      setAmendValue("");
      setAmendReason("");
      Alert.alert("Amendment Recorded", "Change has been logged with audit trail.");
    }
  };

  const openAmendModal = (field: string) => {
    if (!log) return;
    if (!isShiftLocked(log)) {
      // Shift still in progress — shouldn't normally reach here
      Alert.alert("Shift In Progress", "End the shift before making amendments.");
      return;
    }
    setAmendField(field);
    setAmendValue("");
    setAmendReason("");
    setShowAmendModal(true);
  };

  if (!log) {
    return (
      <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#93C5FD" }}>Loading...</Text>
        </View>
      </ScreenContainer>
    );
  }

  const amendments = getAmendments(log);
  const amended = isAmended(log);
  const locked = isShiftLocked(log);

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16, flexDirection: "row", alignItems: "center" }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800" }}>
              Shift Detail
            </Text>
            {amended && (
              <Text style={{ color: "#D97706", fontSize: 20, fontWeight: "800", marginLeft: 6 }}>*</Text>
            )}
            {locked && (
              <View style={{ marginLeft: 8, backgroundColor: "#1E3A5F", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: "#93C5FD", fontSize: 10, fontWeight: "700" }}>🔒 LOCKED</Text>
              </View>
            )}
          </View>
          <Text style={{ color: "#93C5FD", fontSize: 12, marginTop: 2 }}>
            {formatDate(log.startTime)}
          </Text>
        </View>
      </View>

      <View style={{ flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Lock Notice Banner */}
          {locked && (
            <View style={{ backgroundColor: "#EFF6FF", borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: "#BFDBFE", flexDirection: "row", alignItems: "flex-start" }}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔒</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#1E40AF", marginBottom: 4 }}>
                  Record Locked
                </Text>
                <Text style={{ fontSize: 11, color: "#1E3A8A", lineHeight: 16 }}>
                  This shift record is locked and cannot be directly edited. Per NZTA regulations, changes must be made through the formal amendment process with a mandatory reason.
                </Text>
              </View>
            </View>
          )}

          {/* Shift Summary */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>SHIFT SUMMARY</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
              <View>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Start</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatTime(log.startTime)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>End</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatTime(log.endTime)}</Text>
              </View>
              <View>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Driving</Text>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{formatHoursMinutes(log.totalDrivingSeconds)}</Text>
              </View>
            </View>
          </View>

          {/* Odometer — Amendment-only editing for locked shifts */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1 }}>ODOMETER</Text>
              {locked && (
                <Text style={{ fontSize: 9, color: "#9BA8C0", fontStyle: "italic" }}>Tap to amend</Text>
              )}
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <TouchableOpacity
                onPress={() => openAmendModal("startOdometer")}
                style={{ flex: 1, opacity: locked ? 1 : 0.5 }}
                disabled={!locked}
              >
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Start</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#003366" }}>
                    {log.startOdometer != null ? `${log.startOdometer} km` : "—"}
                  </Text>
                  {locked && (
                    <MaterialIcons name="edit" size={14} color="#D97706" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => openAmendModal("endOdometer")}
                style={{ flex: 1, opacity: locked ? 1 : 0.5 }}
                disabled={!locked}
              >
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>End</Text>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={{ fontSize: 16, fontWeight: "700", color: "#003366" }}>
                    {log.endOdometer != null ? `${log.endOdometer} km` : "—"}
                  </Text>
                  {locked && (
                    <MaterialIcons name="edit" size={14} color="#D97706" style={{ marginLeft: 4 }} />
                  )}
                </View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Distance</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: "#003366" }}>
                  {log.distanceKm != null ? `${log.distanceKm} km` : "—"}
                </Text>
              </View>
            </View>
          </View>

          {/* Location */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>LOCATION</Text>
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99" }}>Start</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#003366" }}>
                {log.startLocation?.displayName || "—"}
              </Text>
            </View>
            <View>
              <Text style={{ fontSize: 10, color: "#6B7A99" }}>End</Text>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#003366" }}>
                {log.endLocation?.displayName || "—"}
              </Text>
            </View>
          </View>

          {/* Vehicle Changes — NZTA requirement */}
          {log.vehicleChanges && log.vehicleChanges.length > 0 && (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
              <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>VEHICLE CHANGES</Text>
              {log.vehicleChanges.map((vc, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: i < (log.vehicleChanges?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: "#F0F4FF" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366", width: 50 }}>
                    {formatTime(vc.timestamp)}
                  </Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: "700", color: "#0E7490" }}>
                      🚗 {vc.registration}
                    </Text>
                    <Text style={{ fontSize: 10, color: "#6B7A99" }}>
                      Odometer: {vc.odometer} km
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Events Timeline */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>EVENTS</Text>
            {(log.events ?? []).map((event, i) => {
              const typeLabels: Record<string, string> = {
                shift_start: "🟢 Shift Start",
                shift_end: "🔴 Shift End",
                break_start: "☕ Break Start",
                break_end: "▶️ Break End",
                other_work_start: "📋 Other Work Start",
                other_work_end: "📋 Other Work End",
              };
              return (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: i < (log.events?.length ?? 0) - 1 ? 1 : 0, borderBottomColor: "#F0F4FF" }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: "#003366", width: 50 }}>
                    {formatTime(event.timestamp)}
                  </Text>
                  <Text style={{ fontSize: 12, color: "#4A5568", flex: 1 }}>
                    {typeLabels[event.type] || event.type}
                  </Text>
                  {event.location?.displayName && (
                    <Text style={{ fontSize: 10, color: "#6B7A99", maxWidth: 100 }} numberOfLines={1}>
                      📍 {event.location.displayName}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Amendment History — NZTA Spec 3.1.21 */}
          {amended && (
            <View style={{ backgroundColor: "#FFFBEB", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#FEF3C7" }}>
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ fontSize: 18, fontWeight: "800", color: "#D97706", marginRight: 6 }}>*</Text>
                <Text style={{ fontSize: 11, color: "#92400E", fontWeight: "700", letterSpacing: 1 }}>AMENDMENT HISTORY</Text>
              </View>
              {amendments.map((amend, i) => (
                <View key={i} style={{ paddingVertical: 8, borderBottomWidth: i < amendments.length - 1 ? 1 : 0, borderBottomColor: "#FDE68A" }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: "700", color: "#92400E" }}>{amend.field}</Text>
                    <Text style={{ fontSize: 10, color: "#B45309" }}>
                      {new Date(amend.timestamp).toLocaleDateString("en-NZ")} {formatTime(amend.timestamp)}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 11, color: "#78350F" }}>
                    Changed from "{amend.oldValue}" to "{amend.newValue}"
                  </Text>
                  <Text style={{ fontSize: 11, color: "#92400E", fontStyle: "italic", marginTop: 2 }}>
                    Reason: {amend.reason}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Amend Button — only shown for locked shifts */}
          {locked && (
            <View style={{ marginTop: 8, marginBottom: 16 }}>
              <TouchableOpacity
                style={{
                  backgroundColor: "#D97706",
                  borderRadius: 14,
                  paddingVertical: 14,
                  alignItems: "center",
                  flexDirection: "row",
                  justifyContent: "center",
                  gap: 8,
                }}
                onPress={() => openAmendModal("startOdometer")}
              >
                <Text style={{ color: "#FFFFFF", fontSize: 16 }}>*</Text>
                <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 14 }}>
                  Request Amendment
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 10, color: "#6B7A99", textAlign: "center", marginTop: 8 }}>
                NZTA Spec 3.1.21 — All changes require a reason and are permanently recorded
              </Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Amendment Modal */}
      <Modal visible={showAmendModal} transparent animationType="fade" onRequestClose={() => setShowAmendModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: "800", color: "#D97706", marginRight: 6 }}>*</Text>
              <Text style={{ fontSize: 18, fontWeight: "700", color: "#003366" }}>Amend Entry</Text>
            </View>
            <Text style={{ fontSize: 12, color: "#6B7A99", marginBottom: 16 }}>
              NZTA Spec 3.1.21: All amendments are recorded with timestamp and reason. This record is locked — only formal amendments are permitted.
            </Text>

            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>FIELD</Text>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>{amendField}</Text>
            </View>

            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>NEW VALUE</Text>
              <TextInput
                style={{ fontSize: 14, fontWeight: "700", color: "#003366", paddingVertical: 4 }}
                placeholder="Enter new value"
                placeholderTextColor="#9BA8C0"
                value={amendValue}
                onChangeText={setAmendValue}
                keyboardType={amendField.includes("Odometer") ? "numeric" : "default"}
                returnKeyType="next"
              />
            </View>

            <View style={{ backgroundColor: "#FEF3C7", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#92400E", marginBottom: 4, fontWeight: "600" }}>REASON FOR AMENDMENT *</Text>
              <TextInput
                style={{ fontSize: 14, fontWeight: "600", color: "#78350F", paddingVertical: 4, minHeight: 60 }}
                placeholder="e.g., Incorrect odometer reading entered"
                placeholderTextColor="#B45309"
                value={amendReason}
                onChangeText={setAmendReason}
                multiline
                returnKeyType="done"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => setShowAmendModal(false)}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#D97706", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={handleAmend}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Save Amendment</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
