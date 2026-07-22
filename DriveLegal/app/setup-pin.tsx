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
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
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
  muted: "#7183A5",
  border: "#D5DFF0",
  info: "#EEF3FD",
  error: "#DC2626",
  errorBackground: "#FEF2F2",
  errorBorder: "#FECACA",
};

export default function SetupPinScreen() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const params = useLocalSearchParams<{
    next?: string | string[];
  }>();

  const confirmInputRef = useRef<TextInput>(null);

  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const userId = user?.id;

  const pinComplete = pin.length === 4;
  const confirmComplete = confirmPin.length === 4;
  const accountMissing = !userId;

  const canSubmit = useMemo(
    () =>
      Boolean(userId) &&
      pinComplete &&
      confirmComplete &&
      pin === confirmPin &&
      !loading,
    [
      userId,
      pin,
      confirmPin,
      pinComplete,
      confirmComplete,
      loading,
    ]
  );

  const handlePinChange = (value: string) => {
    if (loading) {
      return;
    }

    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);

    setPin(digitsOnly);
    setError("");

    if (digitsOnly.length === 4) {
      setTimeout(() => {
        confirmInputRef.current?.focus();
      }, 100);
    }
  };

  const handleConfirmPinChange = (value: string) => {
    if (loading) {
      return;
    }

    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);

    setConfirmPin(digitsOnly);
    setError("");
  };

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    setError("");

    if (!userId) {
      setError(
        "Your account could not be identified. Please sign in again."
      );
      return;
    }

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
      await savePin(userId, pin);
      markPinSessionUnlocked(userId);

      const requestedNextRoute = Array.isArray(params.next)
        ? params.next[0]
        : params.next;

      const nextRoute =
        typeof requestedNextRoute === "string" &&
        requestedNextRoute.startsWith("/") &&
        !requestedNextRoute.startsWith("//")
          ? requestedNextRoute
          : "/";

      setPin("");
      setConfirmPin("");

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

  const handleReturnToLogin = async () => {
    setPin("");
    setConfirmPin("");
    setError("");

    try {
      await logout();
    } finally {
      router.replace("/login" as any);
    }
  };

  const renderPinDots = (
    length: number,
    prefix: string
  ) => (
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
      edges={["top", "bottom", "left", "right"]}
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
          bounces={false}
        >
          <View style={styles.header}>
            <View style={styles.lockContainer}>
              <MaterialIcons
                name="lock-outline"
                size={42}
                color={COLORS.blue}
              />
            </View>

            <Text style={styles.brand}>
              <Text style={styles.brandWhite}>
                DRIVE{" "}
              </Text>

              <Text style={styles.brandGreen}>
                LEGAL
              </Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              DRIVER LOGBOOK
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>
                Create Your PIN
              </Text>

              <Text style={styles.subtitle}>
                Create a secure 4-digit PIN for faster access
                to your Drive Legal logbook.
              </Text>
            </View>

            {accountMissing ? (
              <View style={styles.errorBox}>
                <MaterialIcons
                  name="error-outline"
                  size={20}
                  color={COLORS.error}
                />

                <Text style={styles.errorText}>
                  Your account could not be identified. Please
                  return to login and sign in again.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View style={styles.errorBox}>
                <MaterialIcons
                  name="error-outline"
                  size={20}
                  color={COLORS.error}
                />

                <Text style={styles.errorText}>
                  {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>
                NEW PIN
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  accountMissing &&
                    styles.inputContainerDisabled,
                ]}
              >
                <TextInput
                  style={styles.hiddenInput}
                  value={pin}
                  onChangeText={handlePinChange}
                  keyboardType="number-pad"
                  secureTextEntry
                  maxLength={4}
                  autoFocus={!accountMissing}
                  textContentType="oneTimeCode"
                  caretHidden
                  editable={!loading && !accountMissing}
                  accessibilityLabel="New four digit PIN"
                />

                {renderPinDots(pin.length, "pin")}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>
                CONFIRM PIN
              </Text>

              <View
                style={[
                  styles.inputContainer,
                  accountMissing &&
                    styles.inputContainerDisabled,
                ]}
              >
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
                  onSubmitEditing={() => {
                    if (canSubmit) {
                      void handleSubmit();
                    }
                  }}
                  caretHidden
                  editable={!loading && !accountMissing}
                  accessibilityLabel="Confirm four digit PIN"
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
                !canSubmit &&
                  styles.saveButtonDisabled,
              ]}
              disabled={!canSubmit}
              onPress={() => void handleSubmit()}
              activeOpacity={0.85}
            >
              {loading ? (
                <>
                  <ActivityIndicator
                    color={COLORS.white}
                  />

                  <Text
                    style={
                      styles.saveButtonLoadingText
                    }
                  >
                    Saving PIN...
                  </Text>
                </>
              ) : (
                <Text style={styles.saveButtonText}>
                  Save PIN
                </Text>
              )}
            </TouchableOpacity>

            {accountMissing ? (
              <TouchableOpacity
                onPress={() =>
                  void handleReturnToLogin()
                }
                activeOpacity={0.8}
                style={styles.loginButton}
              >
                <MaterialIcons
                  name="mail-outline"
                  size={20}
                  color={COLORS.blue}
                />

                <Text style={styles.loginButtonText}>
                  Return to Login
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.infoBox}>
              <MaterialIcons
                name="info-outline"
                size={22}
                color={COLORS.blue}
              />

              <Text style={styles.infoText}>
                Your PIN is stored securely for this account
                on this device. It cannot be used to unlock a
                different Drive Legal account.
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
    paddingTop: 26,
    paddingBottom: 28,
  },

  lockContainer: {
    width: 70,
    height: 70,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },

  brand: {
    fontSize: 34,
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
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 3.5,
  },

  content: {
    flex: 1,
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 32,
  },

  titleSection: {
    alignItems: "center",
    marginBottom: 24,
  },

  title: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 350,
    marginTop: 9,
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    textAlign: "center",
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 18,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 14,
    backgroundColor: COLORS.errorBackground,
  },

  errorText: {
    flex: 1,
    marginLeft: 9,
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },

  field: {
    marginBottom: 18,
  },

  label: {
    marginBottom: 8,
    marginLeft: 3,
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1,
  },

  inputContainer: {
    height: 72,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },

  inputContainerDisabled: {
    opacity: 0.55,
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
    flexDirection: "row",
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

  saveButtonLoadingText: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  loginButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },

  loginButtonText: {
    marginLeft: 9,
    color: COLORS.blue,
    fontSize: 16,
    fontWeight: "800",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 18,
    backgroundColor: COLORS.info,
  },

  infoText: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
});
