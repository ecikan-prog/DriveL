/**
 * Subscription management for Drive Legal.
 *
 * Source-of-truth hierarchy (highest → lowest):
 *   1. Authenticated Drive Legal account on Railway/MySQL
 *   2. Explicit StoreKit purchase / restore action for that authenticated account
 *   3. AsyncStorage cache
 *
 * Rules
 * ─────
 * • AsyncStorage is ONLY an account-scoped cache.
 * • Local premium access must reflect the authenticated account state
 *   accepted by the server for that account.
 * • The 21-day free trial is an Apple introductory offer configured in
 *   App Store Connect.  The local trialEndDate field is kept for
 *   backward-compatibility with the server schema; it is NOT the gating
 *   mechanism for trial access on iOS.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { checkCurrentEntitlement, estimatePeriodEnd } from "./iap";

const SUBSCRIPTION_KEY = "drivelegal_subscription";

export type SubscriptionStatus = "trial" | "active" | "expired" | "cancelled";
export type SubscriptionSyncSource = "session" | "purchase" | "restore";
export type SubscriptionAuthority = "server" | "purchase" | "restore";

export type SubscriptionState = {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate: string;
  trialEndDate: string;
  /** StoreKit transaction ID or server-provided subscription ID */
  subscriptionId?: string;
  currentPeriodEnd?: string;
  willAutoRenew?: boolean;
  plan?: "monthly" | "annual";
  lastChecked: string;
  /** Timestamp of last syncSubscriptionFromServer call */
  lastServerSync?: string;
  /** Whether the current active state was verified by StoreKit */
  iapVerified?: boolean;
  /** Where the currently cached entitlement last came from */
  entitlementAuthority?: SubscriptionAuthority;
  /**
   * True when a local purchase/restore is newer than the last server session
   * snapshot seen on-device and must not be replaced by a conflicting older
   * session-validation response.
   */
  pendingServerConfirmation?: boolean;
};

const TRIAL_DAYS = 21;

// ─── Server sync (called after login) ────────────────────────────────────────

/**
 * Sync subscription state from the Railway backend.
 * Called after authenticated account sync so the cache matches the
 * Drive Legal account currently signed in on this device.
 */
export async function syncSubscriptionFromServer(params: {
  userId: string;
  status: SubscriptionStatus;
  trialStartDate?: string | null;
  trialEndDate?: string | null;
  subscriptionId?: string | null;
  currentPeriodEnd?: string | null;
  willAutoRenew?: boolean | null;
  plan?: "monthly" | "annual" | null;
  iapVerified?: boolean;
  source?: SubscriptionSyncSource;
}): Promise<SubscriptionState> {
  const source = params.source ?? "session";
  const trialStartDate = params.trialStartDate ?? new Date().toISOString();
  const trialEndDate =
    params.trialEndDate ??
    new Date(
      new Date(trialStartDate).getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

  // Session-validation updates normally accept the authenticated account state,
  // but an explicit local purchase/restore stays authoritative until the
  // server confirms the same entitlement or returns a genuinely newer update.
  // refreshIAPEntitlement() is responsible for confirming or revoking
  // the active status via StoreKit after login completes.
  const incomingState = normaliseSubscriptionState({
    userId: params.userId,
    status: params.status,
    trialStartDate,
    trialEndDate,
    subscriptionId: params.subscriptionId ?? undefined,
    currentPeriodEnd: params.currentPeriodEnd ?? undefined,
    willAutoRenew: params.willAutoRenew ?? undefined,
    plan: params.plan ?? undefined,
    lastChecked: new Date().toISOString(),
    lastServerSync: new Date().toISOString(),
    iapVerified: params.iapVerified ?? false,
    entitlementAuthority: source === "session" ? "server" : source,
    pendingServerConfirmation: source !== "session" && params.status === "active",
  });

  const cached = await readStoredSubscriptionState(params.userId);

  if (
    cached &&
    shouldKeepProtectedLocalEntitlement({
      cached,
      incoming: incomingState,
      source,
    })
  ) {
    return cached;
  }

  const state =
    source === "session"
      ? reconcileSessionSubscriptionState(cached, incomingState)
      : incomingState;

  await saveSubscriptionState(state);
  return state;
}

// ─── StoreKit entitlement refresh ────────────────────────────────────────────

/**
 * Query StoreKit for the real current entitlement and update the cache.
 * This must only be used during an explicit purchase or restore flow,
 * never as an automatic replacement for the authenticated account state.
 *
 * IMPORTANT: StoreKit results must still be reconciled back to the
 * authenticated Drive Legal account on the server before premium access is
 * treated as authoritative.
 */
export async function refreshIAPEntitlement(
  userId: string,
): Promise<SubscriptionState> {
  const cached = await getSubscriptionState(userId);

  try {
    const entitlement = await checkCurrentEntitlement();

    if (entitlement.isActive && entitlement.plan) {
      // StoreKit returns purchases bound to the device's Apple ID, not the
      // authenticated Drive Legal account. Only accept the entitlement when it
      // matches the subscription already associated with this account.
      const accountSubscriptionId = cached.subscriptionId;

      if (!accountSubscriptionId) {
        return cached;
      }

      if (
        entitlement.transactionId &&
        entitlement.transactionId !== accountSubscriptionId
      ) {
        console.warn(
          "[IAP] StoreKit transactionId does not match account subscriptionId — rejecting.",
          {
            storeKitTransactionId: entitlement.transactionId,
            accountSubscriptionId,
            userId,
          },
        );
        return cached;
      }

      const periodEnd = entitlement.expiryDate
        ? entitlement.expiryDate.toISOString()
        : estimatePeriodEnd(entitlement.plan, Date.now()).toISOString();

      const updated: SubscriptionState = {
        ...cached,
        userId,
        status: "active",
        plan: entitlement.plan,
        currentPeriodEnd: periodEnd,
        willAutoRenew: entitlement.willAutoRenew ?? cached.willAutoRenew ?? true,
        lastChecked: new Date().toISOString(),
        iapVerified: true,
      };
      const normalised = normaliseSubscriptionState(updated);
      await saveSubscriptionState(normalised);
      return normalised;
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
      const normalised = normaliseSubscriptionState(downgraded);
      await saveSubscriptionState(normalised);
      return normalised;
    }
  } catch {
    // StoreKit unavailable (offline, simulator, etc.) — return cached state.
    // Do NOT downgrade or modify the cached state on network errors.
  }

  return cached;
}

// ─── Post-purchase activation ─────────────────────────────────────────────────

/**
 * Legacy helper for writing an explicitly verified StoreKit result into the
 * local cache. Account access should still be re-synced from the server.
 *
 * The fake "sim_sub_" prefix is explicitly rejected.
 */
export async function activateSubscriptionFromIAP(
  userId: string,
  plan: "monthly" | "annual",
  transactionId: string,
  purchaseTime: number,
): Promise<SubscriptionState> {
  if (transactionId.startsWith("sim_sub_")) {
    throw new Error(
      "Simulated transaction IDs are not accepted. A real StoreKit transaction is required.",
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
    willAutoRenew: true,
    lastChecked: new Date().toISOString(),
    iapVerified: true,
  };

  const normalised = normaliseSubscriptionState(updated);
  await saveSubscriptionState(normalised);
  return normalised;
}

// ─── Read / display helpers ───────────────────────────────────────────────────

/**
 * Read the cached subscription state.
 * Applies a one-way expiry downgrade for non-IAP-verified states only.
 * Never upgrades status automatically.
 */
export async function getSubscriptionState(
  userId: string,
): Promise<SubscriptionState> {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
    if (raw) {
      const state: SubscriptionState = JSON.parse(raw);
      // Only apply local expiry check to states NOT verified by StoreKit,
      // to avoid incorrectly expiring a valid subscription while offline.
      const updated = normaliseSubscriptionState(
        state.iapVerified ? state : applyExpiryCheck(state),
      );
      if (JSON.stringify(updated) !== JSON.stringify(state)) {
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
    Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000,
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

function normaliseSubscriptionState(
  state: SubscriptionState,
): SubscriptionState {
  if (state.status === "cancelled") {
    const periodEnd = parseTime(state.currentPeriodEnd);

    if (typeof periodEnd === "number" && periodEnd > Date.now()) {
      return {
        ...state,
        status: "active",
        willAutoRenew: false,
      };
    }

    return {
      ...state,
      status: "expired",
      willAutoRenew: false,
    };
  }

  if (state.status === "active") {
    return {
      ...state,
      willAutoRenew: state.willAutoRenew ?? true,
    };
  }

  return {
    ...state,
    willAutoRenew: undefined,
  };
}

export async function saveSubscriptionState(
  state: SubscriptionState,
): Promise<void> {
  state.lastChecked = new Date().toISOString();
  await AsyncStorage.setItem(
    `${SUBSCRIPTION_KEY}_${state.userId}`,
    JSON.stringify(state),
  );
}

async function readStoredSubscriptionState(
  userId: string,
): Promise<SubscriptionState | null> {
  try {
    const raw = await AsyncStorage.getItem(`${SUBSCRIPTION_KEY}_${userId}`);
    return raw ? (JSON.parse(raw) as SubscriptionState) : null;
  } catch {
    return null;
  }
}

function reconcileSessionSubscriptionState(
  cached: SubscriptionState | null,
  incoming: SubscriptionState,
): SubscriptionState {
  if (
    cached?.pendingServerConfirmation &&
    matchesProtectedLocalEntitlement(cached, incoming)
  ) {
    return {
      ...incoming,
      iapVerified: cached.iapVerified || incoming.iapVerified,
      pendingServerConfirmation: false,
      entitlementAuthority: "server",
    };
  }

  return incoming;
}

function shouldKeepProtectedLocalEntitlement(params: {
  cached: SubscriptionState;
  incoming: SubscriptionState;
  source: SubscriptionSyncSource;
}): boolean {
  const { cached, incoming, source } = params;

  if (source !== "session" || !cached.pendingServerConfirmation) {
    return false;
  }

  if (matchesProtectedLocalEntitlement(cached, incoming)) {
    return false;
  }

  if (isGenuinelyNewerServerState(cached, incoming)) {
    return false;
  }

  return true;
}

function matchesProtectedLocalEntitlement(
  cached: SubscriptionState,
  incoming: SubscriptionState,
): boolean {
  return (
    cached.status === incoming.status &&
    cached.plan === incoming.plan &&
    normaliseSubscriptionId(cached.subscriptionId) ===
      normaliseSubscriptionId(incoming.subscriptionId)
  );
}

function isGenuinelyNewerServerState(
  cached: SubscriptionState,
  incoming: SubscriptionState,
): boolean {
  const cachedId = normaliseSubscriptionId(cached.subscriptionId);
  const incomingId = normaliseSubscriptionId(incoming.subscriptionId);

  if (!cachedId || !incomingId || cachedId !== incomingId) {
    return false;
  }

  if (
    cached.status === "active" &&
    (incoming.status === "expired" || incoming.status === "cancelled")
  ) {
    return true;
  }

  const cachedPeriodEnd = parseTime(cached.currentPeriodEnd);
  const incomingPeriodEnd = parseTime(incoming.currentPeriodEnd);

  if (
    incoming.status === "active" &&
    typeof cachedPeriodEnd === "number" &&
    typeof incomingPeriodEnd === "number" &&
    incomingPeriodEnd > cachedPeriodEnd
  ) {
    return true;
  }

  return false;
}

function normaliseSubscriptionId(
  subscriptionId?: string | null,
): string | null {
  if (!subscriptionId) return null;
  const trimmed = subscriptionId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
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
