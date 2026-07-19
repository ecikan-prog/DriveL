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
          style={[
            styles.selectorText,
            !value && styles.selectorPlaceholder,
          ]}
        >
          {value || placeholder}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
