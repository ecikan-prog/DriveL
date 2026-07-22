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
  | "required";

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

      if (!user) {
        if (active) {
          setPinGateStatus("ready");
        }
        return;
      }

      try {
        const pinExists = await hasPin();

        if (!active) {
          return;
        }

        if (
          pinExists &&
          !isPinSessionUnlocked()
        ) {
          setPinGateStatus("required");
          return;
        }

        setPinGateStatus("ready");
      } catch (error) {
        console.error(
          "[PIN] Unable to check PIN status:",
          error
        );

        if (active) {
          setPinGateStatus("ready");
        }
      }
    }

    void checkPinAccess();

    return () => {
      active = false;
    };
  }, [loading, user]);

  if (
    loading ||
    pinGateStatus === "checking"
  ) {
    return (
      <View
       
