import { describe, expect, it } from "vitest";

import {
  getAdminSubscriptionStatus,
  summariseAdminSubscriptionStatuses,
} from "../server/admin-subscription-status";

const NOW = new Date("2026-10-09T03:00:00.000Z").getTime();
// 21-day trial starting 3 Sep 2026 expired on 24 Sep 2026.
const EXPIRED_TRIAL_START = "2026-09-03T00:00:00.000Z";
const ACTIVE_TRIAL_START = "2026-10-01T00:00:00.000Z";

describe("admin subscription status", () => {
  it("shows an active paid subscription after the trial expired", () => {
    const status = getAdminSubscriptionStatus(
      {
        trialStartDate: EXPIRED_TRIAL_START,
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        subscriptionId: "2000000123456789",
        currentPeriodEnd: "2026-11-09T03:00:00.000Z",
      },
      NOW,
    );

    expect(status.kind).toBe("active");
    expect(status.label).toBe("Active · Monthly");
    expect(status.className).toBe("active");
    expect(status.plan).toBe("monthly");
    expect(status.paid).toBe(true);
    expect(status.dateLabel).toBe("Renews");
    expect(status.date?.toISOString()).toBe("2026-11-09T03:00:00.000Z");
    // The historical trial is still reported as expired but does not
    // override the paid status.
    expect(status.trial.expired).toBe(true);
  });

  it("shows an active paid subscription when the renewal date is unknown", () => {
    const status = getAdminSubscriptionStatus(
      {
        trialStartDate: EXPIRED_TRIAL_START,
        subscriptionStatus: "active",
        subscriptionPlan: "annual",
        currentPeriodEnd: null,
      },
      NOW,
    );

    expect(status.kind).toBe("active");
    expect(status.label).toBe("Active · Annual");
    expect(status.date).toBeNull();
  });

  it("keeps genuine expired trials classified as trial expired", () => {
    for (const subscriptionStatus of ["trial", "expired", null, undefined]) {
      const status = getAdminSubscriptionStatus(
        { trialStartDate: EXPIRED_TRIAL_START, subscriptionStatus },
        NOW,
      );

      expect(status.kind).toBe("trial_expired");
      expect(status.label).toBe("Trial expired");
      expect(status.paid).toBe(false);
      expect(status.date?.toISOString()).toBe("2026-09-24T00:00:00.000Z");
    }
  });

  it("shows active trials and not-started trials", () => {
    const trial = getAdminSubscriptionStatus(
      { trialStartDate: ACTIVE_TRIAL_START, subscriptionStatus: "trial" },
      NOW,
    );
    expect(trial.kind).toBe("trial");
    expect(trial.label).toBe("Trial · 13 days left");

    const notStarted = getAdminSubscriptionStatus(
      { trialStartDate: null, subscriptionStatus: "trial" },
      NOW,
    );
    expect(notStarted.kind).toBe("not_started");
  });

  it("shows cancelled subscriptions that are still within the paid period", () => {
    const status = getAdminSubscriptionStatus(
      {
        trialStartDate: EXPIRED_TRIAL_START,
        subscriptionStatus: "cancelled",
        subscriptionPlan: "monthly",
        subscriptionId: "2000000123456789",
        currentPeriodEnd: "2026-10-20T00:00:00.000Z",
      },
      NOW,
    );

    expect(status.kind).toBe("cancelled");
    expect(status.label).toBe("Cancelled · ends at period end · Monthly");
    expect(status.dateLabel).toBe("Access ends");
  });

  it("flags a billing issue when an active subscription's period has passed", () => {
    const status = getAdminSubscriptionStatus(
      {
        trialStartDate: EXPIRED_TRIAL_START,
        subscriptionStatus: "active",
        subscriptionPlan: "monthly",
        subscriptionId: "2000000123456789",
        currentPeriodEnd: "2026-10-05T00:00:00.000Z",
      },
      NOW,
    );

    expect(status.kind).toBe("billing_issue");
    expect(status.className).toBe("warning");
    expect(status.dateLabel).toBe("Period ended");
  });

  it("shows expired paid subscriptions as subscription expired, not trial expired", () => {
    const status = getAdminSubscriptionStatus(
      {
        trialStartDate: EXPIRED_TRIAL_START,
        subscriptionStatus: "expired",
        subscriptionPlan: "monthly",
        subscriptionId: "2000000123456789",
        currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      },
      NOW,
    );

    expect(status.kind).toBe("expired");
    expect(status.label).toBe("Subscription expired · Monthly");
    expect(status.dateLabel).toBe("Ended");
  });

  it("counts accounts by their actual subscription state", () => {
    const summary = summariseAdminSubscriptionStatuses(
      [
        // Trial expired, then resubscribed (the demo account scenario).
        {
          trialStartDate: EXPIRED_TRIAL_START,
          subscriptionStatus: "active",
          subscriptionPlan: "monthly",
          subscriptionId: "a",
          currentPeriodEnd: "2026-11-09T03:00:00.000Z",
        },
        { trialStartDate: EXPIRED_TRIAL_START, subscriptionStatus: "trial" },
        { trialStartDate: ACTIVE_TRIAL_START, subscriptionStatus: "trial" },
        { trialStartDate: null, subscriptionStatus: "trial" },
        {
          trialStartDate: EXPIRED_TRIAL_START,
          subscriptionStatus: "cancelled",
          currentPeriodEnd: "2026-10-20T00:00:00.000Z",
        },
        {
          trialStartDate: EXPIRED_TRIAL_START,
          subscriptionStatus: "active",
          currentPeriodEnd: "2026-10-05T00:00:00.000Z",
        },
        {
          trialStartDate: EXPIRED_TRIAL_START,
          subscriptionStatus: "expired",
          subscriptionId: "b",
        },
      ],
      NOW,
    );

    expect(summary).toEqual({
      total: 7,
      activeSubscriptions: 1,
      billingIssues: 1,
      cancelled: 1,
      expiredSubscriptions: 1,
      activeTrials: 1,
      expiredTrials: 1,
      notStarted: 1,
    });
  });
});
