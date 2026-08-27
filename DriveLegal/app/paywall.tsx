/**
 * Paywall Screen — shown when the 21-day trial expires or when the user
 * navigates to subscription management.
 *
 * Purchase flow (iOS production):
 *   1. Load product metadata from the App Store (real prices, trial info).
 *   2. User selects Monthly or Annual plan.
 *   3. "Subscribe Now" calls purchasePlan() which triggers Apple's native
 *      payment sheet via StoreKit (expo-in-app-purchases).
 *   4. On a successful verified transaction, activateSubscriptionFromIAP()
 *      writes the StoreKit-verified state to cache.
 *   5. Paywall closes.
 *
 * There is NO Stripe integration, NO "Simulate Subscribe" dialog, and NO
 * demo/fake activation path in this file.
 */
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { ScreenContainer } from "@/components/screen-container";
import { useAuthContext } from "@/lib/auth-context";
import {
  activateSubscriptionFromIAP,
  getSubscriptionState,
  refreshIAPEntitlement,
  getTrialDaysLeft,
} from "@/lib/subscription";
import {
  loadIAPProducts,
  purchasePlan,
  checkCurrentEntitlement,
  IAP_PRODUCT_IDS,
  type IAPProduct,
  type IAPPlan,
} from "@/lib/iap";

type PlanOption = {
  id: IAPPlan;
  name: string;
  /** Fallback display price shown before StoreKit products load */
  fallbackPrice: string;
  period: string;
  savings?: string;
  popular?: boolean;
};

const PLANS: PlanOption[] = [
  {
    id: "monthly",
    name: "Monthly",
    fallbackPrice: "NZD $6.99",
    period: "/month",
  },
  {
    id: "annual",
    name: "Annual",
    fallbackPrice: "NZD $69.99",
    period: "/year",
    savings: "Save NZ$13.89",
    popular: true,
  },
];

export default function PaywallScreen() {
  const router = useRouter();
  const { user } = useAuthContext();
  const [selectedPlan, setSelectedPlan] = useState<IAPPlan>("annual");
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [subscriptionState, setSubscriptionState] =
    useState<Awaited<ReturnType<typeof getSubscriptionState>> | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  // Load subscription state and StoreKit products on mount
  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!user) {
        setSubscriptionState(null);
        setSubscriptionLoading(false);
        return;
      }

      setSubscriptionLoading(true);

      try {
        // Load cached state first for instant UI
        const cached = await getSubscriptionState(user.id);
        if (isMounted) setSubscriptionState(cached);

        // Then refresh from StoreKit (iOS only) in parallel with product fetch
        const [refreshed, storeProducts] = await Promise.all([
          refreshIAPEntitlement(user.id).catch(() => cached),
          Platform.OS === "ios" ? loadIAPProducts() : Promise.resolve([]),
        ]);

        if (isMounted) {
          setSubscriptionState(refreshed);
          setProducts(storeProducts);
        }
      } catch (error) {
        console.error("[Paywall] Initialisation error:", error);
      } finally {
        if (isMounted) setSubscriptionLoading(false);
      }
    };

    init();

    return () => { isMounted = false; };
  }, [user?.id]);

  /** Return the App Store price string for a plan, or the fallback if not loaded yet. */
  const displayPrice = useCallback(
    (plan: PlanOption): string => {
      const product = products.find((p) => p.productId === IAP_PRODUCT_IDS[plan.id]);
      return product ? product.price : plan.fallbackPrice;
    },
    [products]
  );

  // ─── Subscribe ──────────────────────────────────────────────────────────────

  const handleSubscribe = async () => {
    if (!user) return;

    if (Platform.OS !== "ios") {
      Alert.alert(
        "iOS Only",
        "Subscriptions are managed through the App Store on iOS devices."
      );
      return;
    }

    setPurchasing(true);

    try {
      const result = await purchasePlan(selectedPlan);

      if (result.success) {
        // Verified StoreKit transaction — activate entitlement
        await activateSubscriptionFromIAP(
          user.id,
          result.plan,
          result.transactionId,
          result.purchaseTime
        );

        const updated = await getSubscriptionState(user.id);
        setSubscriptionState(updated);

        Alert.alert(
          "Subscription Active ✓",
          `Your ${result.plan} plan is now active. Thank you for subscribing to Drive Legal.`,
          [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
        );
      } else {
        const failure = result as { success: false; cancelled: boolean; error: string };
        if (!failure.cancelled) {
          Alert.alert("Purchase Failed", failure.error);
        }
        // If cancelled, user dismissed the payment sheet — no action needed
      }
    } catch (error: any) {
      Alert.alert("Purchase Error", error?.message ?? "An unexpected error occurred. Please try again.");
    } finally {
      setPurchasing(false);
    }
  };

  // ─── Restore ────────────────────────────────────────────────────────────────

  const handleRestore = async () => {
    if (!user) return;

    if (Platform.OS !== "ios") {
      Alert.alert("iOS Only", "Restore Purchase is only available on iOS devices.");
      return;
    }

    setRestoring(true);

    try {
      const entitlement = await checkCurrentEntitlement();

      if (entitlement.isActive && entitlement.plan) {
        // Confirmed active entitlement via StoreKit — activate locally
        const periodEnd = entitlement.expiryDate ?? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        await activateSubscriptionFromIAP(
          user.id,
          entitlement.plan,
          `restored_${Date.now()}`,
          Date.now()
        );

        const updated = await getSubscriptionState(user.id);
        setSubscriptionState(updated);

        Alert.alert(
          "Subscription Restored ✓",
          "Your previous subscription has been restored.",
          [{ text: "Continue", onPress: () => router.replace("/(tabs)") }]
        );
      } else {
        Alert.alert(
          "No Active Subscription",
          "We couldn't find an active subscription on this Apple ID. If you believe this is an error, please contact support."
        );
      }
    } catch (error: any) {
      Alert.alert(
        "Restore Failed",
        "Unable to restore your subscription. Please check your internet connection and try again."
      );
    } finally {
      setRestoring(false);
    }
  };

  // ─── Derived display state ─────────────────────────────────────────────────

  const trialDaysLeft = subscriptionState ? getTrialDaysLeft(subscriptionState) : 0;
  const isTrial = subscriptionState?.status === "trial";
  const isActive = subscriptionState?.status === "active";
  const isExpired =
    subscriptionState?.status === "expired" ||
    subscriptionState?.status === "cancelled";

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScreenContainer containerClassName="bg-[#003366]" safeAreaClassName="bg-[#003366]" edges={["top", "bottom", "left", "right"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#003366" }}
        contentContainerStyle={{ flexGrow: 1, backgroundColor: "#003366" }}
      >
        {/* Header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 12, alignItems: "flex-start" }}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/more");
              }
            }}
            style={{ paddingVertical: 8, paddingHorizontal: 4 }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>‹ Back</Text>
          </TouchableOpacity>
        </View>

        {/* Logo */}
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

        {/* Subscription Status */}
        <View style={{ paddingHorizontal: 24, marginBottom: 24 }}>
          {subscriptionLoading ? (
            <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, alignItems: "center" }}>
              <ActivityIndicator color="#FFFFFF" />
            </View>
          ) : isTrial ? (
            <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }}>
              <Text style={{ color: "#86EFAC", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
                ✓ Free Trial Active
              </Text>
              <Text style={{ color: "#D1D5DB", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
                You have {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining in your 21-day free trial.
              </Text>
            </View>
          ) : isActive ? (
            <View style={{ backgroundColor: "rgba(34,197,94,0.15)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(34,197,94,0.3)" }}>
              <Text style={{ color: "#86EFAC", fontSize: 14, fontWeight: "700", textAlign: "center" }}>
                ✓ Subscription Active
              </Text>
            </View>
          ) : isExpired ? (
            <View style={{ backgroundColor: "rgba(239,68,68,0.15)", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" }}>
              <Text style={{ color: "#FCA5A5", fontSize: 14, fontWeight: "700", textAlign: "center", marginBottom: 4 }}>
                ⏰ Free Trial Ended
              </Text>
              <Text style={{ color: "#D1D5DB", fontSize: 12, textAlign: "center", lineHeight: 18 }}>
                Your free trial has expired. Subscribe to continue logging your driving hours.
              </Text>
            </View>
          ) : null}
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
                  backgroundColor: isSelected ? "rgba(89,128,233,0.2)" : "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  padding: 20,
                  paddingLeft: 54,
                  marginBottom: 12,
                  borderWidth: 2,
                  borderColor: isSelected ? "#5980E9" : "rgba(255,255,255,0.1)",
                  position: "relative",
                }}
              >
                {plan.popular && (
                  <View style={{ position: "absolute", top: -10, right: 16, backgroundColor: "#4ADE80", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 }}>
                    <Text style={{ color: "#003366", fontSize: 10, fontWeight: "800" }}>BEST VALUE</Text>
                  </View>
                )}
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <View>
                    <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>{plan.name}</Text>
                    {plan.savings && (
                      <Text style={{ color: "#4ADE80", fontSize: 12, fontWeight: "600", marginTop: 2 }}>
                        {plan.savings}
                      </Text>
                    )}
                  </View>
                  <View style={{ alignItems: "flex-end", flexShrink: 1, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                      style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "800", textAlign: "right" }}
                    >
                      {displayPrice(plan)}
                    </Text>
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

        {/* Features */}
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
            disabled={purchasing || restoring}
            style={{
              backgroundColor: purchasing || restoring ? "#3A5A9E" : "#5980E9",
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
            {purchasing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "800" }}>
                Subscribe Now
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Restore / Legal */}
        <View style={{ paddingHorizontal: 24, paddingBottom: 40, alignItems: "center" }}>
          <TouchableOpacity
            onPress={handleRestore}
            disabled={purchasing || restoring}
            style={{ marginBottom: 12 }}
          >
            {restoring ? (
              <ActivityIndicator color="#5980E9" />
            ) : (
              <Text style={{ color: "#5980E9", fontSize: 13, fontWeight: "600" }}>
                Restore Purchase
              </Text>
            )}
          </TouchableOpacity>
          <Text style={{ color: "#6B7280", fontSize: 10, textAlign: "center", lineHeight: 16 }}>
            Payment will be charged to your Apple ID account at confirmation of purchase. Subscription
            automatically renews unless cancelled at least 24 hours before the end of the current period.
            Manage or cancel your subscription in your Apple ID account settings.
          </Text>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
