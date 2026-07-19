import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  getTrialDaysRemaining,
  updateUserProfile,
  type DriverType,
} from "@/lib/local-auth";
import {
  formatHoursMinutes,
  getAllLogs,
  getFortnightlyDrivingSeconds,
} from "@/lib/logbook-storage";

const COLORS = {
  navy: "#003366",
  navyLight: "#174A7E",
  blue: "#3768E8",
  blueSoft: "#EAF0FF",
  green: "#22C55E",
  greenSoft: "#ECFDF3",
  page: "#F1F5FF",
  white: "#FFFFFF",
  text: "#10243E",
  muted: "#667793",
  subtle: "#94A3B8",
  border: "#DDE6F3",
  input: "#F8FAFE",
  warning: "#D97706",
  warningSoft: "#FFF7E6",
  danger: "#C62828",
  dangerSoft: "#FFF1F1",
};

const VEHICLE_TYPES = [
  "Hatchback",
  "Sedan",
  "Station Wagon",
  "SUV",
  "Rideshare/Taxi",
  "Van",
  "Minivan",
  "Truck",
  "Bus",
  "Heavy Vehicle",
];

const DRIVER_TYPES = [
  {
    value: "small_passenger",
    label: "Small Passenger Service",
    sublabel:
      "Standard 5½-hour limit; up to 7 hours only for qualifying short-fare work",
  },
  {
    value: "large_passenger",
    label: "Large Passenger Service",
    sublabel: "5½-hour continuous work-time limit",
  },
  {
    value: "goods",
    label: "Goods Service",
    sublabel: "5½-hour continuous work-time limit",
  },
  {
    value: "vehicle_recovery",
    label: "Vehicle Recovery Service",
    sublabel: "5½-hour continuous work-time limit",
  },
] as const;

type PickerOption = {
  value: string;
  label: string;
  sublabel?: string;
};

type SelectionModalProps = {
  title: string;
  description?: string;
  visible: boolean;
  selectedValue: string;
  options: PickerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

function SelectionModal({
  title,
  description,
  visible,
  selectedValue,
  options,
  onSelect,
  onClose,
}: SelectionModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>{title}</Text>
          {description ? (
            <Text style={styles.modalDescription}>{description}</Text>
          ) : null}
          <ScrollView
            style={styles.modalList}
            showsVerticalScrollIndicator={false}
          >
            {options.map((option) => {
              const selected = selectedValue === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    selected && styles.modalOptionSelected,
                  ]}
                  activeOpacity={0.75}
                  onPress={() => {
                    onSelect(option.value);
                    onClose();
                  }}
                >
                  <View style={styles.modalOptionText}>
                    <Text
                      style={[
                        styles.modalOptionLabel,
                        selected && styles.modalOptionLabelSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {option.sublabel ? (
                      <Text style={styles.modalOptionSublabel}>
                        {option.sublabel}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      styles.selectionCircle,
                      selected && styles.selectionCircleSelected,
                    ]}
                  >
                    {selected ? (
                      <Text style={styles.selectionCheck}>✓</Text>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={onClose}
            activeOpacity={0.75}
          >
            <Text style={styles.modalCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
  icon: string;
  last?: boolean;
};

function InfoRow({ label, value, icon, last = false }: InfoRowProps) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoIconContainer}>
        <Text style={styles.infoIcon}>{icon}</Text>
      </View>
      <View style={styles.infoTextContainer}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value || "—"}</Text>
      </View>
    </View>
  );
}

type FormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

function FormField({
  label,
  value,
  placeholder,
  onChangeText,
  autoCapitalize = "none",
}: FormFieldProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        placeholder={placeholder}
        placeholderTextColor={COLORS.subtle}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
        onChangeText={onChangeText}
      />
    </View>
  );
}

type SelectorFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
};

function SelectorField({
  label,
  value,
  placeholder,
  onPress,
}: SelectorFieldProps) {
  return (
    <View style={styles.formGroup}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.selector}
        activeOpacity={0.75}
        onPress={onPress}
      >
        <Text
          style={[styles.selectorText, !value && styles.selectorPlaceholder]}
        >
          {value || placeholder}
        </Text>
        <Text style={styles.selectorChevron}>▼</Text>
      </TouchableOpacity>
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
  const [iconLoadFailed, setIconLoadFailed] = useState(false);
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

    Promise.all([
      getAllLogs(user.id),
      getFortnightlyDrivingSeconds(user.id),
    ])
      .then(([logs, fortnightly]) => {
        setStats({
          totalShifts: logs.length,
          fortnightlyHours: fortnightly,
        });
      })
      .catch(() => {
        // Non-fatal: leave stats at defaults if this fails
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
    try {
      const result = await updateUserProfile(user.id, {
        name: form.name.trim(),
        licenceNumber: form.licenceNumber.trim().toUpperCase(),
        vehicleRegistration: form.vehicleRegistration.trim().toUpperCase(),
        vehicleType: form.vehicleType,
        driverType: form.driverType as DriverType,
      });

      if (result.success) {
        await refreshUser();
        setEditing(false);
      } else {
        Alert.alert("Error", result.error ?? "Failed to save.");
      }
    } catch (e) {
      Alert.alert("Error", "Something went wrong while saving.");
    } finally {
      setSaving(false);
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
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: performLogout },
      ]);
    }
  };

  const handleContactSupport = async () => {
    const mailto = `mailto:support@drivelegal.app?subject=Drive%20Legal%20Support%20Request&body=Hello%2C%0A%0AI%20need%20help%20with%20Drive%20Legal.%0A%0ADriver%3A%20${encodeURIComponent(
      user?.name ?? ""
    )}%0ALicence%3A%20${encodeURIComponent(
      user?.licenceNumber ?? ""
    )}%0A%0A%5BPlease%20describe%20your%20issue%20here%5D`;
    try {
      const supported = await Linking.canOpenURL(mailto);
      if (supported) {
        await Linking.openURL(mailto);
      } else {
        Alert.alert(
          "Contact Support",
          "Please email support@drivelegal.app directly."
        );
      }
    } catch {
      Alert.alert(
        "Contact Support",
        "Please email support@drivelegal.app directly."
      );
    }
  };

  if (!user) return null;

  return (
    <ScreenContainer style={{ backgroundColor: COLORS.navy }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) {
              router.back();
            } else {
              router.replace("/(tabs)/more" as any);
            }
          }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.headerRow}>
          <View style={styles.headerBrand}>
            {!iconLoadFailed ? (
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.headerIcon}
                resizeMode="cover"
                onError={() => setIconLoadFailed(true)}
              />
            ) : (
              <View style={[styles.headerIcon, styles.headerIconFallback]}>
                <Text style={styles.headerIconFallbackText}>D</Text>
              </View>
            )}
            <View>
              <Text style={styles.headerTitle}>
                DRIVE <Text style={styles.headerTitleAccent}>LEGAL</Text>
              </Text>
              <Text style={styles.headerSubtitle}>👤 Profile</Text>
            </View>
          </View>

          {!editing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
            >
              <Text style={styles.editButtonEmoji}>✏️</Text>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setEditing(false);
                  setForm({
                    name: user.name ?? "",
                    licenceNumber: user.licenceNumber ?? "",
                    vehicleRegistration: user.vehicleRegistration ?? "",
                    vehicleType: user.vehicleType ?? "",
                    driverType: (user as any)?.driverType ?? "small_passenger",
                  });
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.saveButtonEmoji}>💾</Text>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.body}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Avatar & Name */}
          <View style={styles.avatarSection}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user.name ?? "D").charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>

          {/* Trial / Subscription Status */}
          <View
            style={[
              styles.trialCard,
              trialDays > 0 ? styles.trialCardActive : styles.trialCardExpired,
            ]}
          >
            {trialDays > 0 ? (
              <>
                <View style={styles.trialHeaderRow}>
                  <Text style={styles.trialEmoji}>🎉</Text>
                  <Text style={styles.trialLabel}>Free Trial</Text>
                </View>
                <Text style={styles.trialDays}>
                  {trialDays} {trialDays === 1 ? "day" : "days"} remaining
                </Text>
                <Text style={styles.trialSubtext}>
                  Full access to all features during your trial
                </Text>
              </>
            ) : (
              <>
                <View style={styles.trialHeaderRow}>
                  <Text style={styles.trialEmoji}>⏰</Text>
                  <Text style={styles.trialExpiredLabel}>Trial Expired</Text>
                </View>
                <Text style={styles.trialExpiredSubtext}>
                  Subscribe to continue using Drive Legal
                </Text>
                <TouchableOpacity
                  style={styles.subscribeButton}
                  onPress={() => router.push("/paywall" as any)}
                >
                  <Text style={styles.subscribeButtonText}>
                    Subscribe Now
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Stats Cards */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>🚗 Total Shifts</Text>
              <Text style={styles.statValue}>{stats.totalShifts}</Text>
              <View style={styles.statBar} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>⏱ Fortnight</Text>
              <Text style={styles.statValue}>
                {formatHoursMinutes(stats.fortnightlyHours).split(" ")[0]}
              </Text>
              <Text style={styles.statSubtext}>/ 70h limit</Text>
            </View>
          </View>

          {/* Driver Details */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👤 Driver Details</Text>
            {editing ? (
              <View style={styles.formStack}>
                <FormField
                  label="Full Name"
                  value={form.name}
                  placeholder="Full name"
                  autoCapitalize="words"
                  onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
                />
                <FormField
                  label="NZ Licence Number"
                  value={form.licenceNumber}
                  placeholder="Licence number"
                  autoCapitalize="characters"
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, licenceNumber: v }))
                  }
                />
                <FormField
                  label="Vehicle Registration"
                  value={form.vehicleRegistration}
                  placeholder="Vehicle rego"
                  autoCapitalize="characters"
                  onChangeText={(v) =>
                    setForm((p) => ({ ...p, vehicleRegistration: v }))
                  }
                />
                <SelectorField
                  label="Vehicle Type"
                  value={form.vehicleType}
                  placeholder="Select vehicle type"
                  onPress={() => setShowVehiclePicker(true)}
                />
                <SelectorField
                  label="Driver Type (NZTA Classification)"
                  value={
                    DRIVER_TYPES.find((t) => t.value === form.driverType)
                      ?.label ?? ""
                  }
                  placeholder="Select driver type"
                  onPress={() => setShowDriverTypePicker(true)}
                />
              </View>
            ) : (
              <>
                <InfoRow label="Full Name" value={user.name ?? "—"} icon="👤" />
                <InfoRow
                  label="Email"
                  value={user.email ?? "—"}
                  icon="📧"
                />
                <InfoRow
                  label="Licence Number"
                  value={user.licenceNumber ?? "—"}
                  icon="🪪"
                />
                <InfoRow
                  label="Vehicle Type"
                  value={user.vehicleType ?? "—"}
                  icon="🚗"
                />
                <InfoRow
                  label="Vehicle Rego"
                  value={user.vehicleRegistration ?? "—"}
                  icon="📋"
                />
                <InfoRow
                  label="Driver Type"
                  value={
                    DRIVER_TYPES.find(
                      (type) =>
                        type.value ===
                        ((user as any)?.driverType ?? "small_passenger")
                    )?.label ?? "Small Passenger Service"
                  }
                  icon="🚦"
                />
                <InfoRow
                  label="Member Since"
                  value={new Date(user.createdAt).toLocaleDateString(
                    "en-NZ",
                    {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }
                  )}
                  icon="📅"
                  last
                />
              </>
            )}
          </View>

          {/* NZTA Compliance Rules */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>⚖️ NZTA Compliance Rules</Text>
            <View style={styles.rulesStack}>
              <View style={styles.ruleRow}>
                <View style={styles.ruleBadge}>
                  <Text style={styles.ruleBadgeText}>1</Text>
                </View>
                <Text style={styles.ruleText}>
                  Maximum{" "}
                  <Text style={styles.ruleTextBold}>
                    {(user as any)?.driverType === "goods"
                      ? "5.5 hours"
                      : "7 hours"}{" "}
                    driving
                  </Text>{" "}
                  before a 30-minute break
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={styles.ruleBadge}>
                  <Text style={styles.ruleBadgeText}>2</Text>
                </View>
                <Text style={styles.ruleText}>
                  Maximum{" "}
                  <Text style={styles.ruleTextBold}>13 hours work time</Text>{" "}
                  per shift
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={styles.ruleBadge}>
                  <Text style={styles.ruleBadgeText}>3</Text>
                </View>
                <Text style={styles.ruleText}>
                  Maximum{" "}
                  <Text style={styles.ruleTextBold}>
                    70 hours of work time
                  </Text>{" "}
                  in a cumulative work period before a continuous 24-hour
                  break
                </Text>
              </View>
              <View style={styles.ruleRow}>
                <View style={styles.ruleBadge}>
                  <Text style={styles.ruleBadgeText}>4</Text>
                </View>
                <Text style={styles.ruleText}>
                  <Text style={styles.ruleTextBold}>10-hour break</Text>{" "}
                  required after 13 hours of work
                </Text>
              </View>
            </View>
          </View>

          {/* Legal & Compliance */}
          <View style={styles.card}>
            <Text style={styles.cardTitleAlt}>📋 Legal & Compliance</Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push("/privacy-policy" as any)}
            >
              <Text style={styles.linkRowText}>Privacy Policy</Text>
              <Text style={styles.linkRowChevron}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => router.push("/terms-of-service" as any)}
            >
              <Text style={styles.linkRowText}>Terms of Service</Text>
              <Text style={styles.linkRowChevron}>→</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.linkRow, styles.linkRowLast]}
              onPress={() => router.push("/enforcement-view" as any)}
            >
              <Text style={styles.linkRowText}>
                Enforcement View (Show to Officer)
              </Text>
              <Text style={styles.linkRowChevron}>→</Text>
            </TouchableOpacity>
          </View>

          {/* Contact Support */}
          <View style={styles.card}>
            <Text style={styles.cardTitleAlt}>💬 Contact Support</Text>
            <Text style={styles.supportText}>
              Need help? We're here to assist you with any questions or
              issues.
            </Text>
            <Text style={styles.supportEmail}>support@drivelegal.app</Text>
            <TouchableOpacity
              style={styles.supportButton}
              onPress={handleContactSupport}
            >
              <Text style={styles.supportButtonText}>📧 Get Help</Text>
            </TouchableOpacity>
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleLogout}
          >
            <Text style={styles.signOutEmoji}>🚪</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={styles.versionText}>Drive Legal v1.0</Text>
        </ScrollView>
      </View>

      <SelectionModal
        title="Select Vehicle Type"
        visible={showVehiclePicker}
        selectedValue={form.vehicleType}
        options={VEHICLE_TYPES.map((v) => ({ value: v, label: v }))}
        onSelect={(type) => setForm((p) => ({ ...p, vehicleType: type }))}
        onClose={() => setShowVehiclePicker(false)}
      />

      <SelectionModal
        title="Select Driver Type"
        description="Your driving limit depends on your NZTA service classification"
        visible={showDriverTypePicker}
        selectedValue={form.driverType}
        options={DRIVER_TYPES.map((dt) => ({
          value: dt.value,
          label: dt.label,
          sublabel: dt.sublabel,
        }))}
        onSelect={(value) => setForm((p) => ({ ...p, driverType: value }))}
        onClose={() => setShowDriverTypePicker(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  backButton: {
    paddingVertical: 8,
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  backButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  headerIconFallback: {
    backgroundColor: COLORS.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconFallbackText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 16,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerTitleAccent: {
    color: "#4ADE80",
  },
  headerSubtitle: {
    color: "#BFDBFE",
    fontSize: 12,
    marginTop: 2,
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: COLORS.blue,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  editButtonEmoji: {
    fontSize: 16,
  },
  editButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
  },
  cancelButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#4A6AB0",
  },
  cancelButtonText: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "700",
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.blue,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  saveButtonEmoji: {
    fontSize: 16,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  body: {
    flex: 1,
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.navy,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 4,
    borderColor: COLORS.white,
  },
  avatarText: {
    color: COLORS.white,
    fontSize: 36,
    fontWeight: "700",
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.navy,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.muted,
  },
  trialCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
  },
  trialCardActive: {
    backgroundColor: COLORS.navy,
    borderColor: "#4A6AB0",
  },
  trialCardExpired: {
    backgroundColor: COLORS.warningSoft,
    borderColor: "#FDE68A",
  },
  trialHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  trialEmoji: {
    fontSize: 20,
  },
  trialLabel: {
    color: "#BFDBFE",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  trialDays: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: "700",
    marginLeft: 32,
  },
  trialSubtext: {
    color: "#93C5FD",
    fontSize: 12,
    marginTop: 8,
    marginLeft: 32,
  },
  trialExpiredLabel: {
    color: COLORS.warning,
    fontWeight: "700",
    fontSize: 16,
  },
  trialExpiredSubtext: {
    color: COLORS.warning,
    fontSize: 14,
    marginLeft: 32,
  },
  subscribeButton: {
    backgroundColor: COLORS.warning,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    marginTop: 12,
    marginLeft: 32,
    marginRight: 32,
  },
  subscribeButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 4,
    fontWeight: "500",
  },
  statValue: {
    fontSize: 30,
    fontWeight: "700",
    color: COLORS.navy,
  },
  statBar: {
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    marginTop: 8,
  },
  statSubtext: {
    fontSize: 12,
    color: COLORS.subtle,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.navy,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  cardTitleAlt: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 12,
  },
  formStack: {
    gap: 16,
  },
  formGroup: {
    marginBottom: 4,
  },
  formLabel: {
    fontSize: 12,
    color: COLORS.muted,
    fontWeight: "600",
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.text,
    backgroundColor: COLORS.input,
    fontSize: 15,
  },
  selector: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.input,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectorText: {
    fontSize: 15,
    color: COLORS.text,
    fontWeight: "500",
  },
  selectorPlaceholder: {
    color: COLORS.subtle,
    fontWeight: "400",
  },
  selectorChevron: {
    fontSize: 14,
    color: COLORS.muted,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.blueSoft,
  },
  infoRowLast: {
    borderBottomWidth: 0,
  },
  infoIconContainer: {
    width: 28,
  },
  infoIcon: {
    fontSize: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: COLORS.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 2,
  },
  rulesStack: {
    gap: 10,
  },
  ruleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  ruleBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.blueSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  ruleBadgeText: {
    fontSize: 11,
    color: COLORS.blue,
    fontWeight: "700",
  },
  ruleText: {
    fontSize: 12,
    color: COLORS.muted,
    flex: 1,
    lineHeight: 18,
  },
  ruleTextBold: {
    fontWeight: "700",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.blueSoft,
  },
  linkRowLast: {
    borderBottomWidth: 0,
  },
  linkRowText: {
    fontSize: 14,
    color: "#4A5568",
  },
  linkRowChevron: {
    fontSize: 14,
    color: COLORS.subtle,
  },
  supportText: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 12,
    lineHeight: 18,
  },
  supportEmail: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.navy,
    marginBottom: 12,
  },
  supportButton: {
    backgroundColor: COLORS.blue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  supportButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
  signOutButton: {
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  signOutEmoji: {
    fontSize: 18,
  },
  signOutText: {
    color: COLORS.danger,
    fontWeight: "700",
  },
  versionText: {
    textAlign: "center",
    fontSize: 12,
    color: COLORS.subtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    width: "100%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 16,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.navy,
    marginBottom: 4,
  },
  modalDescription: {
    fontSize: 12,
    color: COLORS.muted,
    marginBottom: 12,
  },
  modalList: {
    maxHeight: 320,
  },
  modalOption: {
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.blueSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOptionSelected: {
    backgroundColor: COLORS.blueSoft,
  },
  modalOptionText: {
    flex: 1,
  },
  modalOptionLabel: {
    fontSize: 15,
    color: COLORS.text,
  },
  modalOptionLabelSelected: {
    fontWeight: "700",
    color: COLORS.navy,
  },
  modalOptionSublabel: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  selectionCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  selectionCircleSelected: {
    backgroundColor: COLORS.blue,
    borderColor: COLORS.blue,
  },
  selectionCheck: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  modalCancelButton: {
    backgroundColor: COLORS.blueSoft,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  modalCancelText: {
    color: COLORS.navy,
    fontWeight: "600",
  },
});
