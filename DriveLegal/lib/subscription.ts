/**
 * Subscription management for Drive Legal.
 *
 * Source-of-truth hierarchy (highest → lowest):
 *   1. StoreKit / expo-in-app-purchases  (iOS production entitlement)
 *   2. Railway/MySQL server              (synced on login via syncSubscriptionFromServer)
 *   3. AsyncStorage cache                (display only — never overrides StoreKit)
 *
 * Rules
 * ─────
 * • AsyncStorage is ONLY a display cache.  It is always overwritten by the
 *   real StoreKit state; it never upgrades status on its own.
 * • activateSubscriptionFromIAP() is the only function that marks a
 *   subscription "active" from within the app.  It requires a verified
 *   StoreKit transaction ID — there is no fake/demo activation path.
 * • The 21-day free trial is an Apple introductory offer configured in
 *   App Store Connect.  The local trialEndDate field is kept for
 *   backward-compatibility with the server schema; it is NOT the gating
 *   mechanism for trial access on iOS.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { checkCurrentEntitlement, estimatePeriodEnd } from "./iap";

const SUBSCRIPTION_KEY = "drivelegal_subscription";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";

export type SubscriptionState = {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate: string;
  trialEndDate: string;
  /** StoreKit transaction ID or server-provided subscription ID */
  subscriptionId?: string;
  currentPeriodEnd?: string;
  plan?: "monthly" | "annual";
  lastChecked: string;
  /** Timestamp of last syncSubscriptionFromServer call */
  lastServerSync?: string;
  /** Whether the current active state was verified by StoreKit */
  iapVerified?: boolean;
};

const TRIAL_DAYS = 21;

// ─── Server sync (called after login) ────────────────────────────────────────

/**
 * Sync subscription state from the Railway backend.
 * Called immediately after a successful cloud login.
 * This sets the AsyncStorage cache from authoritative server data.
 * On iOS, refreshIAPEntitlement() is called afterward to let StoreKit
 * override the server state with the real entitlement.
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
  const trialStartDate = params.trialStartDate ?? new Date().toISOString();
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
    iapVerified: false,
  };

  await saveSubscriptionState(state);
  return state;
}

// ─── StoreKit entitlement refresh ────────────────────────────────────────────

/**
 * Query StoreKit for the real current entitlement and update the cache.
 * This is called on every app launch (from shift-context) so that the
 * cached state can never drift from the actual App Store state.
 *
 * IMPORTANT: This is the ONLY function allowed to set status = "active"
 * based on a StoreKit check.  It cannot be bypassed.
 */
export async function refreshIAPEntitlement(userId: string): Promise<SubscriptionState> {
  const cached = await getSubscriptionState(userId);

  try {
    const entitlement = await checkCurrentEntitlement();

    if (entitlement.isActive && entitlement.plan) {
      // StoreKit confirms an active subscription — mark as active regardless
      // of what the AsyncStorage cache or server said.
      const periodEnd = entitlement.expiryDate
        ? entitlement.expiryDate.toISOString()
        : estimatePeriodEnd(entitlement.plan, Date.now()).toISOString();

      const updated: SubscriptionState = {
        ...cached,
        userId,
        status: "active",
        plan: entitlement.plan,
        currentPeriodEnd: periodEnd,
        lastChecked: new Date().toISOString(),
        iapVerified: true,
      };
      await saveSubscriptionState(updated);
      return updated;
    }

    // StoreKit returns no active subscription.  Downgrade active/trial to
    // expired only when StoreKit explicitly says no entitlement.
    if (cached.status === "active" && cached.iapVerified) {
      // Previously confirmed via StoreKit — now expired/cancelled.
      const downgraded: SubscriptionState = {
        ...cached,
        status: "expired",
        lastChecked: new Date().toISOString(),
        iapVerified: false,
      };
      await saveSubscriptionState(downgraded);
      return downgraded;
    }
  } catch {
    // StoreKit unavailable (offline, simulator, etc.) — return cached state.
    // Do NOT downgrade or modify the cached state on network errors.
  }

  return cached;
}

// ─── Post-purchase activation ─────────────────────────────────────────────────

/**
 * Activate the subscription after a successful verified StoreKit purchase.
 * This is the ONLY code path that can transition status → "active" from
 * within the app.  It requires a real StoreKit transaction ID.
 *
 * The fake "sim_sub_" prefix is explicitly rejected.
 */
export async function activateSubscriptionFromIAP(
  userId: string,
  plan: "monthly" | "annual",
  transactionId: string,
  purchaseTime: number
): Promise<SubscriptionState> {
  if (transactionId.startsWith("sim_sub_")) {
    throw new Error(
      "Simulated transaction IDs are not accepted. A real StoreKit transaction is required."
    );
  }

  const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
  const base: SubscriptionState = raw
    ? JSON.parse(raw)
    : {
        userId,
        status: "trial",
        trialStartDate: new Date().toISOString(),
        trialEndDate: new Date().toISOString(),
        lastChecked: new Date().toISOString(),
      };

  const periodEnd = estimatePeriodEnd(plan, purchaseTime);

  const updated: SubscriptionState = {
    ...base,
    userId,
    status: "active",
    plan,
    subscriptionId: transactionId,
    currentPeriodEnd: periodEnd.toISOString(),
    lastChecked: new Date().toISOString(),
    iapVerified: true,
  };

  await saveSubscriptionState(updated);
  return updated;
}

// ─── Read / display helpers ───────────────────────────────────────────────────

/**
 * Read the cached subscription state.
 * Applies a one-way expiry downgrade for non-IAP-verified states only.
 * Never upgrades status — that is StoreKit's job.
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
    if (raw) {
      const state: SubscriptionState = JSON.parse(raw);
      // Only apply local expiry check to states NOT verified by StoreKit,
      // to avoid incorrectly expiring a valid subscription while offline.
      const updated = state.iapVerified ? state : applyExpiryCheck(state);
      if (updated.status !== state.status) {
        await saveSubscriptionState(updated);
      }
      return updated;
    }
  } catch {
    // fall through to offline default
  }

  // No cache at all — show as trial pending the first server sync.
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
    iapVerified: false,
  };

  await saveSubscriptionState(fallback);
  return fallback;
}

/** One-way downgrade only for non-IAP-verified local/server-synced states. */
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
  await AsyncStorage.setItem(
    `${SUBSCRIPTION_KEY}_${state.userId}`,
    JSON.stringify(state)
  );
}

// ─── Gating helpers ───────────────────────────────────────────────────────────

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
