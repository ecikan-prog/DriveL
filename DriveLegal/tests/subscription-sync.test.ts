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

vi.mock("../lib/iap", () => ({
  checkCurrentEntitlement: vi.fn(async () => ({
    isActive: false,
    plan: null,
    expiryDate: null,
    willAutoRenew: null,
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
  syncSubscriptionFromServer,
} from "../lib/subscription";

describe("subscription sync freshness guard", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("keeps a monthly purchase active when a stale annual session response arrives", async () => {
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

  it("allows a genuinely newer server state to replace the protected local state", async () => {
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
    expect(state.status).toBe("expired");
    expect(state.plan).toBe("monthly");
    expect(state.subscriptionId).toBe("subscription-chain-1");
    expect(state.pendingServerConfirmation).toBe(false);
    expect(state.entitlementAuthority).toBe("server");
  });

  it("continues to apply normal session refreshes and clears protection after server confirmation", async () => {
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

  it("stores a cancelled-but-still-active subscription as active without auto-renew", async () => {
    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "active",
      plan: "monthly",
      subscriptionId: "user-1-sub",
      currentPeriodEnd: "2026-10-01T00:00:00.000Z",
      willAutoRenew: false,
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.willAutoRenew).toBe(false);
    expect(state.currentPeriodEnd).toBe("2026-10-01T00:00:00.000Z");
  });

  it("normalises legacy cancelled records with future expiry into active non-renewing access", async () => {
    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "cancelled",
      plan: "monthly",
      subscriptionId: "user-1-sub",
      currentPeriodEnd: "2099-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("active");
    expect(state.willAutoRenew).toBe(false);
  });

  it("normalises legacy cancelled records with elapsed expiry into expired access", async () => {
    await syncSubscriptionFromServer({
      userId: "user-1",
      status: "cancelled",
      plan: "monthly",
      subscriptionId: "user-1-sub",
      currentPeriodEnd: "2020-10-01T00:00:00.000Z",
      source: "session",
    });

    const state = await getSubscriptionState("user-1");
    expect(state.status).toBe("expired");
    expect(state.willAutoRenew).toBeUndefined();
  });
});
