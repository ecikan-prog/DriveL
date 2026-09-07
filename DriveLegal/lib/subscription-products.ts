export const SUBSCRIPTION_PRODUCT_IDS = {
  monthly: "com.drivelegal.app.monthly",
  annual: "com.drivelegal.app.annual",
} as const;

export type SubscriptionPlan = keyof typeof SUBSCRIPTION_PRODUCT_IDS;

export function getSubscriptionPlanLabel(
  plan?: SubscriptionPlan | null,
): string | null {
  if (plan === "monthly") return "Monthly";
  if (plan === "annual") return "Annual";
  return null;
}

export function getSubscriptionPeriodLabel(
  plan?: SubscriptionPlan | null,
): string | null {
  if (plan === "monthly") return "/month";
  if (plan === "annual") return "/year";
  return null;
}

export function planFromProductId(
  productId?: string | null,
): SubscriptionPlan | null {
  if (productId === SUBSCRIPTION_PRODUCT_IDS.monthly) {
    return "monthly";
  }

  if (productId === SUBSCRIPTION_PRODUCT_IDS.annual) {
    return "annual";
  }

  return null;
}
