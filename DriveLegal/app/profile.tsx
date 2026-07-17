import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { getTrialDaysRemaining, updateUserProfile, type DriverType } from "@/lib/local-auth";
import { getAllLogs, getFortnightlyDrivingSeconds, formatHoursMinutes } from "@/lib/logbook-storage";


const VEHICLE_TYPES = [
  "Rideshare/Taxi",
  "Van",
  "Truck",
  "Bus",
  "Heavy Vehicle",
  "Other",
];

const DRIVER_TYPES = [
  {
    value: "small_passenger",
    label: "Small Passenger Service",
    sublabel: "7-hour limit only for qualifying short-fare work",
  },
  {
    value: "large_passenger",
    label: "Large Passenger Service",
    sublabel: "5.5-hour work-time limit",
  },
  {
    value: "goods",
    label: "Goods Service",
    sublabel: "5.5-hour work-time limit",
  },
  {
    value: "vehicle_recovery",
    label: "Vehicle Recovery Service",
    sublabel: "5.5-hour work-time limit",
  },
] as const;

function VehicleTypePicker({
  value,
  onChange,
  visible,
  onClose,
}: {
  value: string;
  onChange: (type: string) => void;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 items-center justify-end">
        <View className="bg-white w-full rounded-t-3xl p-4">
          <Text className="text-lg font-bold text-[#003366] mb-4">Select Vehicle Type</Text>
          <ScrollView className="max-h-80">
            {VEHICLE_TYPES.map((type) => (
              <TouchableOpacity
                key={type}
                className={`py-3 px-4 border-b border-[#E8EEF8] flex-row items-center justify-between ${
                  value === type ? "bg-[#F0F4FF]" : ""
                }`}
                onPress={() => {
                  onChange(type);
                  onClose();
                }}
              >
                <Text className={`text-base ${value === type ? "font-bold text-[#003366]" : "text-[#6B7A99]"}`}>
                  {type}
                </Text>
                {value === type && <Text className="text-[#5980E9] text-lg">✓</Text>}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            className="bg-[#F0F4FF] rounded-xl py-3 items-center mt-4"
            onPress={onClose}
          >
            <Text className="text-[#003366] font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: string }) {
  return (
    <View className="flex-row items-center justify-between py-3 border-b border-[#F0F4FF]">
      <View className="flex-row items-center gap-2 flex-1">
        {icon && <Text className="text-lg">{icon}</Text>}
        <Text className="text-xs text-[#6B7A99] uppercase tracking-wide">{label}</Text>
      </View>
      <Text className="text-sm font-semibold text-[#0D1B2A] ml-4">{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthContext();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showDriverTypePicker, setShowDriverTypePicker] = useState(false);
  const [form, setForm] = useState({
    name: user?.name ?? "",
    licenceNumber: user?.licenceNumber ?? "",
    vehicleRegistration: user?.vehicleRegistration ?? "",
    vehicleType: user?.vehicleType ?? "",
    driverType: (user as any)?.driverType ?? "small_passenger",
  });
  const [stats, setStats] = useState({
    totalShifts: 0,
    fortnightlyHours: 0,
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? "",
      licenceNumber: user.licenceNumber ?? "",
      vehicleRegistration: user.vehicleRegistration ?? "",
      vehicleType: user.vehicleType ?? "",
      driverType: (user as any)?.driverType ?? "small_passenger",
    });
    // Load stats
    Promise.all([
      getAllLogs(user.id),
      getFortnightlyDrivingSeconds(user.id),
    ]).then(([logs, fortnightly]) => {
      setStats({
        totalShifts: logs.length,
        fortnightlyHours: fortnightly,
      });
    });
  }, [user]);

  const trialDays = user ? getTrialDaysRemaining(user.trialStartDate) : 0;

  const handleSave = async () => {
    if (!user) return;
    if (!form.name.trim()) {
      Alert.alert("Error", "Name cannot be empty.");
      return;
    }
    if (!form.vehicleType) {
      Alert.alert("Error", "Please select a vehicle type.");
      return;
    }
    setSaving(true);
    const result = await updateUserProfile(user.id, {
      name: form.name.trim(),
      licenceNumber: form.licenceNumber.trim().toUpperCase(),
      vehicleRegistration: form.vehicleRegistration.trim().toUpperCase(),
      vehicleType: form.vehicleType,
      driverType: form.driverType as DriverType,
    });
    setSaving(false);
    if (result.success) {
      await refreshUser();
      setEditing(false);
    } else {
      Alert.alert("Error", result.error ?? "Failed to save.");
    }
  };

  const performLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore errors, proceed with navigation
    }
    if (Platform.OS === "web") {
      window.location.href = "/login";
    } else {
      router.replace("/login" as any);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: performLogout },
        ]
      );
    }
  };

  const handleContactSupport = async () => {
    const mailto = `mailto:support@drivelegal.app?subject=Drive%20Legal%20Support%20Request&body=Hello%2C%0A%0AI%20need%20help%20with%20Drive%20Legal.%0A%0ADriver%3A%20${encodeURIComponent(user?.name ?? "")}%0ALicence%3A%20${encodeURIComponent(user?.licenceNumber ?? "")}%0A%0A%5BPlease%20describe%20your%20issue%20here%5D`;
    try {
      await Linking.openURL(mailto);
    } catch {
      Alert.alert("Contact Support", "Please email support@drivelegal.app directly.");
    }
  };

  if (!user) return null;

  return (
    <ScreenContainer
  style={{
    backgroundColor: "#003366",
  }}
>
      {/* Header */}
<View
  style={{
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  }}
>
  <TouchableOpacity
    onPress={() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/more");
      }
    }}
    style={{
      paddingVertical: 8,
      alignSelf: "flex-start",
      marginBottom: 8,
    }}
  >
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
      }}
    >
      ‹ Back
    </Text>
  </TouchableOpacity>

  <View
    style={{
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    }}
  >
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Image
        source={require("@/assets/images/icon.png")}
        style={{
          width: 36,
          height: 36,
          borderRadius: 8,
        }}
        resizeMode="cover"
      />

      <View>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 13,
            fontWeight: "800",
            letterSpacing: 1.5,
          }}
        >
          DRIVE <Text style={{ color: "#4ADE80" }}>LEGAL</Text>
        </Text>

        <Text
          style={{
            color: "#BFDBFE",
            fontSize: 12,
            marginTop: 2,
          }}
        >
          👤 Profile
        </Text>
      </View>
    </View>

    {!editing ? (
      <TouchableOpacity
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 20,
          backgroundColor: "#5980E9",
          flexDirection: "row",
          alignItems: "center",
          gap: 5,
        }}
        onPress={() => setEditing(true)}
      >
        <Text style={{ fontSize: 16 }}>✏️</Text>
        <Text
          style={{
            color: "#FFFFFF",
            fontSize: 12,
            fontWeight: "700",
          }}
        >
          Edit
        </Text>
      </TouchableOpacity>
    ) : (
      <View
        style={{
          flexDirection: "row",
          gap: 8,
        }}
      >
        <TouchableOpacity
          style={{
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#4A6AB0",
          }}
          onPress={() => {
            setEditing(false);
            setForm({
              name: user.name ?? "",
              licenceNumber: user.licenceNumber ?? "",
              vehicleRegistration: user.vehicleRegistration ?? "",
              vehicleType: user.vehicleType ?? "",
              driverType:
                (user as any)?.driverType ?? "small_passenger",
            });
          }}
        >
          <Text
            style={{
              color: "#BFDBFE",
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            Cancel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            paddingHorizontal: 12,
            paddingVertical: 9,
            borderRadius: 20,
            backgroundColor: "#5980E9",
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Text style={{ fontSize: 16 }}>💾</Text>
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                Save
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    )}
  </View>
</View>

      <View className="flex-1 bg-[#F0F4FF] rounded-t-3xl">
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar & Name */}
          <View className="items-center mb-5">
            <View className="w-24 h-24 rounded-full bg-gradient-to-br from-[#5980E9] to-[#003366] items-center justify-center mb-3 border-4 border-white">
              <Text className="text-white text-4xl font-bold">
                {(user.name ?? "D").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text className="text-lg font-bold text-[#003366]">{user.name}</Text>
            <Text className="text-sm text-[#6B7A99]">{user.email}</Text>
          </View>

          {/* Trial / Subscription Status */}
          <View
            className={`rounded-2xl p-4 mb-5 border ${
              trialDays > 0
                ? "bg-[#003366] border-[#4A6AB0]"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            {trialDays > 0 ? (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-2xl">🎉</Text>
                  <Text className="text-blue-200 text-xs font-semibold uppercase tracking-wide">
                    Free Trial
                  </Text>
                </View>
                <Text className="text-white text-2xl font-bold ml-8">
                  {trialDays} {trialDays === 1 ? "day" : "days"} remaining
                </Text>
                <Text className="text-blue-300 text-xs mt-2 ml-8">
                  Full access to all features during your trial
                </Text>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-2 mb-1">
                  <Text className="text-lg">⏰</Text>
                  <Text className="text-amber-700 font-bold">Trial Expired</Text>
                </View>
                <Text className="text-amber-600 text-sm ml-8">
                  Subscribe to continue using Drive Legal
                </Text>
                <TouchableOpacity
                  className="bg-amber-500 rounded-xl py-2.5 items-center mt-3 ml-8 mr-8"
                  onPress={() => router.push("/paywall" as any)}
                >
                  <Text className="text-white font-bold text-sm">Subscribe Now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Stats Cards */}
          <View className="flex-row gap-3 mb-5">
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1 font-medium">🚗 Total Shifts</Text>
              <Text className="text-3xl font-bold text-[#003366]">{stats.totalShifts}</Text>
              <View className="h-1 bg-[#E8EEF8] rounded-full mt-2" />
            </View>
            <View className="flex-1 bg-white rounded-2xl p-4 border border-[#E8EEF8]">
              <Text className="text-xs text-[#6B7A99] mb-1 font-medium">⏱ Fortnight</Text>
              <Text className="text-3xl font-bold text-[#003366]">
                {formatHoursMinutes(stats.fortnightlyHours).split(" ")[0]}
              </Text>
              <Text className="text-xs text-[#9BA8C0] mt-0.5">/ 70h limit</Text>
            </View>
          </View>

          {/* Driver Details */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-[#E8EEF8]">
            <Text className="text-xs font-bold text-[#003366] uppercase tracking-wide mb-3">
              👤 Driver Details
            </Text>

            {editing ? (
              <View className="gap-4">
                <View>
                  <Text className="text-xs text-[#6B7A99] mb-1.5 font-semibold">Full Name</Text>
                  <TextInput
                    className="border border-[#D1DCF0] rounded-xl px-3 py-3 text-[#0D1B2A] bg-[#F8FAFF]"
                    value={form.name}
                    onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                    autoCapitalize="words"
                    placeholderTextColor="#9BA8C0"
                  />
                </View>
                <View>
                  <Text className="text-xs text-[#6B7A99] mb-1.5 font-semibold">NZ Licence Number</Text>
                  <TextInput
                    className="border border-[#D1DCF0] rounded-xl px-3 py-3 text-[#0D1B2A] bg-[#F8FAFF]"
                    value={form.licenceNumber}
                    onChangeText={(v) => setForm((p) => ({ ...p, licenceNumber: v }))}
                    autoCapitalize="characters"
                    placeholderTextColor="#9BA8C0"
                  />
                </View>
                <View>
                  <Text className="text-xs text-[#6B7A99] mb-1.5 font-semibold">Vehicle Registration</Text>
                  <TextInput
                    className="border border-[#D1DCF0] rounded-xl px-3 py-3 text-[#0D1B2A] bg-[#F8FAFF]"
                    value={form.vehicleRegistration}
                    onChangeText={(v) => setForm((p) => ({ ...p, vehicleRegistration: v }))}
                    autoCapitalize="characters"
                    placeholderTextColor="#9BA8C0"
                  />
                </View>
                <View>
                  <Text className="text-xs text-[#6B7A99] mb-1.5 font-semibold">Vehicle Type</Text>
                  <TouchableOpacity
                    className="border border-[#D1DCF0] rounded-xl px-3 py-3 bg-[#F8FAFF] flex-row items-center justify-between"
                    onPress={() => setShowVehiclePicker(true)}
                  >
                    <Text className={`text-base ${form.vehicleType ? "text-[#0D1B2A] font-medium" : "text-[#9BA8C0]"}`}>
                      {form.vehicleType || "Select vehicle type"}
                    </Text>
                    <Text className="text-lg">▼</Text>
                  </TouchableOpacity>
                </View>
                <View>
                  <Text className="text-xs text-[#6B7A99] mb-1.5 font-semibold">Driver Type (NZTA Classification)</Text>
                  <TouchableOpacity
                    className="border border-[#D1DCF0] rounded-xl px-3 py-3 bg-[#F8FAFF] flex-row items-center justify-between"
                    onPress={() => setShowDriverTypePicker(true)}
                  >
                    <Text className="text-base text-[#0D1B2A] font-medium">
  {DRIVER_TYPES.find((type) => type.value === form.driverType)?.label ??
    "Select driver type"}
</Text>
                    <Text className="text-lg">▼</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <InfoRow label="Full Name" value={user.name ?? "—"} icon="👤" />
                <InfoRow label="Email" value={user.email ?? "—"} icon="📧" />
                <InfoRow label="Licence Number" value={user.licenceNumber ?? "—"} icon="🪪" />
                <InfoRow label="Vehicle Type" value={user.vehicleType ?? "—"} icon="🚗" />
                <InfoRow label="Vehicle Rego" value={user.vehicleRegistration ?? "—"} icon="📋" />
                <InfoRow
                  label="Driver Type"
                  value={(user as any)?.driverType === "goods" ? "Goods Service (5.5h limit)" : "Passenger Service (7h limit)"}
                  icon="🚦"
                />
                <InfoRow
                  label="Member Since"
                  value={new Date(user.createdAt).toLocaleDateString("en-NZ", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                  icon="📅"
                />
              </>
            )}
          </View>

          {/* NZTA Compliance Rules */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-[#E8EEF8]">
            <Text className="text-xs font-bold text-[#003366] uppercase tracking-wide mb-3">
              ⚖️ NZTA Compliance Rules
            </Text>
            <View className="gap-2.5">
              <View className="flex-row items-start gap-3">
                <View className="w-5 h-5 rounded-full bg-[#F0F4FF] items-center justify-center mt-0.5">
                  <Text className="text-xs text-[#5980E9] font-bold">1</Text>
                </View>
                <Text className="text-xs text-[#6B7A99] flex-1 leading-relaxed">
                  Maximum <Text className="font-bold">{(user as any)?.driverType === "goods" ? "5.5 hours" : "7 hours"} driving</Text> before a 30-minute break
                </Text>
              </View>
              <View className="flex-row items-start gap-3">
                <View className="w-5 h-5 rounded-full bg-[#F0F4FF] items-center justify-center mt-0.5">
                  <Text className="text-xs text-[#5980E9] font-bold">2</Text>
                </View>
                <Text className="text-xs text-[#6B7A99] flex-1 leading-relaxed">
                  Maximum <Text className="font-bold">13 hours work time</Text> per shift
                </Text>
              </View>
              <View className="flex-row items-start gap-3">
                <View className="w-5 h-5 rounded-full bg-[#F0F4FF] items-center justify-center mt-0.5">
                  <Text className="text-xs text-[#5980E9] font-bold">3</Text>
                </View>
                <Text className="text-xs text-[#6B7A99] flex-1 leading-relaxed">
                  Maximum <Text className="font-bold">70 hours of work time</Text> in a cumulative work period before a continuous 24-hour break
                </Text>
              </View>
              <View className="flex-row items-start gap-3">
                <View className="w-5 h-5 rounded-full bg-[#F0F4FF] items-center justify-center mt-0.5">
                  <Text className="text-xs text-[#5980E9] font-bold">4</Text>
                </View>
                <Text className="text-xs text-[#6B7A99] flex-1 leading-relaxed">
                  <Text className="font-bold">10-hour break</Text> required after 13 hours of work
                </Text>
              </View>
            </View>
          </View>

          {/* Legal & Compliance */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-[#E2E8F0]">
            <Text className="text-[#003366] text-sm font-bold mb-3">📋 Legal & Compliance</Text>
            <TouchableOpacity
              className="flex-row items-center justify-between py-3 border-b border-[#F0F4FF]"
              onPress={() => router.push("/privacy-policy" as any)}
            >
              <Text className="text-[#4A5568] text-sm">Privacy Policy</Text>
              <Text className="text-[#9BA8C0] text-sm">→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center justify-between py-3 border-b border-[#F0F4FF]"
              onPress={() => router.push("/terms-of-service" as any)}
            >
              <Text className="text-[#4A5568] text-sm">Terms of Service</Text>
              <Text className="text-[#9BA8C0] text-sm">→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center justify-between py-3"
              onPress={() => router.push("/enforcement-view" as any)}
            >
              <Text className="text-[#4A5568] text-sm">Enforcement View (Show to Officer)</Text>
              <Text className="text-[#9BA8C0] text-sm">→</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Support */}
          <View className="bg-white rounded-2xl p-4 mb-4 border border-[#E8EEF8]">
            <Text className="text-[#003366] text-sm font-bold mb-3">💬 Contact Support</Text>
            <Text className="text-xs text-[#6B7A99] mb-3 leading-relaxed">
              Need help? We're here to assist you with any questions or issues.
            </Text>
            <Text className="text-sm font-semibold text-[#003366] mb-3">support@drivelegal.app</Text>
            <TouchableOpacity
              className="bg-[#5980E9] rounded-xl py-3 items-center active:opacity-75"
              onPress={handleContactSupport}
            >
              <Text className="text-white font-bold text-sm">📧 Get Help</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            className="bg-red-50 border border-red-200 rounded-2xl py-4 items-center flex-row justify-center gap-2 active:opacity-75 mb-4"
            onPress={handleLogout}
          >
            <Text className="text-lg">🚪</Text>
            <Text className="text-red-600 font-bold">Sign Out</Text>
          </TouchableOpacity>

          <Text className="text-center text-xs text-[#9BA8C0]">
            Drive Legal v1.0
          </Text>
        </ScrollView>
      </View>

      <VehicleTypePicker
        value={form.vehicleType}
        onChange={(type) => setForm((p) => ({ ...p, vehicleType: type }))}
        visible={showVehiclePicker}
        onClose={() => setShowVehiclePicker(false)}
      />

      {/* Driver Type Picker Modal */}
      <Modal visible={showDriverTypePicker} transparent animationType="fade">
        <View className="flex-1 bg-black/50 items-center justify-end">
          <View className="bg-white w-full rounded-t-3xl p-4">
            <Text className="text-lg font-bold text-[#003366] mb-2">Select Driver Type</Text>
            <Text className="text-xs text-[#6B7A99] mb-4">
              Your driving limit depends on your NZTA service classification
            </Text>
            {DRIVER_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt.value}
                className={`py-4 px-4 border-b border-[#E8EEF8] flex-row items-center justify-between ${
                  form.driverType === dt.value ? "bg-[#F0F4FF]" : ""
                }`}
                onPress={() => {
                  setForm((p) => ({ ...p, driverType: dt.value }));
                  setShowDriverTypePicker(false);
                }}
              >
                <View>
                  <Text className={`text-base ${form.driverType === dt.value ? "font-bold text-[#003366]" : "text-[#0D1B2A]"}`}>
                    {dt.label}
                  </Text>
                  <Text className="text-xs text-[#6B7A99] mt-0.5">{dt.sublabel}</Text>
                </View>
                {form.driverType === dt.value && <Text className="text-[#5980E9] text-lg">✓</Text>}
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              className="bg-[#F0F4FF] rounded-xl py-3 items-center mt-4"
              onPress={() => setShowDriverTypePicker(false)}
            >
              <Text className="text-[#003366] font-semibold">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
}
