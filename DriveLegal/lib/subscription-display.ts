import type { SubscriptionState } from "./subscription";
import {
  getSubscriptionPeriodLabel,
  getSubscriptionPlanLabel,
  type SubscriptionPlan,
} from "./subscription-products";

type SubscriptionProductLike = {
  displayPrice?: string | null;
  price?: string | null;
};

export type ActiveSubscriptionSummary = {
  planLabel: string | null;
  priceLabel: string | null;
  renewalLabel: string | null;
};

export function getActiveSubscriptionSummary(params: {
  subscriptionState: Pick<SubscriptionState, "plan" | "currentPeriodEnd"> | null;
  productsByPlan?: Partial<Record<SubscriptionPlan, SubscriptionProductLike | null>>;
}): ActiveSubscriptionSummary {
  const { subscriptionState, productsByPlan } = params;
  const plan = subscriptionState?.plan;
  const product = plan ? productsByPlan?.[plan] : null;
  const rawPrice = product?.displayPrice ?? product?.price ?? null;
  const period = getSubscriptionPeriodLabel(plan);

  return {
    planLabel: getSubscriptionPlanLabel(plan),
    priceLabel: rawPrice && period ? `${rawPrice}${period}` : rawPrice,
    renewalLabel: formatRenewalLabel(subscriptionState?.currentPeriodEnd),
  };
}

export function formatRenewalLabel(value?: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
