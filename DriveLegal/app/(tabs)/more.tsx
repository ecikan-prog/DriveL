import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Image,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";

function MenuItem({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F4FF" }}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: iconBg, alignItems: "center", justifyContent: "center" }}>
        <MaterialIcons name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#003366" }}>{title}</Text>
        {subtitle && <Text style={{ fontSize: 11, color: "#6B7A99", marginTop: 1 }}>{subtitle}</Text>}
      </View>
      <MaterialIcons name="chevron-right" size={20} color="#9BA8C0" />
    </TouchableOpacity>
  );
}

export default function MoreScreen() {
  const router = useRouter();
  const { user, logout } = useAuthContext();

  const handleContactSupport = async () => {
    const mailto = `mailto:support@drivelegal.app?subject=Drive%20Legal%20Support%20Request&body=Hello%2C%0A%0AI%20need%20help%20with%20Drive%20Legal.%0A%0ADriver%3A%20${encodeURIComponent(user?.name ?? "")}%0ALicence%3A%20${encodeURIComponent(user?.licenceNumber ?? "")}%0A%0A%5BPlease%20describe%20your%20issue%20here%5D`;
    try {
      await Linking.openURL(mailto);
    } catch {
      Alert.alert("Contact Support", "Please email support@drivelegal.app directly.");
    }
  };

  const performLogout = async () => {
    try {
      await logout();
    } catch (e) {
      // ignore errors, proceed with navigation
    }
    if (Platform.OS === "web") {
      // router.replace can be unreliable on web after auth state wipe;
      // use a hard redirect to guarantee the login page loads fresh.
      window.location.href = "/login";
    } else {
      router.replace("/login" as any);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === "web") {
      // Alert.alert is a no-op on Expo web — use window.confirm instead
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        performLogout();
      }
    } else {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Sign Out", style: "destructive", onPress: performLogout },
        ]
      );
    }
  };

  if (!user) return null;

  return (
    <ScreenContainer edges={["top", "left", "right"]} containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]">
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800" }}>More</Text>
        <Text style={{ color: "#93C5FD", fontSize: 12, marginTop: 4 }}>Settings & account</Text>
      </View>

      <View style={{ flex: 1, backgroundColor: "#F0F4FF", borderTopLeftRadius: 28, borderTopRightRadius: 28 }}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {/* User Card */}
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E8EEF8", flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#003366", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>
                {user.name?.charAt(0)?.toUpperCase() ?? "D"}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#003366" }}>{user.name}</Text>
              <Text style={{ fontSize: 12, color: "#6B7A99" }}>{user.email}</Text>
            </View>
          </View>

          {/* Account Section */}
          <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>ACCOUNT</Text>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <MenuItem
              icon="person"
              iconColor="#2563EB"
              iconBg="#EFF6FF"
              title="Edit Profile"
              subtitle="Name, licence, vehicle details"
              onPress={() => router.push("/(tabs)/profile" as any)}
            />
            <MenuItem
              icon="subscriptions"
              iconColor="#7C3AED"
              iconBg="#F5F3FF"
              title="Subscription"
              subtitle="Manage your plan"
              onPress={() => router.push("/paywall" as any)}
            />
          </View>

          {/* Support Section */}
          <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>SUPPORT</Text>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <MenuItem
              icon="email"
              iconColor="#059669"
              iconBg="#ECFDF5"
              title="Contact Support"
              subtitle="support@drivelegal.app"
              onPress={handleContactSupport}
            />
          </View>

          {/* Legal Section */}
          <Text style={{ fontSize: 11, color: "#6B7A99", fontWeight: "700", letterSpacing: 1, marginBottom: 8 }}>LEGAL</Text>
          <View style={{ backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 16, marginBottom: 20, borderWidth: 1, borderColor: "#E8EEF8" }}>
            <MenuItem
              icon="privacy-tip"
              iconColor="#6B7280"
              iconBg="#F3F4F6"
              title="Privacy Policy"
              onPress={() => router.push("/privacy-policy" as any)}
            />
            <MenuItem
              icon="description"
              iconColor="#6B7280"
              iconBg="#F3F4F6"
              title="Terms of Service"
              onPress={() => router.push("/terms-of-service" as any)}
            />
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={{ backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA", borderRadius: 16, paddingVertical: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8 }}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <MaterialIcons name="logout" size={20} color="#B91C1C" />
            <Text style={{ color: "#B91C1C", fontWeight: "700", fontSize: 14 }}>Sign Out</Text>
          </TouchableOpacity>

          <Text style={{ textAlign: "center", fontSize: 11, color: "#9BA8C0", marginTop: 16 }}>
            Drive Legal v1.0 • Built to NZTA Work Time Rule
          </Text>
        </ScrollView>
      </View>
    </ScreenContainer>
  );
}
