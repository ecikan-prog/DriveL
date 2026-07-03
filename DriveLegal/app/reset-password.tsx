import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { resetPasswordWithToken } from "@/lib/cloud-sync";
import { hashPassword } from "@/lib/local-auth";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (params.token) {
      setToken(params.token);
    }
  }, [params.token]);

  const handleSubmit = async () => {
    setError("");
    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }
    if (password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("Invalid or missing reset token.");
      return;
    }

    setLoading(true);
    try {
      const hash = hashPassword(password);
      const result = await resetPasswordWithToken(token, hash);
      if (result.success) {
        setSuccess(true);
      } else {
        setError(result.error || "Failed to reset password.");
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center pt-12 pb-6 px-6">
            <Text className="text-3xl font-bold text-white tracking-tight">
              <Text className="text-white">DRIVE </Text>
              <Text style={{ color: "#4ADE80" }}>LEGAL</Text>
            </Text>
            <Text className="text-sm text-blue-200 mt-1 tracking-widest uppercase">
              DRIVER LOGBOOK
            </Text>
          </View>

          {/* Card */}
          <View className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6">
            {success ? (
              <>
                <View className="items-center py-8">
                  <Text className="text-4xl mb-4">✅</Text>
                  <Text className="text-2xl font-bold text-[#003366] mb-2">Password Updated</Text>
                  <Text className="text-sm text-[#6B7A99] text-center leading-relaxed">
                    Your password has been successfully reset. You can now sign in with your new password.
                  </Text>
                </View>
                <TouchableOpacity
                  className="bg-[#5980E9] rounded-xl py-4 items-center active:opacity-80"
                  onPress={() => router.replace("/login" as any)}
                >
                  <Text className="text-white font-bold text-base">Sign In</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-2xl font-bold text-[#003366] mb-1">Reset Password</Text>
                <Text className="text-sm text-[#6B7A99] mb-6 leading-relaxed">
                  Enter your new password below.
                </Text>

                {error ? (
                  <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                    <Text className="text-red-600 text-sm">{error}</Text>
                  </View>
                ) : null}

                <View className="gap-4">
                  <View>
                    <Text className="text-xs font-semibold text-[#003366] uppercase tracking-wide mb-1.5">
                      New Password
                    </Text>
                    <TextInput
                      className="border border-[#D1DCF0] rounded-xl px-4 py-3.5 text-[#0D1B2A] bg-[#F8FAFF] text-base"
                      placeholder="Enter new password (min 10 characters)"
                      placeholderTextColor="#9BA8C0"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>

                  <View>
                    <Text className="text-xs font-semibold text-[#003366] uppercase tracking-wide mb-1.5">
                      Confirm Password
                    </Text>
                    <TextInput
                      className="border border-[#D1DCF0] rounded-xl px-4 py-3.5 text-[#0D1B2A] bg-[#F8FAFF] text-base"
                      placeholder="Re-enter new password"
                      placeholderTextColor="#9BA8C0"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      returnKeyType="done"
                      onSubmitEditing={handleSubmit}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  className="bg-[#5980E9] rounded-xl py-4 items-center mt-6 active:opacity-80"
                  onPress={handleSubmit}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <Text className="text-white font-bold text-base">Update Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  className="items-center mt-6"
                  onPress={() => router.replace("/login" as any)}
                >
                  <Text className="text-[#5980E9] text-sm">← Back to Sign In</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
