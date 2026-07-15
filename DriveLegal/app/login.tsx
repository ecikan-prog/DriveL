import { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuthContext();

  const passwordInputRef = useRef<TextInput>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = email.trim().toLowerCase();
  const canSubmit =
    normalizedEmail.length > 0 &&
    password.trim().length > 0 &&
    !loading;

  const handleLogin = async () => {
    if (loading) return;

    setError("");

    if (!normalizedEmail || !password.trim()) {
      setError("Please enter your email address and password.");
      return;
    }

    if (!normalizedEmail.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      const result = await login(normalizedEmail, password);

      if (result.success) {
        router.replace("/");
        return;
      }

      if (result.verificationRequired) {
        router.push({
          pathname: "/verify-email",
          params: {
            email: result.email ?? normalizedEmail,
          },
        } as any);
        return;
      }

      setError(
        result.error ??
          "Unable to sign in. Please check your details and try again."
      );
    } catch {
      setError(
        "Unable to connect to Drive Legal. Please check your internet connection and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer
      edges={["top", "left", "right"]}
      containerClassName="bg-[#3156D3]"
      safeAreaClassName="bg-[#3156D3]"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View
            style={{
              backgroundColor: "#3156D3",
              paddingHorizontal: 24,
              paddingTop: 28,
              paddingBottom: 34,
              alignItems: "center",
              borderBottomLeftRadius: 34,
              borderBottomRightRadius: 34,
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 22,
                backgroundColor: "#FFFFFF",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20,
                shadowColor: "#000000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.16,
                shadowRadius: 12,
                elevation: 6,
              }}
            >
              <Image
                source={require("../assets/images/icon.png")}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 18,
                }}
                resizeMode="cover"
              />
            </View>

            <Text
              style={{
                color: "#FFFFFF",
                fontSize: 31,
                fontWeight: "900",
                letterSpacing: 0.8,
              }}
            >
              DRIVE{" "}
              <Text style={{ color: "#65E58A" }}>
                LEGAL
              </Text>
            </Text>

            <Text
              style={{
                color: "#CAD6FF",
                fontSize: 13,
                fontWeight: "700",
                letterSpacing: 3,
                marginTop: 6,
              }}
            >
              DRIVER LOGBOOK
            </Text>
          </View>

          {/* Login form */}
          <View
            style={{
              flex: 1,
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 24,
              paddingTop: 30,
              paddingBottom: 28,
            }}
          >
            <Text
              style={{
                color: "#12386E",
                fontSize: 31,
                fontWeight: "800",
                marginBottom: 8,
              }}
            >
              Sign In
            </Text>

            <Text
              style={{
                color: "#71809F",
                fontSize: 16,
                lineHeight: 24,
                marginBottom: 26,
              }}
            >
              Sign in to your Drive Legal account to continue.
            </Text>

            {error ? (
              <View
                style={{
                  backgroundColor: "#FEF2F2",
                  borderColor: "#FECACA",
                  borderWidth: 1,
                  borderRadius: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  marginBottom: 18,
                  flexDirection: "row",
                  alignItems: "flex-start",
                }}
              >
                <MaterialIcons
                  name="error-outline"
                  size={19}
                  color="#B91C1C"
                />
                <Text
                  style={{
                    color: "#B91C1C",
                    fontSize: 13,
                    lineHeight: 19,
                    marginLeft: 8,
                    flex: 1,
                  }}
                >
                  {error}
                </Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{
                  color: "#12386E",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                  marginBottom: 8,
                }}
              >
                EMAIL ADDRESS
              </Text>

              <View
                style={{
                  minHeight: 58,
                  borderWidth: 1,
                  borderColor: "#CED9EF",
                  borderRadius: 15,
                  backgroundColor: "#F8FAFF",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 15,
                }}
              >
                <MaterialIcons
                  name="mail-outline"
                  size={21}
                  color="#8798B9"
                />

                <TextInput
                  style={{
                    flex: 1,
                    color: "#102A4C",
                    fontSize: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                  }}
                  placeholder="your@email.com"
                  placeholderTextColor="#9BA8C0"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (error) setError("");
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() =>
                    passwordInputRef.current?.focus()
                  }
                />
              </View>
            </View>

            {/* Password */}
            <View style={{ marginBottom: 22 }}>
              <Text
                style={{
                  color: "#12386E",
                  fontSize: 12,
                  fontWeight: "800",
                  letterSpacing: 1.1,
                  marginBottom: 8,
                }}
              >
                PASSWORD
              </Text>

              <View
                style={{
                  minHeight: 58,
                  borderWidth: 1,
                  borderColor: "#CED9EF",
                  borderRadius: 15,
                  backgroundColor: "#F8FAFF",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingLeft: 15,
                }}
              >
                <MaterialIcons
                  name="lock-outline"
                  size={21}
                  color="#8798B9"
                />

                <TextInput
                  ref={passwordInputRef}
                  style={{
                    flex: 1,
                    color: "#102A4C",
                    fontSize: 16,
                    paddingHorizontal: 12,
                    paddingVertical: 14,
                  }}
                  placeholder="Enter your password"
                  placeholderTextColor="#9BA8C0"
                  value={password}
                  onChangeText={(value) => {
                    setPassword(value);
                    if (error) setError("");
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword((current) => !current)
                  }
                  style={{
                    paddingHorizontal: 15,
                    paddingVertical: 16,
                  }}
                  accessibilityLabel={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
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
            </View>

            {/* Sign-in button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={!canSubmit}
              activeOpacity={0.85}
              style={{
                minHeight: 58,
                borderRadius: 15,
                backgroundColor: canSubmit
                  ? "#3156D3"
                  : "#AEBCE3",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                shadowColor: "#3156D3",
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: canSubmit ? 0.2 : 0,
                shadowRadius: 10,
                elevation: canSubmit ? 4 : 0,
              }}
            >
              {loading ? (
                <>
                  <ActivityIndicator color="#FFFFFF" />
                  <Text
                    style={{
                      color: "#FFFFFF",
                      fontSize: 16,
                      fontWeight: "800",
                      marginLeft: 10,
                    }}
                  >
                    Signing In...
                  </Text>
                </>
              ) : (
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontSize: 17,
                    fontWeight: "800",
                  }}
                >
                  Sign In
                </Text>
              )}
            </TouchableOpacity>

            {/* Account links */}
            <TouchableOpacity
              style={{
                alignItems: "center",
                paddingVertical: 18,
              }}
              onPress={() =>
                router.push("/forgot-password")
              }
            >
              <Text
                style={{
                  color: "#3156D3",
                  fontSize: 15,
                  fontWeight: "700",
                }}
              >
                Forgot password?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                alignItems: "center",
                paddingVertical: 6,
              }}
              onPress={() => router.push("/register")}
            >
              <Text
                style={{
                  color: "#71809F",
                  fontSize: 15,
                }}
              >
                Don&apos;t have an account?{" "}
                <Text
                  style={{
                    color: "#3156D3",
                    fontWeight: "800",
                  }}
                >
                  Sign Up
                </Text>
              </Text>
            </TouchableOpacity>

            {/* Legal links */}
            <View
              style={{
                marginTop: 28,
                alignItems: "center",
                paddingHorizontal: 16,
              }}
            >
              <Text
                style={{
                  color: "#8793AA",
                  fontSize: 11,
                  lineHeight: 17,
                  textAlign: "center",
                }}
              >
                By continuing, you acknowledge the{" "}
                <Text
                  style={{
                    color: "#3156D3",
                    fontWeight: "700",
                  }}
                  onPress={() =>
                    router.push("/terms-of-service")
                  }
                >
                  Terms of Service
                </Text>{" "}
                and{" "}
                <Text
                  style={{
                    color: "#3156D3",
                    fontWeight: "700",
                  }}
                  onPress={() =>
                    router.push("/privacy-policy")
                  }
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
} 
