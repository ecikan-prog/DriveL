import { useState } from "react";
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
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { loginUser } from "@/lib/cloud-sync";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await loginUser(email.trim().toLowerCase(), password);
      router.replace("/");
    } catch (e: any) {
      setError(e?.message || "Invalid email or password. Please try again.");
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
            <Text className="text-2xl font-bold text-[#003366] mb-1">Sign In</Text>
            <Text className="text-sm text-[#6B7A99] mb-6 leading-relaxed">
              Sign in to your DriveLegal account to continue.
            </Text>

            {error ? (
              <View className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
                <Text className="text-red-600 text-sm">{error}</Text>
              </View>
            ) : null}

            <View className="mb-4">
              <Text className="text-xs font-semibold text-[#003366] uppercase tracking-wide mb-1.5">
                Email Address
              </Text>
              <TextInput
                className="border border-[#D1DCF0] rounded-xl px-4 py-3.5 text-[#0D1B2A] bg-[#F8FAFF] text-base"
                placeholder="your@email.com"
                placeholderTextColor="#9BA8C0"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            <View className="mb-6">
              <Text className="text-xs font-semibold text-[#003366] uppercase tracking-wide mb-1.5">
                Password
              </Text>
              <TextInput
                className="border border-[#D1DCF0] rounded-xl px-4 py-3.5 text-[#0D1B2A] bg-[#F8FAFF] text-base"
                placeholder="Enter your password"
                placeholderTextColor="#9BA8C0"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              className="bg-[#5980E9] rounded-xl py-4 items-center active:opacity-80"
              onPress={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              className="items-center mt-4"
              onPress={() => router.push("/forgot-password")}
            >
              <Text className="text-[#5980E9] text-sm">Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="items-center mt-3"
              onPress={() => router.push("/register")}
            >
              <Text className="text-[#6B7A99] text-sm">
                Don't have an account?{" "}
                <Text className="text-[#5980E9] font-semibold">Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
