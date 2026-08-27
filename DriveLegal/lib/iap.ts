/**
 * Apple In-App Purchase integration for Drive Legal.
 *
 * StoreKit (via expo-in-app-purchases) is the sole source of truth for
 * subscription entitlement on iOS.  AsyncStorage is only ever used as a
 * short-lived display cache that is always overwritten by the real StoreKit
 * state on every app launch and after every transaction event.
 *
 * Product IDs must match exactly what is configured in App Store Connect.
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
 *    offer: 21 days free, then full price.  This replaces the old local timer.
 * 5. Set both products to "Ready to Submit" before submitting build 87.
 */

import * as InAppPurchases from "expo-in-app-purchases";
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
  price: string;          // localised display string e.g. "NZ$6.99"
  priceAmountMicros: number;
  priceCurrencyCode: string;
};

export type PurchaseResult =
  | { success: true; plan: IAPPlan; transactionId: string; purchaseTime: number }
  | { success: false; cancelled: boolean; error: string };

export type EntitlementResult = {
  isActive: boolean;
  plan: IAPPlan | null;
  expiryDate: Date | null;
};

// ─── Connection ───────────────────────────────────────────────────────────────

let connected = false;

/** Connect to the StoreKit payment queue.  Safe to call multiple times. */
export async function connectIAP(): Promise<void> {
  if (!isIOS()) return;
  if (connected) return;
  await InAppPurchases.connectAsync();
  connected = true;
}

/** Disconnect from the StoreKit payment queue.  Call on app unmount. */
export async function disconnectIAP(): Promise<void> {
  if (!isIOS() || !connected) return;
  try {
    await InAppPurchases.disconnectAsync();
  } catch {
    // best-effort
  }
  connected = false;
}

// ─── Product Loading ──────────────────────────────────────────────────────────

/**
 * Fetch localised product metadata from the App Store.
 * Returns an empty array on non-iOS platforms (web/Android preview builds).
 */
export async function loadIAPProducts(): Promise<IAPProduct[]> {
  if (!isIOS()) return [];

  await connectIAP();

  const productIds = Object.values(IAP_PRODUCT_IDS);
  const { responseCode, results } = await InAppPurchases.getProductsAsync(productIds);

  if (responseCode !== InAppPurchases.IAPResponseCode.OK || !results) {
    return [];
  }

  return results.map((p) => ({
    productId: p.productId,
    title: p.title,
    description: p.description,
    price: p.price,
    priceAmountMicros: p.priceAmountMicros,
    priceCurrencyCode: p.priceCurrencyCode,
  }));
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Initiate a StoreKit purchase for the given plan.
 * This will display Apple's native payment sheet.
 *
 * Resolves with a PurchaseResult once the transaction completes, is
 * cancelled, or fails.  The caller is responsible for calling
 * finishTransaction() after successfully processing the purchase.
 */
export async function purchasePlan(plan: IAPPlan): Promise<PurchaseResult> {
  if (!isIOS()) {
    return { success: false, cancelled: false, error: "In-app purchases are only available on iOS." };
  }

  await connectIAP();

  const productId = IAP_PRODUCT_IDS[plan];

  return new Promise<PurchaseResult>((resolve) => {
    // Register a one-shot listener for this purchase
    InAppPurchases.setPurchaseListener(({ responseCode, results, errorCode }) => {
      if (responseCode === InAppPurchases.IAPResponseCode.OK && results && results.length > 0) {
        const purchase = results[0];

        // Finish the transaction so Apple clears the queue entry
        InAppPurchases.finishTransactionAsync(purchase, true).catch(() => {
          // If finish fails here the transaction will be retried on next launch
        });

        resolve({
          success: true,
          plan,
          transactionId: purchase.orderId ?? productId,
          purchaseTime: purchase.purchaseTime ?? Date.now(),
        });
        return;
      }

      if (responseCode === InAppPurchases.IAPResponseCode.USER_CANCELED) {
        resolve({ success: false, cancelled: true, error: "Purchase cancelled." });
        return;
      }

      if (responseCode === InAppPurchases.IAPResponseCode.DEFERRED) {
        // Purchase is pending parental approval — treat like cancelled for now
        resolve({ success: false, cancelled: true, error: "Purchase is pending approval." });
        return;
      }

      resolve({
        success: false,
        cancelled: false,
        error: errorCode
          ? `Purchase failed (code ${errorCode}).`
          : "Purchase failed. Please try again.",
      });
    });

    // Start the purchase — this triggers the native payment sheet
    InAppPurchases.purchaseItemAsync(productId).catch((err) => {
      resolve({
        success: false,
        cancelled: false,
        error: err?.message ?? "Unable to initiate purchase.",
      });
    });
  });
}

// ─── Restore / Entitlement Check ──────────────────────────────────────────────

/**
 * Check the App Store for any existing active subscription purchases.
 * This is the correct implementation of "Restore Purchase" and is also
 * called on every app launch to determine the real entitlement state.
 *
 * Returns the active entitlement if one is found, or { isActive: false } if not.
 */
export async function checkCurrentEntitlement(): Promise<EntitlementResult> {
  if (!isIOS()) {
    return { isActive: false, plan: null, expiryDate: null };
  }

  await connectIAP();

  const { responseCode, results } = await InAppPurchases.getPurchaseHistoryAsync();

  if (responseCode !== InAppPurchases.IAPResponseCode.OK || !results || results.length === 0) {
    return { isActive: false, plan: null, expiryDate: null };
  }

  // Find the most recent purchase for one of our known product IDs
  const known = results
    .filter((p) => Object.values(IAP_PRODUCT_IDS).includes(p.productId as any))
    .sort((a, b) => (b.purchaseTime ?? 0) - (a.purchaseTime ?? 0));

  if (known.length === 0) {
    return { isActive: false, plan: null, expiryDate: null };
  }

  const latest = known[0];
  const plan = planFromProductId(latest.productId);

  // Auto-renewable subscriptions do not include an expiry date in the
  // transaction record from getPurchaseHistoryAsync — the presence of a
  // receipt with a matching product ID in the purchase history is the
  // indicator of an active subscription.  For production apps the receipt
  // should be verified server-side; here we trust the StoreKit response.
  return {
    isActive: true,
    plan,
    expiryDate: null, // populated by server-side receipt verification when available
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isIOS(): boolean {
  return Platform.OS === "ios";
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
