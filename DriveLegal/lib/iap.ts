/**
 * Apple In-App Purchase integration for Drive Legal.
 *
 * Uses RevenueCat (react-native-purchases) as the StoreKit layer.
 * RevenueCat's `Purchases.getCustomerInfo()` returns ONLY currently-active,
 * non-expired entitlements — an expired or cancelled subscription is NOT
 * present in `customerInfo.entitlements.active`.  This is the correct live
 * entitlement check; purchase history alone is never used to grant access.
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
 *    offer: 21 days free, then full price.
 * 5. Set both products to "Ready to Submit" before submitting build 87.
 *
 * RevenueCat dashboard setup required
 * ────────────────────────────────────
 * 1. Create a RevenueCat project and add the iOS app with bundle ID
 *    app.drivelegal.mobile.
 * 2. Add both products to a RevenueCat Offering.
 * 3. Create an Entitlement called "premium" and attach both products to it.
 * 4. Copy the RevenueCat iOS API key and set it as
 *    EXPO_PUBLIC_REVENUECAT_IOS_KEY in your EAS / .env configuration.
 */

import Purchases, {
  type CustomerInfo,
  type PurchasesPackage,
  LOG_LEVEL,
} from "react-native-purchases";
import { Platform } from "react-native";

// ─── Product IDs ──────────────────────────────────────────────────────────────
// These must be identical to the Product IDs in App Store Connect.
export const IAP_PRODUCT_IDS = {
  monthly: "com.drivelegal.app.monthly",
  annual: "com.drivelegal.app.annual",
} as const;

// The RevenueCat entitlement identifier configured in the RC dashboard.
// Must match exactly — case-sensitive.
export const RC_ENTITLEMENT_ID = "premium";

export type IAPPlan = keyof typeof IAP_PRODUCT_IDS;

export type IAPProduct = {
  productId: string;
  title: string;
  description: string;
  price: string;            // localised display string e.g. "NZ$6.99"
  priceAmountMicros: number;
  priceCurrencyCode: string;
};

export type PurchaseResult =
  | { success: true; plan: IAPPlan; transactionId: string; purchaseTime: number }
  | { success: false; cancelled: boolean; error: string };

export type EntitlementResult = {
  isActive: boolean;
  plan: IAPPlan | null;
  /** The verified expiry date from RevenueCat — never null when isActive is true. */
  expiryDate: Date | null;
  /** The App Store product identifier confirmed by RevenueCat. */
  transactionId: string | null;
};

// ─── Initialisation ───────────────────────────────────────────────────────────

let initialised = false;

/**
 * Initialise the RevenueCat SDK.  Must be called once before any other IAP
 * function.  Safe to call multiple times — subsequent calls are no-ops.
 */
export function initIAP(): void {
  if (!isIOS() || initialised) return;

  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) {
    console.warn("[IAP] EXPO_PUBLIC_REVENUECAT_IOS_KEY is not set. IAP will not function.");
    return;
  }

  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey });
  initialised = true;
}

// ─── Product Loading ──────────────────────────────────────────────────────────

/**
 * Fetch localised product metadata from the App Store via RevenueCat.
 * Returns an empty array on non-iOS platforms.
 */
export async function loadIAPProducts(): Promise<IAPProduct[]> {
  if (!isIOS()) return [];

  initIAP();

  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];

    return current.availablePackages
      .map((pkg) => {
        const product = pkg.product;
        return {
          productId: product.identifier,
          title: product.title,
          description: product.description,
          price: product.priceString,
          priceAmountMicros: Math.round(product.price * 1_000_000),
          priceCurrencyCode: product.currencyCode ?? "NZD",
        };
      })
      .filter((p) =>
        Object.values(IAP_PRODUCT_IDS).includes(p.productId as any)
      );
  } catch (err) {
    console.warn("[IAP] loadIAPProducts failed:", err);
    return [];
  }
}

// ─── Purchase ─────────────────────────────────────────────────────────────────

/**
 * Initiate a StoreKit purchase for the given plan via RevenueCat.
 * Displays Apple's native payment sheet.
 *
 * Resolves with a PurchaseResult once the transaction completes or fails.
 */
export async function purchasePlan(plan: IAPPlan): Promise<PurchaseResult> {
  if (!isIOS()) {
    return {
      success: false,
      cancelled: false,
      error: "In-app purchases are only available on iOS.",
    };
  }

  initIAP();

  try {
    const offerings = await Purchases.getOfferings();
    const pkg = findPackageForPlan(offerings.current?.availablePackages ?? [], plan);

    if (!pkg) {
      return {
        success: false,
        cancelled: false,
        error: `Product ${IAP_PRODUCT_IDS[plan]} not found in App Store. Ensure it is configured and Ready to Submit in App Store Connect.`,
      };
    }

    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Verify the entitlement is now active after purchase
    const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT_ID];
    if (!entitlement) {
      return {
        success: false,
        cancelled: false,
        error: "Purchase completed but entitlement was not activated. Please try Restore Purchase.",
      };
    }

    return {
      success: true,
      plan,
      transactionId: entitlement.productIdentifier,
      purchaseTime: new Date(entitlement.latestPurchaseDateMillis ?? Date.now()).getTime(),
    };
  } catch (err: any) {
    // RevenueCat throws an error with `userCancelled: true` when the user
    // dismisses the payment sheet
    if (err?.userCancelled === true) {
      return { success: false, cancelled: true, error: "Purchase cancelled." };
    }
    return {
      success: false,
      cancelled: false,
      error: err?.message ?? "Purchase failed. Please try again.",
    };
  }
}

// ─── Live Entitlement Check ───────────────────────────────────────────────────

/**
 * Query RevenueCat for the user's CURRENT active subscription entitlement.
 *
 * IMPORTANT: `customerInfo.entitlements.active` contains ONLY entitlements
 * that are currently active and not expired.  RevenueCat removes an
 * entitlement from the active map as soon as it expires or is cancelled and
 * the billing period ends.  Historical (lapsed) purchases are NOT included.
 *
 * This means:
 *   - Active subscription → isActive: true, correct expiryDate
 *   - Expired subscription → isActive: false
 *   - Cancelled but still within billing period → isActive: true until expiry
 *   - Cancelled and billing period ended → isActive: false
 *   - No purchase → isActive: false
 *   - Network error → throws; caller must handle safely (do NOT grant access)
 */
export async function checkCurrentEntitlement(): Promise<EntitlementResult> {
  if (!isIOS()) {
    return { isActive: false, plan: null, expiryDate: null, transactionId: null };
  }

  initIAP();

  // Fetch fresh CustomerInfo from RevenueCat (hits Apple servers).
  const customerInfo: CustomerInfo = await Purchases.getCustomerInfo();

  const entitlement = customerInfo.entitlements.active[RC_ENTITLEMENT_ID];

  if (!entitlement) {
    return { isActive: false, plan: null, expiryDate: null, transactionId: null };
  }

  const plan = planFromProductId(entitlement.productIdentifier);

  // expirationDate is null for lifetime purchases; for auto-renewable
  // subscriptions it is always set to the end of the current billing period.
  const expiryDate = entitlement.expirationDate
    ? new Date(entitlement.expirationDate)
    : null;

  return {
    isActive: true,
    plan,
    expiryDate,
    transactionId: entitlement.productIdentifier,
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

/** Find the RevenueCat Package for a given plan. */
function findPackageForPlan(
  packages: PurchasesPackage[],
  plan: IAPPlan
): PurchasesPackage | undefined {
  return packages.find((pkg) => pkg.product.identifier === IAP_PRODUCT_IDS[plan]);
}

/** Compute an approximate period-end date from a purchase time for UI display fallback. */
export function estimatePeriodEnd(plan: IAPPlan, purchaseTime: number): Date {
  const d = new Date(purchaseTime);
  if (plan === "annual") {
    d.setFullYear(d.getFullYear() + 1);
  } else {
    d.setMonth(d.getMonth() + 1);
  }
  return d;
}

