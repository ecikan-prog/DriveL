import { useEffect, useRef, useState } from "react";
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
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { resetPasswordWithToken } from "@/lib/cloud-sync";
import { hashPassword } from "@/lib/local-auth";

const COLORS = {
  blue: "#3658D8",
  blueDark: "#2347C0",
  blueDisabled: "#AABBE9",
  navy: "#123B73",
  green: "#54DD83",
  page: "#F5F7FC",
  white: "#FFFFFF",
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

export default function ResetPasswordScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    token?: string | string[];
  }>();

  const confirmInputRef = useRef<TextInput>(null);

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");
  const [showPassword, setShowPassword] =
    useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const suppliedToken = Array.isArray(params.token)
      ? params.token[0]
      : params.token;

    setToken(
      typeof suppliedToken === "string"
        ? suppliedToken.trim()
        : ""
    );
  }, [params.token]);

  const passwordValid = password.length >= 10;
  const passwordsMatch =
    password.length > 0 &&
    password === confirmPassword;

  const canSubmit =
    Boolean(token) &&
    passwordValid &&
    passwordsMatch &&
    !loading;

  const handleSubmit = async () => {
    if (loading) {
      return;
    }

    setError("");

    if (!token) {
      setError(
        "This password-reset link is invalid or incomplete. Please request a new reset link."
      );
      return;
    }

    if (!password || !confirmPassword) {
      setError("Please complete both password fields.");
      return;
    }

    if (password.length < 10) {
      setError(
        "Your new password must contain at least 10 characters."
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const passwordHash = hashPassword(password);

      const result = await resetPasswordWithToken(
        token,
        passwordHash
      );

      if (!result.success) {
        throw new Error(
          result.error ||
            "Drive Legal could not reset your password."
        );
      }

      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (e: any) {
      setError(
        e?.message ||
          "Unable to reset your password. Please request a new reset link and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    router.replace("/login" as any);
  };

  return (
    <ScreenContainer
      edges={["top", "bottom", "left", "right"]}
      containerClassName="bg-[#3658D8]"
      safeAreaClassName="bg-[#3658D8]"
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
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
                name={
                  success
                    ? "check-circle-outline"
                    : "lock-reset"
                }
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
            {success ? (
              <>
                <View style={styles.successIcon}>
                  <MaterialIcons
                    name="check"
                    size={42}
                    color={COLORS.white}
                  />
                </View>

                <Text style={styles.successTitle}>
                  Password Updated
                </Text>

                <Text style={styles.successText}>
                  Your Drive Legal password has been reset
                  successfully. You can now sign in using your
                  new password.
                </Text>

                <View style={styles.successBox}>
                  <MaterialIcons
                    name="verified-user"
                    size={21}
                    color={COLORS.success}
                  />

                  <Text style={styles.successBoxText}>
                    Your previous password can no longer be used
                    to sign in.
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={handleBackToLogin}
                  activeOpacity={0.85}
                  style={styles.primaryButton}
                >
                  <MaterialIcons
                    name="login"
                    size={21}
                    color={COLORS.white}
                  />

                  <Text style={styles.primaryButtonText}>
                    Sign In
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.titleSection}>
                  <Text style={styles.title}>
                    Reset Password
                  </Text>

                  <Text style={styles.subtitle}>
                    Enter a secure new password for your Drive
                    Legal account.
                  </Text>
                </View>

                {!token ? (
                  <View style={styles.errorBox}>
                    <MaterialIcons
                      name="error-outline"
                      size={21}
                      color={COLORS.error}
                    />

                    <Text style={styles.errorText}>
                      This reset link is invalid or incomplete.
                      Please request a new password-reset email.
                    </Text>
                  </View>
                ) : null}

                {error ? (
                  <View style={styles.errorBox}>
                    <MaterialIcons
                      name="error-outline"
                      size={21}
                      color={COLORS.error}
                    />

                    <Text style={styles.errorText}>
                      {error}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.field}>
                  <Text style={styles.label}>
                    NEW PASSWORD
                  </Text>

                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="lock-outline"
                      size={21}
                      color="#8798B9"
                    />

                    <TextInput
                      style={styles.input}
                      placeholder="Minimum 10 characters"
                      placeholderTextColor="#9BA8C0"
                      value={password}
                      onChangeText={(value) => {
                        setPassword(value);

                        if (error) {
                          setError("");
                        }
                      }}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="next"
                      editable={!loading && Boolean(token)}
                      onSubmitEditing={() =>
                        confirmInputRef.current?.focus()
                      }
                    />

                    <TouchableOpacity
                      onPress={() =>
                        setShowPassword((current) => !current)
                      }
                      disabled={loading}
                      accessibilityLabel={
                        showPassword
                          ? "Hide new password"
                          : "Show new password"
                      }
                      style={styles.visibilityButton}
                    >
                      <MaterialIcons
                        name={
                          showPassword
                            ? "visibility-off"
                            : "visibility"
                        }
                        size={21}
                        color="#71809F"
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.requirementRow}>
                    <MaterialIcons
                      name={
                        passwordValid
                          ? "check-circle"
                          : "radio-button-unchecked"
                      }
                      size={16}
                      color={
                        passwordValid
                          ? COLORS.success
                          : COLORS.muted
                      }
                    />

                    <Text
                      style={[
                        styles.requirementText,
                        passwordValid &&
                          styles.requirementTextValid,
                      ]}
                    >
                      At least 10 characters
                    </Text>
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>
                    CONFIRM PASSWORD
                  </Text>

                  <View style={styles.inputContainer}>
                    <MaterialIcons
                      name="lock-outline"
                      size={21}
                      color="#8798B9"
                    />

                    <TextInput
                      ref={confirmInputRef}
                      style={styles.input}
                      placeholder="Re-enter your new password"
                      placeholderTextColor="#9BA8C0"
                      value={confirmPassword}
                      onChangeText={(value) => {
                        setConfirmPassword(value);

                        if (error) {
                          setError("");
                        }
                      }}
                      secureTextEntry={!showConfirmPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="done"
                      editable={!loading && Boolean(token)}
                      onSubmitEditing={() => {
                        if (canSubmit) {
                          void handleSubmit();
                        }
                      }}
                    />

                    <TouchableOpacity
                      onPress={() =>
                        setShowConfirmPassword(
                          (current) => !current
                        )
                      }
                      disabled={loading}
                      accessibilityLabel={
                        showConfirmPassword
                          ? "Hide confirmed password"
                          : "Show confirmed password"
                      }
                      style={styles.visibilityButton}
                    >
                      <MaterialIcons
                        name={
                          showConfirmPassword
                            ? "visibility-off"
                            : "visibility"
                        }
                        size={21}
                        color="#71809F"
                      />
                    </TouchableOpacity>
                  </View>

                  {confirmPassword.length > 0 ? (
                    <View style={styles.requirementRow}>
                      <MaterialIcons
                        name={
                          passwordsMatch
                            ? "check-circle"
                            : "cancel"
                        }
                        size={16}
                        color={
                          passwordsMatch
                            ? COLORS.success
                            : COLORS.error
                        }
                      />

                      <Text
                        style={[
                          styles.requirementText,
                          passwordsMatch
                            ? styles.requirementTextValid
                            : styles.requirementTextError,
                        ]}
                      >
                        {passwordsMatch
                          ? "Passwords match"
                          : "Passwords do not match"}
                      </Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity
                  onPress={() => void handleSubmit()}
                  disabled={!canSubmit}
                  activeOpacity={0.85}
                  style={[
                    styles.primaryButton,
                    !canSubmit &&
                      styles.primaryButtonDisabled,
                  ]}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator
                        color={COLORS.white}
                      />

                      <Text
                        style={
                          styles.primaryButtonLoadingText
                        }
                      >
                        Updating Password...
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons
                        name="lock-reset"
                        size={22}
                        color={COLORS.white}
                      />

                      <Text
                        style={styles.primaryButtonText}
                      >
                        Update Password
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleBackToLogin}
                  activeOpacity={0.75}
                  style={styles.backButton}
                >
                  <MaterialIcons
                    name="arrow-back"
                    size={19}
                    color={COLORS.blue}
                  />

                  <Text style={styles.backButtonText}>
                    Back to Sign In
                  </Text>
                </TouchableOpacity>

                <View style={styles.infoBox}>
                  <MaterialIcons
                    name="security"
                    size={21}
                    color={COLORS.blue}
                  />

                  <Text style={styles.infoText}>
                    For your security, use a password that you
                    have not used for another account.
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
    paddingTop: 28,
    paddingBottom: 30,
  },

  lockContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
    marginBottom: 17,
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
    width: "100%",
    maxWidth: 620,
    alignSelf: "center",
    backgroundColor: COLORS.page,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 30,
    paddingBottom: 36,
  },

  titleSection: {
    alignItems: "center",
    marginBottom: 26,
  },

  title: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    textAlign: "center",
  },

  subtitle: {
    maxWidth: 380,
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
    marginBottom: 20,
  },

  label: {
    marginBottom: 8,
    marginLeft: 3,
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },

  inputContainer: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    paddingLeft: 15,
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 15,
    outlineStyle: "none" as any,
  },

  visibilityButton: {
    paddingHorizontal: 15,
    paddingVertical: 17,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 3,
  },

  requirementText: {
    marginLeft: 6,
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "500",
  },

  requirementTextValid: {
    color: COLORS.success,
  },

  requirementTextError: {
    color: COLORS.error,
  },

  primaryButton: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    backgroundColor: COLORS.blue,
    marginTop: 4,
  },

  primaryButtonDisabled: {
    backgroundColor: COLORS.blueDisabled,
  },

  primaryButtonText: {
    marginLeft: 9,
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "800",
  },

  primaryButtonLoadingText: {
    marginLeft: 10,
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },

  backButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },

  backButtonText: {
    marginLeft: 7,
    color: COLORS.blue,
    fontSize: 15,
    fontWeight: "700",
  },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 17,
    backgroundColor: COLORS.info,
  },

  infoText: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "500",
  },

  successIcon: {
    width: 82,
    height: 82,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 41,
    backgroundColor: COLORS.success,
    marginTop: 12,
    marginBottom: 22,
  },

  successTitle: {
    color: COLORS.navy,
    fontSize: 30,
    lineHeight: 37,
    fontWeight: "800",
    textAlign: "center",
  },

  successText: {
    maxWidth: 390,
    alignSelf: "center",
    marginTop: 12,
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 23,
    fontWeight: "500",
    textAlign: "center",
  },

  successBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: COLORS.successBorder,
    borderRadius: 16,
    backgroundColor: COLORS.successBackground,
  },

  successBoxText: {
    flex: 1,
    marginLeft: 10,
    color: COLORS.success,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
  },
});
