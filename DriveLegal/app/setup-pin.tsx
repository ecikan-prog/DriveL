import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  markPinSessionUnlocked,
  savePin,
} from "@/lib/pin-security";

const COLORS = {
  navy: "#123B73",
  blue: "#3658D8",
  blueDisabled: "#AABBE9",
  green: "#54DD83",
  page: "#F5F7FC",
  white: "#FFFFFF",
  text: "#17365F",
  muted: "#7183A5",
  border: "#D5DFF0",
  input: "#F8FAFE",
  info: "#EEF3FD",
  error: "#DC2626",
  errorBackground: "#FEF2F2",
  errorBorder: "#FECACA",
};

export default function SetupPinScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    next?: string;
  }>();

  const confirmInputRef = useRef<TextInput>(null);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const pinComplete = pin.length === 4;
  const confirmComplete = confirmPin.length === 4;

  const canSubmit = useMemo(
    () =>
      pinComplete &&
      confirmComplete &&
      pin === confirmPin &&
      !loading,
    [
      pin,
      confirmPin,
      pinComplete,
      confirmComplete,
      loading,
    ]
  );

  const handlePinChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);

    setPin(digitsOnly);
    setError("");

    if (digitsOnly.length === 4) {
      confirmInputRef.current?.focus();
    }
  };

  const handleConfirmPinChange = (value: string) => {
    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);

    setConfirmPin(digitsOnly);
    setError("");
  };

  const handleSubmit = async () => {
    setError("");

    if (!/^\d{4}$/.test(pin)) {
      setError("Please enter a 4-digit PIN.");
      return;
    }

    if (!/^\d{4}$/.test(confirmPin)) {
      setError("Please confirm your 4-digit PIN.");
      return;
    }

    if (pin !== confirmPin) {
      setError("The PIN numbers do not match.");
      return;
    }

    setLoading(true);

    try {
      await savePin(pin);
      markPinSessionUnlocked();

      const nextRoute =
        typeof params.next === "string" &&
        params.next.startsWith("/")
          ? params.next
          : "/";

      router.replace(nextRoute as any);
    } catch (e: any) {
      setError(
        e?.message ||
          "Your PIN could not be saved. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const renderPinDots = (length: number, prefix: string) => (
    <View style={styles.pinDots}>
      {[0, 1, 2, 3].map((index) => (
        <View
          key={`${prefix}-${index}`}
          style={[
            styles.pinDot,
            index < length && styles.pinDotFilled,
          ]}
        />
      ))}
    </View>
  );

  return (
    <ScreenContainer
      containerClassName="bg-[#3658D8]"
      safeAreaClassName="bg-[#3658D8]"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.lockContainer}>
              <Text style={styles.lockIcon}>🔒</Text>
            </View>

            <Text style={styles.brand}>
              <Text style={styles.brandWhite}>DRIVE </Text>
              <Text style={styles.brandGreen}>LEGAL</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              DRIVER LOGBOOK
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Create Your PIN</Text>

              <Text style={styles.subtitle}>
                Create a secure 4-digit PIN for faster access to
                your Drive Legal logbook.
              </Text>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>NEW PIN</Text>

              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.hiddenInput}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  autoFocus
                  textContentType="oneTimeCode"
                  caretHidden
                />

                {renderPinDots(pin.length, "pin")}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CONFIRM PIN</Text>

              <View style={styles.inputContainer}>
                <TextInput
                  ref={confirmInputRef}
                  style={styles.hiddenInput}
                  value={confirmPin}
                  onChangeText={handleConfirmPinChange}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  textContentType="oneTimeCode"
                  returnKeyType="done"
                  onSubmitEditing={handleSubmit}
                  caretHidden
                />

                {renderPinDots(
                  confirmPin.length,
                  "confirm-pin"
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.saveButton,
                !canSubmit && styles.saveButtonDisabled,
              ]}
              disabled={!canSubmit}
              onPress={handleSubmit}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  Save PIN
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <View style={styles.infoIcon}>
                <Text style={styles.infoIconText}>i</Text>
              </View>

              <Text style={styles.infoText}>
                Your PIN is securely stored only on this device.
                Drive Legal will never email or display your PIN.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    backgroundColor: COLORS.blue,
  },

  header: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 32,
  },

  lockContainer: {
    width: 74,
    height: 74,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    marginBottom: 18,
  },

  lockIcon: {
    fontSize: 34,
  },

  brand: {
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },

  brandWhite: {
    color: COLORS.white,
  },

  brandGreen: {
    color: COLORS.green,
  },

  brandSubtitle: {
    marginTop: 5,
    color: "#CAD5F8",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 4,
  },

  content: {
    flex: 1,
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 34,
    borderTopRightRadius: 34,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 28,
  },

  titleSection: {
    alignItems: "center",
    marginBottom: 26,
  },

  title: {
    color: COLORS.navy,
    fontSize: 31,
    lineHeight: 38,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 340,
    marginTop: 10,
    color: COLORS.muted,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "500",
    textAlign: "center",
  },

  errorBox: {
    marginBottom: 18,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 14,
    backgroundColor: COLORS.errorBackground,
  },

  errorText: {
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },

  field: {
    marginBottom: 20,
  },

  label: {
    marginBottom: 9,
    marginLeft: 3,
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },

  inputContainer: {
    height: 76,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },

  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    backgroundColor: "transparent",
  },

  pinDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },

  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2.5,
    borderColor: "#B6C5E3",
    backgroundColor: COLORS.white,
  },

  pinDotFilled: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },

  saveButton: {
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    marginTop: 4,
  },

  saveButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 22,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 18,
    backgroundColor: COLORS.info,
  },

  infoIcon: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: COLORS.blue,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
    marginTop: 1,
  },

  infoIconText: {
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: "800",
  },

  infoText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
});
