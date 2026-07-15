import { Stack } from "expo-router";
import { AuthProvider } from "@/lib/auth-context";
import { ShiftProvider } from "@/lib/shift-context";

export default function RootLayout() {
  return (
    <AuthProvider>
      <ShiftProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="login" />
          <Stack.Screen name="register" />
          <Stack.Screen name="index" />
          <Stack.Screen name="forgot-password" />
          <Stack.Screen name="reset-password" />
          <Stack.Screen name="verify-email" />
          <Stack.Screen name="history" />
          <Stack.Screen name="shift-detail" />
          <Stack.Screen name="enforcement-view" />
          <Stack.Screen name="more" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="reports" />
          <Stack.Screen name="paywall" />
          <Stack.Screen name="privacy-policy" />
          <Stack.Screen name="terms-of-service" />
        </Stack>
      </ShiftProvider>
    </AuthProvider>
  );
}
