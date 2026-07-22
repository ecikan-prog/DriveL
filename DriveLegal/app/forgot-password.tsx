import { useState } from "react";
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
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { forgotPasswordRequest } from "@/lib/cloud-sync";

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
  input: "#F8FAFE",
  info: "#EEF3FD",
  error: "#B91C1C",
  errorBackground: "#FEF2F2",
  errorBorder: "#FECACA",
  success: "#15803D",
  successBackground: "#F0FDF4",
  successBorder: "#BBF7D0",
};

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setError("");

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      await forgotPasswordRequest(
        email.trim().toLowerCase()
      );

      setSent(true);
    } catch (e: any) {
      setError(
        e?.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

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
            <View style={styles.iconContainer}>
              <MaterialIcons
                name="lock-reset"
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
              <Text style={styles.title}>
                Forgot Password
              </Text>

              <Text style={styles.subtitle}>
                Enter the email address registered to your Drive
                Legal account. We will send you a secure password
                reset link.
              </Text>
            </View>

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

            {sent ? (
              <>
                <View style={styles.successBox}>
                  <MaterialIcons
                    name="check-circle-outline"
                    size={24}
                    color={COLORS.success}
                  />

                  <View style={styles.successContent}>
                    <Text style={styles.successTitle}>
                      Check your email
                    </Text>

                    <Text style={styles.successText}>
                      If an account exists for this email address,
                      we have sent a password reset link. Please
                      check your inbox and spam folder.
                    </Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => router.back()}
                  activeOpacity={0.85}
                >
                  <Text style={styles.primaryButtonText}>
                    Back to Sign In
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>
                    EMAIL ADDRESS
                  </Text>

                  <View style={styles.inputWrapper}>
                    <MaterialIcons
                      name="mail-outline"
                      size={21}
                      color={COLORS.muted}
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="your@email.com"
                      placeholderTextColor="#9BA8C0"
                      value={email}
                      onChangeText={(value) => {
                        setEmail(value);
                        setError("");
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    loading && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator
                        color={COLORS.white}
                      />

                      <Text style={styles.loadingText}>
                        Sending link...
                      </Text>
                    </>
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      Send Reset Link
                    </Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.back()}
                  activeOpacity={0.75}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={20}
                    color={COLORS.blue}
                  />

                  <Text style={styles.backButtonText}>
                    Back to Sign In
                  </Text>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                  <MaterialIcons
                    name="info-outline"
                    size={21}
                    color={COLORS.blue}
                  />

                  <Text style={styles.infoText}>
                    For your security, Drive Legal will not confirm
                    whether an email address is registered.
                  </Text>
                </View>
              </>
            )}
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

  iconContainer: {
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
    maxWidth: 350,
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

  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 18,
    backgroundColor: COLORS.successBackground,
  },

  successContent: {
    flex: 1,
    marginLeft: 11,
  },

  successTitle: {
    color: COLORS.success,
    fontSize: 16,
    fontWeight: "800",
  },

  successText: {
    marginTop: 5,
    color: "#3F6C4D",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
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

  inputWrapper: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 18,
    backgroundColor: COLORS.white,
  },

  input: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 15,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "500",
  },

  primaryButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: COLORS.blue,
    marginTop: 4,
  },

  primaryButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "800",
  },

  loadingText: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
    marginTop: 12,
  },

  backButtonText: {
    marginLeft: 7,
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: "800",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
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
