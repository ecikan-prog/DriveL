/**
 * Verify Email Screen — shown after registration and when unverified users try to log in.
 * Handles two flows:
 * 1. After registration: shows "check your email" message with resend button
 * 2. From email link: processes the verification token and shows success/error
 */
import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { resendVerificationEmail, verifyEmailToken } from "@/lib/cloud-sync";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

export default function VerifyEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();
  const [status, setStatus] = useState<"pending" | "verifying" | "success" | "error">(
    params.token ? "verifying" : "pending"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // If we have a token, verify it immediately
  useEffect(() => {
    if (params.token) {
      handleVerifyToken(params.token);
    }
  }, [params.token]);

  async function handleVerifyToken(token: string) {
    setStatus("verifying");
    const result = await verifyEmailToken(token);
    if (result.success) {
      setStatus("success");
    } else {
      setStatus("error");
      setErrorMessage(result.error || "Verification failed. The link may have expired.");
    }
  }

  async function handleResend() {
    if (!params.email) return;
    setResendLoading(true);
    setResendSuccess(false);
    await resendVerificationEmail(params.email);
    setResendLoading(false);
    setResendSuccess(true);
  }

  function handleGoToLogin() {
    router.replace("/login" as any);
  }

  // Verifying state (processing token)
  if (status === "verifying") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#003366" />
          <Text className="text-lg text-foreground mt-4 font-semibold">Verifying your email...</Text>
          <Text className="text-sm text-muted mt-2 text-center">Please wait while we confirm your email address.</Text>
        </View>
      </ScreenContainer>
    );
  }

  // Success state (email verified)
  if (status === "success") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <View className="flex-1 items-center justify-center">
          <View className="w-20 h-20 rounded-full bg-success items-center justify-center mb-6" style={{ opacity: 0.15 }}>
            <MaterialIcons name="check-circle" size={48} color="#22C55E" />
          </View>
          <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ position: "absolute", top: "50%", marginTop: -120 }}>
            <MaterialIcons name="check-circle" size={48} color="#22C55E" />
          </View>
          <Text className="text-2xl font-bold text-foreground mb-2">Email Verified!</Text>
          <Text className="text-base text-muted text-center mb-8">
            Your email has been successfully verified. You can now sign in to Drive Legal.
          </Text>
          <TouchableOpacity
            onPress={handleGoToLogin}
            className="bg-primary px-8 py-4 rounded-xl active:opacity-80"
          >
            <Text className="text-white font-bold text-base">Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Error state (token expired or invalid)
  if (status === "error") {
    return (
      <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
        <View className="flex-1 items-center justify-center">
          <MaterialIcons name="error-outline" size={48} color="#EF4444" />
          <Text className="text-2xl font-bold text-foreground mt-4 mb-2">Verification Failed</Text>
          <Text className="text-base text-muted text-center mb-6">{errorMessage}</Text>
          {params.email && (
            <TouchableOpacity
              onPress={handleResend}
              disabled={resendLoading}
              className="bg-primary px-8 py-4 rounded-xl active:opacity-80 mb-4"
            >
              {resendLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-white font-bold text-base">Resend Verification Email</Text>
              )}
            </TouchableOpacity>
          )}
          {resendSuccess && (
            <Text className="text-sm text-success mb-4">Verification email sent! Check your inbox.</Text>
          )}
          <TouchableOpacity onPress={handleGoToLogin} className="mt-2">
            <Text className="text-primary font-semibold text-base">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScreenContainer>
    );
  }

  // Pending state (after registration — waiting for user to check email)
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="p-6">
      <View className="flex-1 items-center justify-center">
        <View className="w-20 h-20 rounded-full items-center justify-center mb-6" style={{ backgroundColor: "rgba(89, 128, 233, 0.12)" }}>
          <MaterialIcons name="mark-email-unread" size={40} color="#5980E9" />
        </View>
        <Text className="text-2xl font-bold text-foreground mb-2 text-center">Verify Your Email</Text>
        <Text className="text-base text-muted text-center mb-2">
          We've sent a verification link to:
        </Text>
        <Text className="text-base font-semibold text-foreground mb-6 text-center">
          {params.email || "your email address"}
        </Text>
        <Text className="text-sm text-muted text-center mb-8 px-4">
          Please check your inbox (and spam folder) and click the verification link to activate your account. The link expires in 24 hours.
        </Text>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resendLoading || resendSuccess}
          className="bg-primary px-8 py-4 rounded-xl active:opacity-80 mb-4"
          style={resendSuccess ? { opacity: 0.6 } : undefined}
        >
          {resendLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-base">
              {resendSuccess ? "Email Sent!" : "Resend Verification Email"}
            </Text>
          )}
        </TouchableOpacity>

        {resendSuccess && (
          <Text className="text-sm text-success mb-4">A new verification email has been sent.</Text>
        )}

        <TouchableOpacity onPress={handleGoToLogin} className="mt-4">
          <Text className="text-primary font-semibold text-base">Back to Sign In</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}
