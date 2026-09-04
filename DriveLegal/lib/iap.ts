/**
 * Apple In-App Purchase integration for Drive Legal.
 *
 * Uses react-native-iap as the direct StoreKit wrapper — no third-party
 * subscription management service is required.
 *
 * How entitlement checking works
 * ────────────────────────────────
 * `IAP.getAvailablePurchases()` returns only purchases that are currently
 * active and non-expired.  Apple removes a subscription from this list as
 * soon as it expires or is cancelled and the billing period ends.
 * Historical lapsed purchases are NOT included.
 *
 * This means:
 *   - Active subscription         → present in getAvailablePurchases()
 *   - Expired subscription        → absent
 *   - Cancelled (within period)   → present until billing period ends
 *   - Cancelled (period ended)    → absent
 *   - No purchase                 → absent
 *   - Network/StoreKit error      → throws; callers fail-safe (no access granted)
 *
 * No API key, p8 key, or external service is required.
 *
 * App Store Connect setup required
 * ─────────────────────────────────
 * 1. Paid Apps Agreement must be active (Agreements, Tax, and Banking).
 * 2. Create a Subscription Group (e.g. "Drive Legal Premium").
 * 3. Create two Auto-Renewable Subscriptions inside that group:
 *      Product ID:  com.drivelegal.app.monthly
 *      Display name: Drive Legal Monthly
 *      Price: NZD $6.99/month
 *
 *      Product ID:  com.drivelegal.app.annual
 *      Display name: Drive Legal Annual
 *      Price: NZD $69.99/year
 * 4. On each product (or on the group) configure a free-trial introductory
 *    offer: 21 days free, then full price.
 * 5. Set both products to "Ready to Submit" before submitting build 87.
 *
 * Apple Developer Portal / Codemagic
 * ────────────────────────────────────
 * • Ensure the In-App Purchase capability is enabled on the app.drivelegal.mobile App ID.
 * • No additional provisioning profile changes are required — the standard
 *   distribution profile covers IAP when the capability is enabled.
 */

import * as IAP from "react-native-iap";
import { Platform } from "react-native";

// ─── Product IDs ──────────────────────────────────────────────────────────────
// These must be identical to the Product IDs in App Store Connect.
export const IAP_PRODUCT_IDS = {
  monthly: "com.drivelegal.app.monthly",
  annual: "com.drivelegal.app.annual",
} as const;

export type IAPPlan = keyof typeof IAP_PRODUCT_IDS;

export type IAPProduct = {
  productId: string;
  title: string;
  description: string;
  price: string; // Apple-localised display string e.g. "NZ$6.99"
  displayPrice: string;
  priceAmountMicros: number;
  priceCurrencyCode: string;
};

export type PurchaseResult =
  | {
      success: true;
      plan: IAPPlan;
      transactionId: string;
      originalTransactionId: string | null;
      purchaseTime: number;
      appAccountToken: string | null;
    }
  | { success: false; cancelled: boolean; error: string };

export type EntitlementResult = {
  isActive: boolean;
  plan: IAPPlan | null;
  /** Verified expiry date — set when StoreKit provides it, null otherwise */
  expiryDate: Date | null;
  /** Whether StoreKit says the current subscription will auto-renew */
  willAutoRenew: boolean | null;
  /** The App Store product identifier for the active purchase */
  transactionId: string | null;
  originalTransactionId: string | null;
  appAccountToken: string | null;
};

type ActivePurchaseAttempt = {
  id: symbol;
  sku: string;
  requestedAppAccountToken?: string | null;
};

// ─── Connection ───────────────────────────────────────────────────────────────

let connected = false;
let activePurchaseAttempt: ActivePurchaseAttempt | null = null;

/**
 * Open the StoreKit payment queue connection.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
async function ensureConnected(): Promise<void> {
  if (!isIOS() || connected) return;
  IAP.setup({ storekitMode: "STOREKIT_HYBRID_MODE" });
  await IAP.initConnection();
  connected = true;
}

/**
 * Close the StoreKit connection.  Call on app unmount if desired.
 * Internal use only — not exported because callers use the higher-level functions.
 */
export async function teardownIAP(): Promise<void> {
  if (!isIOS() || !connected) return;
  try {
    await IAP.endConnection();
  } catch {
    // best-effort
  }
  connected = false;
}

// ─── Product Loading ──────────────────────────────────────────────────────────

/**
 * Fetch localised subscription product metadata from the App Store.
 * Returns an empty array on non-iOS platforms or if the products are not
 * yet configured in App Store Connect.
 */
export async function loadIAPProducts(): Promise<IAPProduct[]> {
  if (!isIOS()) return [];

  try {
    await ensureConnected();

    const skus = Object.values(IAP_PRODUCT_IDS);
    const products = await IAP.getSubscriptions({ skus });

    for (const sku of skus) {
      const product = products.find((p) => p.productId === sku);

      if (!product) {
        console.warn("[IAP] StoreKit product missing:", { productId: sku });
        continue;
      }

      console.log("[IAP] StoreKit product loaded:", {
        productId: product.productId,
        displayPrice:
          (product as any).displayPrice ??
          (product as any).localizedPrice ??
          null,
        localizedPrice: (product as any).localizedPrice ?? null,
        price: (product as any).price ?? null,
        priceLocaleCurrencyCode:
          (product as any).priceLocale?.currencyCode ??
          (product as any).currency ??
          null,
        title: product.title ?? null,
      });
    }

    return products
      .filter((p) => skus.includes(p.productId as any))
      .map((p) => {
        const displayPrice =
          (p as any).displayPrice ??
          (p as any).localizedPrice ??
          (p as any).price ??
          "";
        // price is the numeric amount as a string on iOS
        const priceNum = parseFloat((p as any).price ?? "0");
        const currency =
          (p as any).priceLocale?.currencyCode ?? (p as any).currency ?? "NZD";

        return {
          productId: p.productId,
          title: p.title,
          description: p.description,
          price: displayPrice,
          displayPrice,
          priceAmountMicros: Math.round(priceNum * 1_000_000),
          priceCurrencyCode: currency,
        };
      });
  } catch (err) {
    console.warn("[IAP] loadIAPProducts failed:", err);
    return [];
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Initiate a StoreKit subscription purchase for the given plan.
 * Displays Apple's native payment sheet.
 *
 * react-native-iap v12 uses a purchase-listener pattern.  We attach a
 * one-shot listener before calling requestSubscription(), resolve when a
 * result arrives, and remove the listener afterward.
 */
export async function purchasePlan(
  plan: IAPPlan,
  appAccountToken?: string | null,
): Promise<PurchaseResult> {
  if (!isIOS()) {
    return {
      success: false,
      cancelled: false,
      error: "In-app purchases are only available on iOS.",
    };
  }

  await ensureConnected();

  const sku = IAP_PRODUCT_IDS[plan];
  const purchaseAttempt: ActivePurchaseAttempt = {
    id: Symbol(`purchase:${sku}`),
    sku,
    requestedAppAccountToken: appAccountToken,
  };

  if (activePurchaseAttempt) {
    return {
      success: false,
      cancelled: false,
      error: "Another subscription purchase is already in progress.",
    };
  }

  activePurchaseAttempt = purchaseAttempt;

  return new Promise<PurchaseResult>((resolve) => {
    let settled = false;

    function settle(result: PurchaseResult) {
      if (settled) return;
      settled = true;
      if (activePurchaseAttempt?.id === purchaseAttempt.id) {
        activePurchaseAttempt = null;
      }
      purchaseUpdateSubscription?.remove?.();
      purchaseErrorSubscription?.remove?.();
      resolve(result);
    }

    // Listen for a successful purchase
    const purchaseUpdateSubscription = IAP.purchaseUpdatedListener(
      async (purchase: IAP.SubscriptionPurchase | IAP.ProductPurchase) => {
        if (purchase.productId !== sku) return;
        if (activePurchaseAttempt?.id !== purchaseAttempt.id) return;

        try {
          // Acknowledge/finish the transaction so Apple clears the queue
          await IAP.finishTransaction({ purchase, isConsumable: false });
        } catch {
          // If finish fails the transaction will be retried on next launch
        }

        const returnedAppAccountToken = (purchase as any).appAccountToken;

        settle({
          success: true,
          plan,
          transactionId: purchase.transactionId ?? sku,
          originalTransactionId:
            (purchase as any).originalTransactionIdentifierIOS ?? null,
          purchaseTime: purchase.transactionDate
            ? new Date(purchase.transactionDate).getTime()
            : Date.now(),
          appAccountToken: resolvePurchaseAppAccountToken(
            returnedAppAccountToken,
            purchaseAttempt.requestedAppAccountToken,
          ),
        });
      },
    );

    // Listen for purchase errors
    const purchaseErrorSubscription = IAP.purchaseErrorListener(
      (error: IAP.PurchaseError) => {
        if ((error as any).productId && (error as any).productId !== sku)
          return;

        // E_USER_CANCELLED is thrown when the user dismisses the sheet
        if (error.code === "E_USER_CANCELLED") {
          settle({
            success: false,
            cancelled: true,
            error: "Purchase cancelled.",
          });
          return;
        }

        settle({
          success: false,
          cancelled: false,
          error: error.message ?? "Purchase failed. Please try again.",
        });
      },
    );

    // Trigger Apple's native payment sheet
    IAP.requestSubscription({
      sku,
      appAccountToken: purchaseAttempt.requestedAppAccountToken,
    }).catch((err: any) => {
      if (err?.code === "E_USER_CANCELLED") {
        settle({
          success: false,
          cancelled: true,
          error: "Purchase cancelled.",
        });
      } else {
        settle({
          success: false,
          cancelled: false,
          error: err?.message ?? "Unable to initiate purchase.",
        });
      }
    });
  });
}

// ─── Live Entitlement Check ───────────────────────────────────────────────────

/**
 * Query Apple for the user's CURRENT active subscription entitlement.
 *
 * `getAvailablePurchases()` returns only active, non-expired purchases.
 * Expired, cancelled-and-lapsed, and never-purchased states all return an
 * empty list.  This is the correct production entitlement check.
 *
 * On network/StoreKit error this throws — callers must handle errors safely
 * and must NOT grant premium access merely because an error occurred.
 */
export async function checkCurrentEntitlement(): Promise<EntitlementResult> {
  if (!isIOS()) {
    return {
      isActive: false,
      plan: null,
      expiryDate: null,
      willAutoRenew: null,
      transactionId: null,
      originalTransactionId: null,
      appAccountToken: null,
    };
  }

  await ensureConnected();

  await IAP.getSubscriptions({
    skus: Object.values(IAP_PRODUCT_IDS),
  });

  const purchases = await IAP.getAvailablePurchases();

  const knownSkus = Object.values(IAP_PRODUCT_IDS) as string[];

  // Find the most recent purchase for one of our subscription product IDs
  const active = purchases
    .filter((p) => knownSkus.includes(p.productId))
    .sort((a, b) => {
      const ta = a.transactionDate ? new Date(a.transactionDate).getTime() : 0;
      const tb = b.transactionDate ? new Date(b.transactionDate).getTime() : 0;
      return tb - ta;
    });

  if (active.length === 0) {
    return {
      isActive: false,
      plan: null,
      expiryDate: null,
      willAutoRenew: null,
      transactionId: null,
      originalTransactionId: null,
      appAccountToken: null,
    };
  }

  const latest = active[0];
  const plan = planFromProductId(latest.productId);

  // On iOS, auto-renewable subscription receipts do not embed a plain expiry
  // field in the JS object from react-native-iap v12.  The presence in
  // getAvailablePurchases() is itself the proof of an active subscription.
  // We estimate the period end for display purposes only.
  const purchaseTime = latest.transactionDate
    ? new Date(latest.transactionDate).getTime()
    : Date.now();
  let expiryDate = plan ? estimatePeriodEnd(plan, purchaseTime) : null;
  let willAutoRenew: boolean | null = null;

  if (plan) {
    const sk2Details = await getSk2SubscriptionDetails(latest.productId);
    if (sk2Details.expiryDate) {
      expiryDate = sk2Details.expiryDate;
    }
    willAutoRenew = sk2Details.willAutoRenew;
  }

  return {
    isActive: true,
    plan,
    expiryDate,
    willAutoRenew,
    transactionId: latest.transactionId ?? latest.productId,
    originalTransactionId:
      (latest as any).originalTransactionIdentifierIOS ?? null,
    appAccountToken: (latest as any).appAccountToken ?? null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isIOS(): boolean {
  return Platform.OS === "ios";
}

function resolvePurchaseAppAccountToken(
  returnedAppAccountToken: unknown,
  requestedAppAccountToken?: string | null,
): string | null {
  if (
    typeof returnedAppAccountToken === "string" &&
    returnedAppAccountToken.length > 0
  ) {
    return returnedAppAccountToken;
  }

  if (
    requestedAppAccountToken === null ||
    typeof requestedAppAccountToken === "undefined"
  ) {
    return null;
  }

  return requestedAppAccountToken;
}

export function planFromProductId(productId: string): IAPPlan | null {
  for (const [plan, id] of Object.entries(IAP_PRODUCT_IDS)) {
    if (id === productId) return plan as IAPPlan;
  }
  return null;
}

/** Compute an approximate period-end date from a purchase time for UI display. */
export function estimatePeriodEnd(plan: IAPPlan, purchaseTime: number): Date {
  const d = new Date(purchaseTime);
  if (plan === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

async function getSk2SubscriptionDetails(productId: string): Promise<{
  expiryDate: Date | null;
  willAutoRenew: boolean | null;
}> {
  const currentEntitlement = IAP.IapIosSk2?.currentEntitlement;
  const subscriptionStatus = IAP.IapIosSk2?.subscriptionStatus;

  if (
    typeof currentEntitlement !== "function" ||
    typeof subscriptionStatus !== "function"
  ) {
    return {
      expiryDate: null,
      willAutoRenew: null,
    };
  }

  const [transaction, statuses] = await Promise.all([
    currentEntitlement(productId).catch(() => null),
    subscriptionStatus(productId).catch(() => null),
  ]);

  const expirationDate =
    typeof transaction?.expirationDate === "number" &&
    Number.isFinite(transaction.expirationDate)
      ? new Date(transaction.expirationDate)
      : null;

  const activeStatus = Array.isArray(statuses)
    ? statuses.find((status) => isActiveSubscriptionStatus(status))
    : null;

  return {
    expiryDate: expirationDate,
    willAutoRenew:
      typeof activeStatus?.renewalInfo?.willAutoRenew === "boolean"
        ? activeStatus.renewalInfo.willAutoRenew
        : null,
  };
}

function isActiveSubscriptionStatus(status: {
  state?: string | null;
}): boolean {
  return (
    status.state === "subscribed" ||
    status.state === "inGracePeriod" ||
    status.state === "inBillingRetryPeriod"
  );
}
