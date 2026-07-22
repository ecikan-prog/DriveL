import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Text,
  View,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  Redirect,
  Tabs,
} from "expo-router";

import { useAuthContext } from "@/lib/auth-context";
import {
  hasPin,
  isPinSessionUnlocked,
} from "@/lib/pin-security";

type PinGateStatus =
  | "checking"
  | "ready"
  | "setup-required"
  | "unlock-required";

export default function TabsLayout() {
  const { user, loading } = useAuthContext();

  const [pinGateStatus, setPinGateStatus] =
    useState<PinGateStatus>("checking");

  useEffect(() => {
    let active = true;

    async function checkPinAccess() {
      if (loading) {
        return;
      }

      if (!user?.id) {
        if (active) {
          setPinGateStatus("ready");
        }

        return;
      }

      if (active) {
        setPinGateStatus("checking");
      }

      try {
        const pinExists = await hasPin(user.id);

        if (!active) {
          return;
        }

        if (!pinExists) {
          setPinGateStatus("setup-required");
          return;
        }

        if (!isPinSessionUnlocked(user.id)) {
          setPinGateStatus("unlock-required");
          return;
        }

        setPinGateStatus("ready");
      } catch (error) {
        console.error(
          "[PIN] Unable to check PIN status:",
          error
        );

        if (active) {
          setPinGateStatus("setup-required");
        }
      }
    }

    void checkPinAccess();

    return () => {
      active = false;
    };
  }, [loading, user?.id]);

  if (
    loading ||
    pinGateStatus === "checking"
  ) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#FFFFFF",
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 24,
        }}
      >
        <ActivityIndicator
          size="large"
          color="#3156D3"
        />

        <Text
          style={{
            color: "#71809F",
            fontSize: 14,
            marginTop: 14,
            textAlign: "center",
          }}
        >
          Securing Drive Legal...
        </Text>
      </View>
    );
  }

  if (!user?.id) {
    return <Redirect href="/login" />;
  }

  if (pinGateStatus === "setup-required") {
    return (
      <Redirect
        href={
          "/setup-pin?next=/" as any
        }
      />
    );
  }

  if (pinGateStatus === "unlock-required") {
    return <Redirect href="/pin-login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#9BA8C0",
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          height: 82,
          paddingTop: 8,
          paddingBottom: 12,
          backgroundColor: "#FFFFFF",
          borderTopColor: "#E8EEF8",
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="dashboard"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "Logbook",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="menu-book"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="new-entry"
        options={{
          title: "New Entry",
          tabBarIcon: ({ color }) => (
            <MaterialIcons
              name="add-circle"
              size={42}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="bar-chart"
              size={size}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons
              name="more-horiz"
              size={size}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
