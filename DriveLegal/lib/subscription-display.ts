import type { SubscriptionState } from "./subscription";
import {
  getSubscriptionPeriodLabel,
  getSubscriptionPlanLabel,
  type SubscriptionPlan,
} from "./subscription-products";
import type { EntitlementResult } from "./iap";

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

export function hasPriorSubscriptionEvidence(
  state:
    | Pick<
        SubscriptionState,
        "status" | "subscriptionId" | "currentPeriodEnd" | "plan" | "iapVerified"
      >
    | null
    | undefined,
): boolean {
  return Boolean(
    state &&
      (state.status === "active" ||
        state.iapVerified ||
        state.subscriptionId ||
        state.currentPeriodEnd ||
        state.plan),
  );
}

export function hasMatchingActiveEntitlement(params: {
  subscriptionState: Pick<SubscriptionState, "subscriptionId"> | null | undefined;
  entitlement: Pick<
    EntitlementResult,
    "isActive" | "plan" | "transactionId" | "originalTransactionId"
  >;
}): boolean {
  const { subscriptionState, entitlement } = params;

  if (!entitlement.isActive || !entitlement.plan) {
    return false;
  }

  const knownSubscriptionId = normaliseSubscriptionId(
    subscriptionState?.subscriptionId,
  );

  if (!knownSubscriptionId) {
    return true;
  }

  return (
    knownSubscriptionId ===
      normaliseSubscriptionId(entitlement.originalTransactionId) ||
    knownSubscriptionId === normaliseSubscriptionId(entitlement.transactionId)
  );
}

export function shouldShowSubscriptionCheckingState(params: {
  subscriptionState:
    | Pick<
        SubscriptionState,
        "status" | "subscriptionId" | "currentPeriodEnd" | "plan" | "iapVerified"
      >
    | null
    | undefined;
  verificationFailed: boolean;
  hasDeviceEntitlement: boolean;
}): boolean {
  if (!params.verificationFailed) {
    return false;
  }

  return (
    params.hasDeviceEntitlement ||
    hasPriorSubscriptionEvidence(params.subscriptionState)
  );
}

function normaliseSubscriptionId(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
