import { describe, expect, it } from "vitest";

import { getActiveSubscriptionSummary } from "../lib/subscription-display";

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
});
