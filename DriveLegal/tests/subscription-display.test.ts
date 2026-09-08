import { describe, expect, it } from "vitest";

import {
  getActiveSubscriptionSummary,
  hasMatchingActiveEntitlement,
  hasPriorSubscriptionEvidence,
  shouldShowSubscriptionCheckingState,
} from "../lib/subscription-display";

describe("active subscription summary", () => {
  it("formats active subscription plan, price, and renewal date", () => {
    const summary = getActiveSubscriptionSummary({
      subscriptionState: {
        plan: "monthly",
        currentPeriodEnd: "2026-09-07T00:00:00.000Z",
      },
      productsByPlan: {
        monthly: {
          displayPrice: "NZ$6.99",
        },
      },
    });

    expect(summary.planLabel).toBe("Monthly");
    expect(summary.priceLabel).toBe("NZ$6.99/month");
    expect(summary.renewalLabel).toBe(
      new Intl.DateTimeFormat(undefined, {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date("2026-09-07T00:00:00.000Z")),
    );
  });

  it("treats previous subscription metadata as evidence for a pending check", () => {
    const state = {
      status: "expired" as const,
      subscriptionId: "orig-1",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
      plan: "monthly" as const,
      iapVerified: false,
    };

    expect(hasPriorSubscriptionEvidence(state)).toBe(true);
    expect(
      shouldShowSubscriptionCheckingState({
        subscriptionState: state,
        verificationFailed: true,
        hasDeviceEntitlement: false,
      }),
    ).toBe(true);
  });

  it("treats a matching active StoreKit entitlement as pending verification evidence", () => {
    expect(
      hasMatchingActiveEntitlement({
        subscriptionState: { subscriptionId: "orig-1" },
        entitlement: {
          isActive: true,
          plan: "monthly",
          transactionId: "txn-1",
          originalTransactionId: "orig-1",
        },
      }),
    ).toBe(true);
  });

  it("does not show a checking state after a confirmed non-error expired state", () => {
    expect(
      shouldShowSubscriptionCheckingState({
        subscriptionState: {
          status: "expired",
          subscriptionId: null,
          currentPeriodEnd: null,
          plan: undefined,
          iapVerified: false,
        },
        verificationFailed: false,
        hasDeviceEntitlement: false,
      }),
    ).toBe(false);
  });
});
