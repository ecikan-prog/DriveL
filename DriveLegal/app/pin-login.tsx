import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  markPinSessionUnlocked,
  verifyPin,
} from "@/lib/pin-security";

const MAX_ATTEMPTS = 5;

const COLORS = {
  blue: "#3658D8",
  blueDisabled: "#AABBE9",
  green: "#54DD83",
  page: "#F5F7FC",
  white: "#FFFFFF",
  navy: "#123B73",
  text: "#17365F",
  muted: "#7183A5",
  border: "#D5DFF0",
  info: "#EEF3FD",
  error: "#B91C1C",
  errorBackground: "#FEF2F2",
  errorBorder: "#FECACA",
};

export default function PinLoginScreen() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const inputRef = useRef<TextInput>(null);

  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 300);

    return () => clearTimeout(timer);
  }, [user?.id]);

  const handleUnlock = async (enteredPin: string) => {
    if (!/^\d{4}$/.test(enteredPin)) {
      setError("Please enter your 4-digit PIN.");
      return;
    }

    if (!user?.id) {
      setError(
        "Your account could not be identified. Please sign in again."
      );
      return;
    }

    if (loading || attempts >= MAX_ATTEMPTS) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const valid = await verifyPin(user.id, enteredPin);

      if (valid) {
        markPinSessionUnlocked(user.id);

        setPin("");
        setAttempts(0);

        router.replace("/" as any);
        return;
      }

      const nextAttempts = attempts + 1;
      const remaining = MAX_ATTEMPTS - nextAttempts;

      setAttempts(nextAttempts);
      setPin("");

      if (nextAttempts >= MAX_ATTEMPTS) {
        setError(
          "Too many incorrect attempts. Please sign in using your email and password."
        );
        return;
      }

      setError(
        `Incorrect PIN. ${remaining} ${
          remaining === 1 ? "attempt" : "attempts"
        } remaining.`
      );

      setTimeout(() => {
        inputRef.current?.focus();
      }, 250);
    } catch (e: any) {
      setPin("");

      setError(
        e?.message ||
          "Drive Legal could not verify your PIN. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePinChange = (value: string) => {
    if (loading || attempts >= MAX_ATTEMPTS) {
      return;
    }

    const digitsOnly = value.replace(/\D/g, "").slice(0, 4);

    setPin(digitsOnly);
    setError("");

    if (digitsOnly.length === 4) {
      Keyboard.dismiss();
      void handleUnlock(digitsOnly);
    }
  };

 const handleEmailLogin = async () => {
  setPin("");
  setAttempts(0);
  setError("");

  await logout();

  router.replace("/login?resetPin=true" as any);
};

  const lockedOut = attempts >= MAX_ATTEMPTS;
  const accountMissing = !user?.id;

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
              <Text style={styles.brandWhite}>DRIVE </Text>
              <Text style={styles.brandGreen}>LEGAL</Text>
            </Text>

            <Text style={styles.brandSubtitle}>
              DRIVER LOGBOOK
            </Text>
          </View>

          <View style={styles.content}>
            <View style={styles.titleSection}>
              <Text style={styles.title}>Enter PIN</Text>

              <Text style={styles.subtitle}>
                Enter your 4-digit PIN to securely unlock Drive
                Legal.
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
                  continue with your email and password.
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

                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              disabled={lockedOut || accountMissing}
              style={[
                styles.pinArea,
                (lockedOut || accountMissing) &&
                  styles.pinAreaDisabled,
              ]}
            >
              <View style={styles.pinDots}>
                {[0, 1, 2, 3].map((index) => {
                  const completed = index < pin.length;

                  return (
                    <View
                      key={`pin-dot-${index}`}
                      style={[
                        styles.pinDot,
                        completed && styles.pinDotFilled,
                      ]}
                    />
                  );
                })}
              </View>

              <TextInput
                ref={inputRef}
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                maxLength={4}
                secureTextEntry
                autoFocus
                textContentType="oneTimeCode"
                accessibilityLabel="Four digit PIN"
                caretHidden
                editable={
                  !loading &&
                  !lockedOut &&
                  !accountMissing
                }
                style={styles.hiddenInput}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                if (pin.length === 4) {
                  void handleUnlock(pin);
                } else {
                  inputRef.current?.focus();
                }
              }}
              disabled={
                loading ||
                lockedOut ||
                accountMissing
              }
              activeOpacity={0.85}
              style={[
                styles.unlockButton,
                (loading ||
                  lockedOut ||
                  accountMissing) &&
                  styles.unlockButtonDisabled,
              ]}
            >
              {loading ? (
                <>
                  <ActivityIndicator color={COLORS.white} />

                  <Text style={styles.unlockButtonTextLoading}>
                    Checking PIN...
                  </Text>
                </>
              ) : (
                <Text style={styles.unlockButtonText}>
                  Unlock
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />

              <Text style={styles.dividerText}>OR</Text>

              <View style={styles.divider} />
            </View>

            <TouchableOpacity
              onPress={handleEmailLogin}
              activeOpacity={0.8}
              style={styles.emailButton}
            >
              <MaterialIcons
                name="mail-outline"
                size={20}
                color={COLORS.blue}
              />

              <Text style={styles.emailButtonText}>
                Continue with Email
              </Text>
            </TouchableOpacity>

            <View style={styles.infoBox}>
              <MaterialIcons
                name="info-outline"
                size={21}
                color={COLORS.blue}
              />

              <Text style={styles.infoText}>
                Forgotten your PIN? Continue with your email and
                password to sign in securely.
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
    marginBottom: 28,
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
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
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

  pinArea: {
    height: 92,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },

  pinAreaDisabled: {
    opacity: 0.6,
  },

  pinDots: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 22,
  },

  pinDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    borderColor: "#B6C5E3",
    backgroundColor: COLORS.white,
  },

  pinDotFilled: {
    borderColor: COLORS.blue,
    backgroundColor: COLORS.blue,
  },

  hiddenInput: {
    ...StyleSheet.absoluteFillObject,
    color: "transparent",
    backgroundColor: "transparent",
  },

  unlockButton: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    marginTop: 24,
  },

  unlockButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },

  unlockButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },

  unlockButtonTextLoading: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 22,
  },

  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#D8E0EE",
  },

  dividerText: {
    marginHorizontal: 14,
    color: "#9AA8BF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
  },

  emailButton: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.blue,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },

  emailButtonText: {
    marginLeft: 9,
    color: COLORS.blue,
    fontSize: 16,
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

  infoText: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },
});
