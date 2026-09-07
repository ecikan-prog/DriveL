import { describe, expect, it, vi } from "vitest";

import {
  processAppStoreServerNotification,
  syncDriverSubscriptionRecord,
} from "../server/apple-subscriptions";

function makeSignedPayload(payload: unknown): string {
  return [
    Buffer.from(JSON.stringify({ alg: "ES256", typ: "JWT" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify(payload)).toString("base64url"),
    "signature",
  ].join(".");
}

describe("apple subscription server validation", () => {
  it("downgrades a client-reported active subscription when Apple says expired", async () => {
    const queryFn = vi.fn(async () => []);
    const result = await syncDriverSubscriptionRecord(
      {
        localUserId: "driver-1",
        requestedStatus: "active",
        requestedPlan: "monthly",
        requestedSubscriptionId: "orig-1",
        requestedCurrentPeriodEnd: "2026-10-01T00:00:00.000Z",
      },
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "expired",
          subscriptionPlan: "monthly",
          subscriptionId: "orig-1",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.monthly",
          environment: "Production",
          rawStatus: 2,
        }),
      },
    );

    expect(result).toEqual({
      success: true,
      subscriptionStatus: "expired",
      subscriptionPlan: "monthly",
      subscriptionId: "orig-1",
      currentPeriodEnd: "2026-09-01T00:00:00.000Z",
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect((queryFn.mock.calls[0] as any[] | undefined)?.[1]).toEqual([
      "expired",
      "monthly",
      "orig-1",
      "2026-09-01T00:00:00.000Z",
      "driver-1",
    ]);
  });

  it("keeps legitimate active purchase syncs active after Apple validation", async () => {
    const queryFn = vi.fn(async () => []);
    const result = await syncDriverSubscriptionRecord(
      {
        localUserId: "driver-1",
        requestedStatus: "active",
        requestedPlan: "annual",
        requestedSubscriptionId: "orig-annual",
        requestedCurrentPeriodEnd: "2027-09-01T00:00:00.000Z",
      },
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "active",
          subscriptionPlan: "annual",
          subscriptionId: "orig-annual",
          currentPeriodEnd: "2027-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.annual",
          environment: "Production",
          rawStatus: 1,
        }),
      },
    );

    expect(result).toEqual({
      success: true,
      subscriptionStatus: "active",
      subscriptionPlan: "annual",
      subscriptionId: "orig-annual",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("updates stored status from an App Store notification without client involvement", async () => {
    const queryFn = vi.fn(async (sql: string) => {
      if (sql.includes("SELECT localUserId")) {
        return [{ localUserId: "driver-1" }];
      }

      return [];
    });

    const result = await processAppStoreServerNotification(
      makeSignedPayload({
        notificationType: "EXPIRED",
        subtype: null,
        data: {
          signedTransactionInfo: makeSignedPayload({
            originalTransactionId: "orig-1",
          }),
        },
      }),
      {
        queryFn: queryFn as any,
        validateSubscription: async () => ({
          subscriptionStatus: "expired",
          subscriptionPlan: "monthly",
          subscriptionId: "orig-1",
          currentPeriodEnd: "2026-09-01T00:00:00.000Z",
          productId: "com.drivelegal.app.monthly",
          environment: "Production",
          rawStatus: 2,
        }),
      },
    );

    expect(result).toEqual({
      ok: true,
      processed: true,
      notificationType: "EXPIRED",
      subtype: null,
      originalTransactionId: "orig-1",
      subscriptionStatus: "expired",
    });
    expect(queryFn).toHaveBeenCalledTimes(2);
    expect((queryFn.mock.calls[1] as any[] | undefined)?.[1]).toEqual([
      "expired",
      "monthly",
      "orig-1",
      "2026-09-01T00:00:00.000Z",
      "driver-1",
    ]);
  });
});
