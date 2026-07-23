/**
 * Subscription management for Drive Legal.
 * Handles 21-day free trial and subscription state via AsyncStorage.
 * Designed to integrate with Stripe when backend is connected.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUBSCRIPTION_KEY = "drivelegal_subscription";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

export type SubscriptionState = {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate: string; // ISO string
  trialEndDate: string; // ISO string
  subscriptionId?: string; // Stripe subscription ID
  currentPeriodEnd?: string; // ISO string - when current billing period ends
  plan?: "monthly" | "annual";
  lastChecked: string; // ISO string
};

const TRIAL_DAYS = 21;

/**
 * Get or initialize subscription state for a user.
 */
export async function getSubscriptionState(userId: string, trialStartDate: string): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
    if (raw) {
      const state: SubscriptionState = JSON.parse(raw);
      // Recalculate status based on dates
      return recalculateStatus(state);
    }
  } catch {
    // Fall through to create new state
  }

  // Initialize new subscription state
  const trialStart = new Date(trialStartDate);
  const trialEnd = new Date(trialStart.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

  const state: SubscriptionState = {
    userId,
    status: "trial",
    trialStartDate,
    trialEndDate: trialEnd.toISOString(),
    lastChecked: new Date().toISOString(),
  };

  await saveSubscriptionState(state);
  return state;
}

/**
 * Recalculate subscription status based on current time.
 */
function recalculateStatus(state: SubscriptionState): SubscriptionState {
  const now = Date.now();

  // If actively subscribed, check if period is still valid
  if (state.status === "active" && state.currentPeriodEnd) {
    if (now > new Date(state.currentPeriodEnd).getTime()) {
      state.status = "expired";
    }
    return state;
  }

  // If on trial, check if trial has expired
  if (state.status === "trial") {
    if (now > new Date(state.trialEndDate).getTime()) {
      state.status = "expired";
    }
  }

  return state;
}

/**
 * Save subscription state to AsyncStorage.
 */
export async function saveSubscriptionState(state: SubscriptionState): Promise<void> {
  state.lastChecked = new Date().toISOString();
  await AsyncStorage.setItem(`${SUBSCRIPTION_KEY}_${state.userId}`, JSON.stringify(state));
}

/**
 * Activate a subscription (called after successful Stripe payment).
 */
export async function activateSubscription(
  userId: string,
  plan: "monthly" | "annual",
  subscriptionId: string,
  currentPeriodEnd: string
): Promise<SubscriptionState> {
  const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
  const state: SubscriptionState = raw
    ? JSON.parse(raw)
    : {
        userId,
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

  state.status = "active";
  state.plan = plan;
  state.subscriptionId = subscriptionId;
  state.currentPeriodEnd = currentPeriodEnd;
  state.lastChecked = new Date().toISOString();

  await saveSubscriptionState(state);
  return state;
}

/**
 * Cancel subscription (reverts to expired after current period).
 */
export async function cancelSubscription(userId: string): Promise<SubscriptionState> {
  const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
  if (!raw) throw new Error("No subscription found");

  const state: SubscriptionState = JSON.parse(raw);
  state.status = "cancelled";
  state.lastChecked = new Date().toISOString();

  await saveSubscriptionState(state);
  return state;
}

/**
 * Check if the user can log shifts (trial active or subscription active).
 */
export function canLogShifts(state: SubscriptionState): boolean {
  return state.status === "trial" || state.status === "active";
}

/**
 * Get trial days remaining (0 if expired).
 */
export function getTrialDaysLeft(state: SubscriptionState): number {
  if (state.status !== "trial") return 0;
  const end = new Date(state.trialEndDate).getTime();
  const now = Date.now();
  const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
}

/**
 * Get subscription display info for UI.
 */
export function getSubscriptionDisplayInfo(state: SubscriptionState): {
  title: string;
  subtitle: string;
  badgeColor: string;
  badgeText: string;
  canUseApp: boolean;
} {
  switch (state.status) {
    case "trial": {
      const days = getTrialDaysLeft(state);
      return {
        title: "Free Trial",
        subtitle: `${days} day${days !== 1 ? "s" : ""} remaining`,
        badgeColor: days <= 3 ? "#F59E0B" : "#22C55E",
        badgeText: `${days}d left`,
        canUseApp: true,
      };
    }
    case "active":
      return {
        title: "Pro Subscription",
        subtitle: state.plan === "annual" ? "Annual plan" : "Monthly plan",
        badgeColor: "#22C55E",
        badgeText: "Active",
        canUseApp: true,
      };
    case "expired":
      return {
        title: "Trial Expired",
        subtitle: "Subscribe to continue logging shifts",
        badgeColor: "#EF4444",
        badgeText: "Expired",
        canUseApp: false,
      };
    case "cancelled":
      return {
        title: "Subscription Cancelled",
        subtitle: "Subscribe to continue logging shifts",
        badgeColor: "#F59E0B",
        badgeText: "Cancelled",
        canUseApp: false,
      };
  }
}
