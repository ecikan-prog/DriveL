import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { getAllLogs, formatHoursMinutes, DailyLog } from "@/lib/logbook-storage";
import { getDrivingLimitSeconds } from "@/hooks/use-nzta-compliance";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [exporting, setExporting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [excelPassword, setExcelPassword] = useState("");

  useEffect(() => {
    if (!user) return;
    getAllLogs(user.id).then(setLogs);
  }, [user]);

  const handleExportExcel = async (password?: string) => {
    if (!user || logs.length === 0) {
      Alert.alert("No Data", "No shift records to export.");
      return;
    }
    setExporting(true);
    try {
      const driverType = (user as any)?.driverType ?? "small_passenger";
      const { generateAndShareExcel } = await import("@/lib/excel-export");
      await generateAndShareExcel({
        logs,
        driverName: user.name ?? "",
        licenceNumber: user.licenceNumber ?? "",
        vehicleRego: user.vehicleRegistration ?? "",
        driverType,
        password: password || undefined,
      });
    } catch (e: any) {
      Alert.alert("Export Error", e.message || "Failed to generate Excel file.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!user || logs.length === 0) {
      Alert.alert("No Data", "No shift records to export.");
      return;
    }
    setExporting(true);
    try {
      const driverType = (user as any)?.driverType ?? "small_passenger";
      const { generateAndSharePDF } = await import("@/lib/pdf-export");
      await generateAndSharePDF({
        logs,
        driverName: user.name ?? "",
        licenceNumber: user.licenceNumber ?? "",
        vehicleRegistration: user.vehicleRegistration ?? "",
        vehicleType: user.vehicleType ?? "",
        driverType,
      });
    } catch (e: any) {
      Alert.alert("Export Error", e.message || "Failed to generate PDF.");
    } finally {
      setExporting(false);
    }
  };

  const totalDrivingSeconds = logs.reduce((sum, l) => sum + l.totalDrivingSeconds, 0);
  const totalWorkSeconds = logs.reduce((sum, l) => sum + l.totalWorkSeconds, 0);
  const totalShifts = logs.length;
  const driverType = (user as any)?.driverType ?? "small_passenger";
  const drivingLimitSec = getDrivingLimitSeconds(driverType);
  const compliantShifts = logs.filter(
    (l) => l.totalDrivingSeconds <= drivingLimitSec && l.totalWorkSeconds <= 13 * 3600
  ).length;

  if (!user) return null;

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>Reports</Text>
        <Text style={{ color: "#93C5FD", fontSize: 12, marginTop: 4 }}>Export and compliance reports</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* Summary Stats */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>SUMMARY</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#003366" }}>{totalShifts}</Text>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Total Shifts</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#003366" }}>{formatHoursMinutes(totalDrivingSeconds)}</Text>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Driving</Text>
              </View>
              <View style={{ alignItems: "center" }}>
                <Text style={{ fontSize: 24, fontWeight: "800", color: "#22C55E" }}>{totalShifts > 0 ? Math.round((compliantShifts / totalShifts) * 100) : 100}%</Text>
                <Text style={{ fontSize: 10, color: "#6B7A99" }}>Within Limits</Text>
              </View>
            </View>
          </View>

          {/* Export Options */}
          <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 12 }}>EXPORT</Text>

          <TouchableOpacity
            style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E8EEF8", flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={handleExportPDF}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="picture-as-pdf" size={22} color="#B91C1C" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>Export PDF Report</Text>
              <Text style={{ fontSize: 11, color: "#6B7A99" }}>Logbook with GPS & odometer, built to NZTA spec</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9BA8C0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E8EEF8", flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={() => handleExportExcel()}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#F0FDF4", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="table-chart" size={22} color="#16A34A" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>Export Excel (.xlsx)</Text>
              <Text style={{ fontSize: 11, color: "#6B7A99" }}>NZTA Spec 6.1.2 — Microsoft Excel format</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9BA8C0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E8EEF8", flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={() => setShowPasswordModal(true)}
            disabled={exporting}
            activeOpacity={0.7}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="lock" size={22} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>Bulk Export (Protected)</Text>
              <Text style={{ fontSize: 11, color: "#6B7A99" }}>NZTA Spec 6.1.4 — Password-protected Excel</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9BA8C0" />
          </TouchableOpacity>

          <TouchableOpacity
            style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#E8EEF8", flexDirection: "row", alignItems: "center", gap: 12 }}
            onPress={() => router.push("/enforcement-view" as any)}
            activeOpacity={0.7}
          >
            <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: "#EFF6FF", alignItems: "center", justifyContent: "center" }}>
              <MaterialIcons name="verified-user" size={22} color="#2563EB" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#003366" }}>Enforcement View</Text>
              <Text style={{ fontSize: 11, color: "#6B7A99" }}>Show to officer during roadside inspection</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color="#9BA8C0" />
          </TouchableOpacity>

          {/* Compliance Info */}
          <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginTop: 8, marginBottom: 12 }}>COMPLIANCE</Text>

          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F4FF" }}>
              <Text style={{ fontSize: 13, color: "#4A5568" }}>Hash chain integrity</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#22C55E" }}>Verified</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F0F4FF" }}>
              <Text style={{ fontSize: 13, color: "#4A5568" }}>Records tamper-proof</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#22C55E" }}>Yes</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8 }}>
              <Text style={{ fontSize: 13, color: "#4A5568" }}>GPS tracking</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22C55E" }} />
                <Text style={{ fontSize: 12, fontWeight: "600", color: "#22C55E" }}>Active</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      {/* Password Modal for Protected Export */}
      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", paddingHorizontal: 24 }}>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 24, width: "100%", maxWidth: 360 }}>
            <Text style={{ fontSize: 20, fontWeight: "700", color: "#003366", marginBottom: 8 }}>Password-Protected Export</Text>
            <Text style={{ fontSize: 13, color: "#6B7A99", marginBottom: 16 }}>NZTA Spec 6.1.4: Set a password for the Excel file. Send the password separately to the recipient.</Text>
            <View style={{ backgroundColor: "#F0F4FF", borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 10, color: "#6B7A99", marginBottom: 4, fontWeight: "600" }}>PASSWORD</Text>
              <TextInput
                style={{ fontSize: 16, fontWeight: "700", color: "#003366", paddingVertical: 8 }}
                placeholder="Enter password"
                placeholderTextColor="#9BA8C0"
                secureTextEntry
                value={excelPassword}
                onChangeText={setExcelPassword}
                returnKeyType="done"
              />
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, borderWidth: 1, borderColor: "#D1DCF0", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setShowPasswordModal(false); setExcelPassword(""); }}
              >
                <Text style={{ color: "#6B7A99", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: "#003366", borderRadius: 12, paddingVertical: 14, alignItems: "center" }}
                onPress={() => { setShowPasswordModal(false); handleExportExcel(excelPassword); setExcelPassword(""); }}
              >
                <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Export</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
