import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      storage.delete(key);
    }),
  },
}));

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("../lib/iap", () => ({
  checkCurrentEntitlement: vi.fn(async () => ({
    isActive: false,
    plan: null,
    expiryDate: null,
    transactionId: null,
    originalTransactionId: null,
    appAccountToken: null,
  })),
  estimatePeriodEnd: vi.fn((plan: "monthly" | "annual", purchaseTime: number) => {
    const date = new Date(purchaseTime);
    if (plan === "annual") {
      date.setFullYear(date.getFullYear() + 1);
    } else {
      date.setMonth(date.getMonth() + 1);
    }
    return date;
  }),
}));

import {
  getSubscriptionState,
  subscribeToSubscriptionState,
  syncSubscriptionFromServer,
} from "../lib/subscription";
import { checkCurrentEntitlement } from "../lib/iap";

describe("subscription sync freshness guard", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
    vi.mocked(checkCurrentEntitlement).mockReset();
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: false,
      plan: null,
      expiryDate: null,
      transactionId: null,
      originalTransactionId: null,
      appAccountToken: null,
    });
  });

  it("keeps a monthly purchase active when a stale annual session response arrives", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "monthly",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      transactionId: "sub-monthly",
      originalTransactionId: "sub-monthly",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "sub-monthly",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      iapVerified: true,
      source: "purchase",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "annual",
      subscriptionId: "sub-annual-old",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.plan).toBe("monthly");
    expect(state.subscriptionId).toBe("sub-monthly");
    expect(state.pendingServerConfirmation).toBe(true);
  });

  it("keeps a new purchase active when a stale expired session response arrives", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "monthly",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      transactionId: "sub-monthly",
      originalTransactionId: "sub-monthly",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "sub-monthly",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      iapVerified: true,
      source: "purchase",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "expired",
      plan: "annual",
      subscriptionId: "sub-annual-old",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.plan).toBe("monthly");
    expect(state.subscriptionId).toBe("sub-monthly");
  });

  it("keeps a restored entitlement active when a stale session response arrives", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "annual",
      expiryDate: new Date("2027-09-01T00:00:00.000Z"),
      transactionId: "restored-subscription",
      originalTransactionId: "restored-subscription",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "annual",
      subscriptionId: "restored-subscription",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
      iapVerified: true,
      source: "restore",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "expired",
      plan: "monthly",
      subscriptionId: "older-expired-subscription",
      currentPeriodEnd: "2026-08-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.plan).toBe("annual");
    expect(state.subscriptionId).toBe("restored-subscription");
  });

  it("keeps a verified active subscription when a stale expired session response arrives for the same subscription", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "monthly",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      transactionId: "subscription-chain-1",
      originalTransactionId: "subscription-chain-1",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "subscription-chain-1",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      iapVerified: true,
      source: "purchase",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "expired",
      plan: "monthly",
      subscriptionId: "subscription-chain-1",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.plan).toBe("monthly");
    expect(state.subscriptionId).toBe("subscription-chain-1");
    expect(state.pendingServerConfirmation).toBe(true);
    expect(state.entitlementAuthority).toBe("purchase");
  });

  it("continues to apply normal session refreshes and clears protection after server confirmation", async () => {
    vi.mocked(checkCurrentEntitlement)
      .mockResolvedValueOnce({
        isActive: true,
        plan: "monthly",
        expiryDate: new Date("2026-10-01T00:00:00.000Z"),
        transactionId: "subscription-chain-1",
        originalTransactionId: "subscription-chain-1",
        appAccountToken: null,
      })
      .mockResolvedValueOnce({
        isActive: true,
        plan: "annual",
        expiryDate: new Date("2027-09-01T00:00:00.000Z"),
        transactionId: "server-updated-subscription",
        originalTransactionId: "server-updated-subscription",
        appAccountToken: null,
      });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "subscription-chain-1",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      iapVerified: true,
      source: "purchase",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "subscription-chain-1",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      source: "session",
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "annual",
      subscriptionId: "server-updated-subscription",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.plan).toBe("annual");
    expect(state.subscriptionId).toBe("server-updated-subscription");
    expect(state.pendingServerConfirmation).toBe(false);
    expect(state.entitlementAuthority).toBe("server");
  });

  it("keeps subscription state isolated per account", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValueOnce({
      isActive: true,
      plan: "annual",
      expiryDate: new Date("2027-09-01T00:00:00.000Z"),
      transactionId: "user-2-sub",
      originalTransactionId: "user-2-sub",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "user-1-sub",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      iapVerified: true,
      source: "purchase",
    });

    await syncSubscriptionFromServer({
      userId: "user-2",
      status: "active",
      plan: "annual",
      subscriptionId: "user-2-sub",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
      source: "session",
    });

    const userOneState = await getSubscriptionState("user-1");
    const userTwoState = await getSubscriptionState("user-2");

    expect(userOneState.plan).toBe("monthly");
    expect(userOneState.subscriptionId).toBe("user-1-sub");
    expect(userTwoState.plan).toBe("annual");
    expect(userTwoState.subscriptionId).toBe("user-2-sub");
  });

  it("downgrades a server-reported active subscription when StoreKit reports no active entitlement", async () => {
    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "phantom-subscription",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("expired");
    expect(state.plan).toBe("monthly");
    expect(state.subscriptionId).toBe("phantom-subscription");
    expect(state.iapVerified).toBe(false);
  });

  it("downgrades a server-reported active subscription when StoreKit returns a different transaction", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "monthly",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      transactionId: "different-subscription",
      originalTransactionId: "different-subscription",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "server-subscription",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("expired");
    expect(state.subscriptionId).toBe("server-subscription");
    expect(state.iapVerified).toBe(false);
  });

  it("keeps a server-reported active subscription when StoreKit originalTransactionId matches", async () => {
    vi.mocked(checkCurrentEntitlement).mockResolvedValue({
      isActive: true,
      plan: "monthly",
      expiryDate: new Date("2026-10-01T00:00:00.000Z"),
      transactionId: "renewal-transaction-2",
      originalTransactionId: "server-subscription",
      appAccountToken: null,
    });

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "server-subscription",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.subscriptionId).toBe("server-subscription");
    expect(state.iapVerified).toBe(true);
  });

  it("notifies subscription listeners immediately after a restore updates the cache", async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToSubscriptionState("user-1", listener);

    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "annual",
      subscriptionId: "restored-subscription",
      currentPeriodEnd: "2027-09-01T00:00:00.000Z",
      iapVerified: true,
      source: "restore",
    });

    unsubscribe();

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        status: "active",
        plan: "annual",
        subscriptionId: "restored-subscription",
      }),
    );
  });
});
