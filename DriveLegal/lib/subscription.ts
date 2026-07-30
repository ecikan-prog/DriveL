/**
 * Subscription management for Drive Legal.
 * Server (Railway/MySQL) is the source of truth for subscription status.
 * AsyncStorage is a local cache, refreshed from the server on every login.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const SUBSCRIPTION_KEY = "drivelegal_subscription";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

export type SubscriptionState = {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate: string;
  trialEndDate: string;
  subscriptionId?: string;
  currentPeriodEnd?: string;
  plan?: "monthly" | "annual";
  lastChecked: string;
  lastServerSync?: string; // set only by syncSubscriptionFromServer
};

const TRIAL_DAYS = 21;

/**
 * THE ONLY place subscription status should be set from an authoritative source.
 * Call this right after login/register, using the driver fields returned by the server.
 * This always wins over whatever was cached locally.
 */
export async function syncSubscriptionFromServer(params: {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  plan?: "monthly" | "annual" | null;
}): Promise<SubscriptionState> {
  const trialStartDate =
    params.trialStartDate ?? new Date().toISOString();

  const trialEndDate =
    params.trialEndDate ??
    new Date(
      new Date(trialStartDate).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

  const state: SubscriptionState = {
    userId: params.userId,
    status: params.status,
    trialStartDate,
    trialEndDate,
    subscriptionId: params.subscriptionId ?? undefined,
    currentPeriodEnd: params.currentPeriodEnd ?? undefined,
    plan: params.plan ?? undefined,
    lastChecked: new Date().toISOString(),
    lastServerSync: new Date().toISOString(),
  };

  await saveSubscriptionState(state);
  return state;
}

/**
 * Read subscription state for display / gating decisions.
 * Does NOT resync dates or re-derive status from scratch — it only ever
 * applies a one-way expiry downgrade (trial/active -> expired) based on
 * the dates that were already set by syncSubscriptionFromServer.
 * If nothing is cached yet (first-ever run, offline), falls back to a
 * short-lived local trial so the app remains usable until the next login.
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
    if (raw) {
      const state: SubscriptionState = JSON.parse(raw);
      const updated = applyExpiryCheck(state);
      if (updated.status !== state.status) {
        await saveSubscriptionState(updated);
      }
      return updated;
    }
  } catch {
    // fall through to offline default
  }

  // No cached state at all (should be rare — only before first server sync).
  const trialStart = new Date().toISOString();
  const trialEnd = new Date(
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const fallback: SubscriptionState = {
    userId,
    status: "trial",
    trialStartDate: trialStart,
    trialEndDate: trialEnd,
    lastChecked: new Date().toISOString(),
  };

  await saveSubscriptionState(fallback);
  return fallback;
}

/**
 * One-way downgrade only: trial -> expired, active -> expired.
 * Never upgrades or resets dates. Never touches cancelled.
 */
function applyExpiryCheck(state: SubscriptionState): SubscriptionState {
  const now = Date.now();

  if (state.status === "active" && state.currentPeriodEnd) {
    if (now > new Date(state.currentPeriodEnd).getTime()) {
      return { ...state, status: "expired" };
    }
    return state;
  }

  if (state.status === "trial") {
    if (now > new Date(state.trialEndDate).getTime()) {
      return { ...state, status: "expired" };
    }
    return state;
  }

  return state;
}

export async function saveSubscriptionState(state: SubscriptionState): Promise<void> {
  state.lastChecked = new Date().toISOString();
  await AsyncStorage.setItem(`${SUBSCRIPTION_KEY}_${state.userId}`, JSON.stringify(state));
}

/**
 * Activate a subscription (called after successful Stripe payment).
 * Local-first; a follow-up server call/webhook should also update the drivers table
 * so other devices and future logins see it too.
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
        status: "trial",
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

  state.status = "active";
  state.plan = plan;
  state.subscriptionId = subscriptionId;
  state.currentPeriodEnd = currentPeriodEnd;

  await saveSubscriptionState(state);
  return state;
}

export async function cancelSubscription(userId: string): Promise<SubscriptionState> {
  const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
  if (!raw) throw new Error("No subscription found");

  const state: SubscriptionState = JSON.parse(raw);
  state.status = "cancelled";

  await saveSubscriptionState(state);
  return state;
}

export function canLogShifts(state: SubscriptionState): boolean {
  return state.status === "trial" || state.status === "active";
}

export function getTrialDaysLeft(state: SubscriptionState): number {
  if (state.status !== "trial") return 0;
  const end = new Date(state.trialEndDate).getTime();
  const daysLeft = Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
  return Math.max(0, daysLeft);
}

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
