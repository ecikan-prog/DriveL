import { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { ScreenContainer } from "@/components/screen-container";
import {
  markPinSessionUnlocked,
  savePin,
} from "@/lib/pin-security";

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

  return (
    <ScreenContainer
      containerClassName="bg-[#003366]"
      safeAreaClassName="bg-[#003366]"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View className="items-center px-6 pb-7 pt-12">
            <Text className="text-3xl font-bold tracking-tight">
              <Text className="text-white">DRIVE </Text>
              <Text style={{ color: "#4ADE80" }}>
                LEGAL
              </Text>
            </Text>

            <Text className="mt-1 text-sm uppercase tracking-widest text-blue-200">
              DRIVER LOGBOOK
            </Text>
          </View>

          {/* Main card */}
          <View className="flex-1 rounded-t-3xl bg-white px-6 pb-8 pt-8">
            <View className="mb-6 items-center">
              <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-[#EAF0FF]">
                <Text className="text-3xl">🔒</Text>
              </View>

              <Text className="text-center text-2xl font-bold text-[#003366]">
                Create Your PIN
              </Text>

              <Text className="mt-2 text-center text-sm leading-relaxed text-[#6B7A99]">
                Set a 4-digit PIN for faster and more secure
                access to Drive Legal.
              </Text>
            </View>

            {error ? (
              <View className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <Text className="text-sm text-red-600">
                  {error}
                </Text>
              </View>
            ) : null}

            <View className="mb-5">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#003366]">
                New PIN
              </Text>

              <TextInput
                className="rounded-xl border border-[#D1DCF0] bg-[#F8FAFF] px-4 py-4 text-center text-2xl tracking-[18px] text-[#0D1B2A]"
                placeholder="••••"
                placeholderTextColor="#9BA8C0"
                value={pin}
                onChangeText={handlePinChange}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                autoFocus
                textContentType="oneTimeCode"
              />

              <View className="mt-3 flex-row justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={`pin-dot-${index}`}
                    className={
                      index < pin.length
                        ? "h-3 w-3 rounded-full bg-[#3156D3]"
                        : "h-3 w-3 rounded-full border border-[#9BA8C0] bg-white"
                    }
                  />
                ))}
              </View>
            </View>

            <View className="mb-6">
              <Text className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#003366]">
                Confirm PIN
              </Text>

              <TextInput
                ref={confirmInputRef}
                className="rounded-xl border border-[#D1DCF0] bg-[#F8FAFF] px-4 py-4 text-center text-2xl tracking-[18px] text-[#0D1B2A]"
                placeholder="••••"
                placeholderTextColor="#9BA8C0"
                value={confirmPin}
                onChangeText={handleConfirmPinChange}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                textContentType="oneTimeCode"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <View className="mt-3 flex-row justify-center gap-3">
                {[0, 1, 2, 3].map((index) => (
                  <View
                    key={`confirm-dot-${index}`}
                    className={
                      index < confirmPin.length
                        ? "h-3 w-3 rounded-full bg-[#3156D3]"
                        : "h-3 w-3 rounded-full border border-[#9BA8C0] bg-white"
                    }
                  />
                ))}
              </View>
            </View>

            <TouchableOpacity
              className={
                canSubmit
                  ? "items-center rounded-xl bg-[#3156D3] py-4 active:opacity-80"
                  : "items-center rounded-xl bg-[#A9BCEB] py-4"
              }
              disabled={!canSubmit}
              onPress={handleSubmit}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-base font-bold text-white">
                  Save PIN
                </Text>
              )}
            </TouchableOpacity>

            <View className="mt-6 rounded-xl bg-[#F1F5FF] px-4 py-4">
              <Text className="text-center text-xs leading-relaxed text-[#6B7A99]">
                Your PIN is stored securely on this device.
                Drive Legal will never email or display your PIN.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}
