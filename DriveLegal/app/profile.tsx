import React, { useEffect, useMemo, useState } from "react";
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
  "Other",
] as const;

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
  options: readonly PickerOption[];
  onSelect: (value: string) => void;
  onClose: () => void;
};

type InfoRowProps = {
  label: string;
  value: string;
  icon: string;
  last?: boolean;
};

type FormFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (value: string) => void;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
};

type SelectorFieldProps = {
  label: string;
  value: string;
  placeholder: string;
  onPress: () => void;
};

type ProfileForm = {
  name: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType: DriverType;
};

type ProfileStats = {
  totalShifts: number;
  fortnightlySeconds: number;
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
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
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
            keyboardShouldPersistTaps="handled"
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
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
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
          style={[
            styles.selectorText,
            !value && styles.selectorPlaceholder,
          ]}
          numberOfLines={2}
        >
          {value || placeholder}
        </Text>

        <Text style={styles.selectorArrow}>⌄</Text>
      </TouchableOpacity>
    </View>
  );
}

function safeDate(value: unknown): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value as string | number | Date);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, refreshUser } = useAuthContext();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [showVehiclePicker, setShowVehiclePicker] = useState(false);
  const [showDriverTypePicker, setShowDriverTypePicker] = useState(false);

  const [form, setForm] = useState<ProfileForm>({
    name: "",
    licenceNumber: "",
    vehicleRegistration: "",
    vehicleType: "",
    driverType: "small_passenger",
  });

  const [stats, setStats] = useState<ProfileStats>({
    totalShifts: 0,
    fortnightlySeconds: 0,
  });

  const currentDriverType =
    ((user as any)?.driverType as DriverType | undefined) ??
    "small_passenger";

  const selectedDriverType = useMemo(() => {
    return (
      DRIVER_TYPES.find((item) => item.value === form.driverType) ??
      DRIVER_TYPES[0]
    );
  }, [form.driverType]);

  const displayedDriverType = useMemo(() => {
    return (
      DRIVER_TYPES.find((item) => item.value === currentDriverType) ??
      DRIVER_TYPES[0]
    );
  }, [currentDriverType]);

  const vehicleOptions = useMemo<PickerOption[]>(() => {
    return VEHICLE_TYPES.map((vehicleType) => ({
      value: vehicleType,
      label: vehicleType,
    }));
  }, []);

  const driverTypeOptions = useMemo<PickerOption[]>(() => {
    return DRIVER_TYPES.map((driverType) => ({
      value: driverType.value,
      label: driverType.label,
      sublabel: driverType.sublabel,
    }));
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setForm({
      name: user.name ?? "",
      licenceNumber: user.licenceNumber ?? "",
      vehicleRegistration: user.vehicleRegistration ?? "",
      vehicleType: user.vehicleType ?? "",
      driverType:
        ((user as any)?.driverType as DriverType | undefined) ??
        "small_passenger",
    });
  }, [user]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const loadStats = async () => {
      setLoadingStats(true);

      try {
        const [logs, fortnightlySeconds] = await Promise.all([
          getAllLogs(user.id),
          getFortnightlyDrivingSeconds(user.id),
        ]);

        if (cancelled) {
          return;
        }

        setStats({
          totalShifts: Array.isArray(logs) ? logs.length : 0,
          fortnightlySeconds:
            typeof fortnightlySeconds === "number" &&
            Number.isFinite(fortnightlySeconds)
              ? Math.max(0, fortnightlySeconds)
              : 0,
        });
      } catch (error) {
        console.warn("Unable to load profile statistics:", error);

        if (!cancelled) {
          setStats({
            totalShifts: 0,
            fortnightlySeconds: 0,
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    };

    void loadStats();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const trialDays = user?.trialStartDate
    ? Math.max(0, getTrialDaysRemaining(user.trialStartDate))
    : 0;

  const resetForm = () => {
    if (!user) {
      return;
    }

    setForm({
      name: user.name ?? "",
      licenceNumber: user.licenceNumber ?? "",
      vehicleRegistration: user.vehicleRegistration ?? "",
      vehicleType: user.vehicleType ?? "",
      driverType:
        ((user as any)?.driverType as DriverType | undefined) ??
        "small_passenger",
    });
  };

  const handleCancelEditing = () => {
    resetForm();
    setEditing(false);
    setShowVehiclePicker(false);
    setShowDriverTypePicker(false);
  };

  const handleSave = async () => {
    if (!user?.id || saving) {
      return;
    }

    const cleanedName = (form.name ?? "").trim();
    const cleanedLicence = (form.licenceNumber ?? "")
      .trim()
      .toUpperCase();
    const cleanedRegistration = (form.vehicleRegistration ?? "")
      .trim()
      .toUpperCase();
    const cleanedVehicleType = (form.vehicleType ?? "").trim();

    if (!cleanedName) {
      Alert.alert("Name required", "Please enter the driver's full name.");
      return;
    }

    if (!cleanedLicence) {
      Alert.alert(
        "Licence required",
        "Please enter the driver's New Zealand licence number.",
      );
      return;
    }

    if (!cleanedRegistration) {
      Alert.alert(
        "Vehicle registration required",
        "Please enter the vehicle registration.",
      );
      return;
    }

    if (!cleanedVehicleType) {
      Alert.alert(
        "Vehicle type required",
        "Please select the vehicle type.",
      );
      return;
    }

    setSaving(true);

    try {
      const result = await updateUserProfile(user.id, {
        name: cleanedName,
        licenceNumber: cleanedLicence,
        vehicleRegistration: cleanedRegistration,
        vehicleType: cleanedVehicleType,
        driverType: form.driverType,
      });

      if (!result.success) {
        Alert.alert(
          "Unable to save",
          result.error ?? "The profile could not be updated.",
        );
        return;
      }

      await refreshUser();
      setEditing(false);

      Alert.alert(
        "Profile updated",
        "Your driver and vehicle details have been saved.",
      );
    } catch (error) {
      console.error("Profile save failed:", error);

      Alert.alert(
        "Unable to save",
        "An unexpected error occurred while updating the profile.",
      );
    } finally {
      setSaving(false);
    }
  };

  const performLogout = async () => {
    try {
      await logout();
      router.replace("/login" as any);
    } catch (error) {
      console.error("Logout failed:", error);

      Alert.alert(
        "Unable to sign out",
        "Please try signing out again.",
      );
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      void performLogout();
      return;
    }

    Alert.alert(
      "Sign out",
      "Are you sure you want to sign out of Drive Legal?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Sign out",
          style: "destructive",
          onPress: () => {
            void performLogout();
          },
        },
      ],
    );
  };

  const handleContactSupport = async () => {
    const driverName = encodeURIComponent(user?.name ?? "");
    const licenceNumber = encodeURIComponent(
      user?.licenceNumber ?? "",
    );

    const supportUrl =
      "mailto:support@drivelegal.app" +
      "?subject=Drive%20Legal%20Support%20Request" +
      "&body=Hello%2C%0A%0A" +
      "I%20need%20help%20with%20Drive%20Legal.%0A%0A" +
      `Driver%3A%20${driverName}%0A` +
      `Licence%3A%20${licenceNumber}%0A%0A` +
      "%5BPlease%20describe%20your%20issue%20here%5D";

    try {
      const supported = await Linking.canOpenURL(supportUrl);

      if (!supported) {
        throw new Error("Mail application is unavailable.");
      }

      await Linking.openURL(supportUrl);
    } catch {
      Alert.alert(
        "Contact support",
        "Please email support@drivelegal.app directly.",
      );
    }
  };

  const handleBack = () => {
    if (editing) {
      Alert.alert(
        "Discard changes?",
        "Your unsaved profile changes will be lost.",
        [
          {
            text: "Keep editing",
            style: "cancel",
          },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              handleCancelEditing();

              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/more" as any);
              }
            },
          },
        ],
      );

      return;
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/more" as any);
    }
  };

  if (!user) {
    return (
      <ScreenContainer style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.white} />
        <Text style={styles.loadingText}>Loading profile…</Text>
      </ScreenContainer>
    );
  }

  const avatarLetter = (user.name ?? "D")
    .trim()
    .charAt(0)
    .toUpperCase() || "D";

  return (
    <ScreenContainer style={styles.screen}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.75}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>

        <View style={styles.headerMainRow}>
          <View style={styles.brandRow}>
            <Image
              source={require("@/assets/images/icon.png")}
              style={styles.logo}
              resizeMode="cover"
            />

            <View style={styles.brandTextContainer}>
              <Text style={styles.brandName}>
                DRIVE <Text style={styles.brandLegal}>LEGAL</Text>
              </Text>
              <Text style={styles.headerPageTitle}>Driver Profile</Text>
            </View>
          </View>

          {!editing ? (
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => setEditing(true)}
              activeOpacity={0.75}
            >
              <Text style={styles.editButtonIcon}>✎</Text>
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.editActions}>
              <TouchableOpacity
                style={styles.cancelEditButton}
                onPress={handleCancelEditing}
                activeOpacity={0.75}
                disabled={saving}
              >
                <Text style={styles.cancelEditText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.saveButton,
                  saving && styles.buttonDisabled,
                ]}
                onPress={() => {
                  void handleSave();
                }}
                activeOpacity={0.75}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.white}
                  />
                ) : (
                  <>
                    <Text style={styles.saveButtonIcon}>✓</Text>
                    <Text style={styles.saveButtonText}>Save</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <View style={styles.contentPanel}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.identitySection}>
            <View style={styles.avatarOuter}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{avatarLetter}</Text>
              </View>
            </View>

            <Text style={styles.profileName}>
             
