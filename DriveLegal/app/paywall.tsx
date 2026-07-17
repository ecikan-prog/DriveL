/**
 * Paywall Screen — shown when the 14-day trial expires.
 * Offers subscription options and handles Stripe checkout.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Linking,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import { activateSubscription } from "@/lib/subscription";

type PlanOption = {
  id: "monthly" | "annual";
  name: string;
  price: string;
  period: string;
  savings?: string;
  popular?: boolean;
};

const PLANS: PlanOption[] = [
  {
    id: "monthly",
    name: "Monthly",
    price: "NZD $4.99",
    period: "/month",
  },
  {
    id: "annual",
    name: "Annual",
    price: "NZD $39.99",
    period: "/year",
    savings: "Save 33%",
    popular: true,
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);

  const handleSubscribe = async () => {
    if (!user) return;
    setLoading(true);

    try {
      // In production, this would create a Stripe Checkout session via the server
      // For MVP, we simulate the subscription activation
      // TODO: Replace with actual Stripe integration:
      // 1. Call server to create Stripe Checkout Session
      // 2. Open Stripe Checkout URL in browser
      // 3. Handle success/cancel redirect
      // 4. Verify subscription status via webhook

      Alert.alert(
        "Stripe Integration",
        "In production, this will redirect to Stripe Checkout for secure payment processing.\n\nFor demo purposes, would you like to simulate a successful subscription?",
        [
          { text: "Cancel", style: "cancel", onPress: () => setLoading(false) },
          {
            text: "Simulate Subscribe",
            onPress: async () => {
              // Simulate successful subscription
              const periodEnd = new Date();
              if (selectedPlan === "monthly") {
                periodEnd.setMonth(periodEnd.getMonth() + 1);
              } else {
                periodEnd.setFullYear(periodEnd.getFullYear() + 1);
              }

              await activateSubscription(
                user.id,
                selectedPlan,
                `sim_sub_${Date.now()}`,
                periodEnd.toISOString()
              );

              Alert.alert(
                "Subscription Active! ✓",
                `Your ${selectedPlan} plan is now active. You can continue logging shifts.`,
                [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
              );
              setLoading(false);
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to process subscription. Please try again.");
      setLoading(false);
    }
  };

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]" edges={["top", "bottom", "left", "right"]}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        {/* Header */}
        <View
  style={{
    paddingHorizontal: 20,
    paddingTop: 12,
    alignItems: "flex-start",
  }}
>
  <TouchableOpacity
    onPress={() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/more");
      }
    }}
    style={{
      paddingVertical: 8,
      paddingHorizontal: 4,
    }}
  >
    <Text
      style={{
        color: "#FFFFFF",
        fontSize: 16,
        fontWeight: "700",
      }}
    >
      ‹ Back
    </Text>
  </TouchableOpacity>
</View>
        <View style={{ alignItems: "center", paddingTop: 40, paddingBottom: 24 }}>
          <Image
            source={require("@/assets/images/icon.png")}
            style={{ width: 64, height: 64, borderRadius: 16, marginBottom: 16 }}
            resizeMode="cover"
          />
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "800", letterSpacing: 2 }}>
            <Text style={{ color: "#FFFFFF" }}>DRIVE </Text>
            <Text style={{ color: "#4ADE80" }}>LEGAL</Text>
          </Text>
          <Text style={{ color: "#8AACDA", fontSize: 10, letterSpacing: 1.5, marginTop: 4 }}>
            DRIVER LOGBOOK
          </Text>
        </View>

        {/* Trial Expired Message */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <View style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(239, 68, 68, 0.3)" }}>
            <Text style={{ color: "#FCA5A5", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
              ⏰ Free Trial Ended
            </Text>
            <Text style={{ color: "#D1D5DB", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
              Your 14-day free trial has expired. Subscribe to continue logging your driving hours and meet NZTA work time requirements.
            </Text>
          </View>
        </View>

        {/* Plan Options */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 16, textAlign: "center" }}>
            Choose Your Plan
          </Text>

          {PLANS.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            return (
              <TouchableOpacity
                key={plan.id}
                onPress={() => setSelectedPlan(plan.id)}
                style={{
                  backgroundColor: isSelected ? "rgba(89, 128, 233, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  borderRadius: 16,
                  padding: 20,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? "#5980E9" : "rgba(255, 255, 255, 0.1)",
                  position: "relative",
                }}
              >
                {plan.popular && (
                  <View style={{ position: "absolute", top: -10, right: 16, backgroundColor: "#4ADE80", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: "#003366", fontSize: 10, fontWeight: "800" }}>BEST VALUE</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{plan.name}</Text>
                    {plan.savings && (
                      <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                        {plan.savings}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "800" }}>{plan.price}</Text>
                    <Text style={{ color: "#8AACDA", fontSize: 11 }}>{plan.period}</Text>
                  </View>
                </View>
                {/* Radio indicator */}
                <View style={{ position: "absolute", top: 20, left: 20, width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: isSelected ? "#5980E9" : "#4A6AB0", alignItems: "center", justifyContent: "center" }}>
                  {isSelected && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: "#5980E9" }} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Features List */}
        <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
          <Text style={{ color: "#8AACDA", fontSize: 12, fontWeight: "600", marginBottom: 12, textAlign: "center" }}>
            WHAT YOU GET
          </Text>
          {[
            "Unlimited shift logging",
            "Work time warnings & alerts (NZTA rule limits)",
            "Full history & export (CSV + PDF)",
            "70-hour fortnightly tracking",
            "Offline-first — works without internet",
            "Priority support",
          ].map((feature, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: "#4ADE80", fontSize: 14, marginRight: 10 }}>✓</Text>
              <Text style={{ color: "#D1D5DB", fontSize: 13 }}>{feature}</Text>
            </View>
          ))}
        </View>

        {/* Subscribe Button */}
        <View style={{ paddingHorizontal: 24, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={handleSubscribe}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#3A5A9E" : "#5980E9",
              borderRadius: 14,
              paddingVertical: 16,
              alignItems: "center",
              shadowColor: "#5980E9",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                Subscribe Now
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Restore / Terms */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" }}>
          <TouchableOpacity
            onPress={() => {
              Alert.alert("Restore Purchase", "If you have an existing subscription, it will be automatically detected when connected to the internet.");
            }}
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: "#5980E9", fontSize: 13, fontWeight: "600" }}>Restore Purchase</Text>
          </TouchableOpacity>
          <Text style={{ color: "#6B7280", fontSize: 10, textAlign: "center", lineHeight: 16 }}>
            Payment will be charged to your account. Subscription auto-renews unless cancelled at least 24 hours before the end of the current period.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
