import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIapState = vi.hoisted(() => {
  return {
    purchaseUpdatedHandler: null as
      | ((
          purchase: Record<string, any>,
        ) => Promise<void> | void)
      | null,
    purchaseErrorHandler: null as ((error: any) => void) | null,
    nextPurchase: null as Record<string, any> | null,
    requestSubscriptionImpl: null as (() => Promise<unknown>) | null,
  };
});

vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
}));

vi.mock("react-native-iap", () => {
  return {
    setup: vi.fn(),
    initConnection: vi.fn(async () => true),
    endConnection: vi.fn(async () => true),
    getSubscriptions: vi.fn(async () => []),
    getAvailablePurchases: vi.fn(async () => []),
    finishTransaction: vi.fn(async () => true),
    purchaseUpdatedListener: vi.fn((handler: any) => {
      mockIapState.purchaseUpdatedHandler = handler;
      return { remove: vi.fn() };
    }),
    purchaseErrorListener: vi.fn((handler: any) => {
      mockIapState.purchaseErrorHandler = handler;
      return { remove: vi.fn() };
    }),
    requestSubscription: vi.fn(async () => {
      if (mockIapState.requestSubscriptionImpl) {
        return mockIapState.requestSubscriptionImpl();
      }
      if (mockIapState.nextPurchase && mockIapState.purchaseUpdatedHandler) {
        await mockIapState.purchaseUpdatedHandler(mockIapState.nextPurchase);
      }
      return null;
    }),
  };
});

import * as IAP from "react-native-iap";
import { purchasePlan } from "../lib/iap";

describe("purchasePlan appAccountToken propagation", () => {
  beforeEach(() => {
    mockIapState.purchaseUpdatedHandler = null;
    mockIapState.purchaseErrorHandler = null;
    mockIapState.nextPurchase = null;
    mockIapState.requestSubscriptionImpl = null;
    vi.clearAllMocks();
  });

  it("uses Apple-returned token when it is non-empty", async () => {
    mockIapState.nextPurchase = {
      productId: "com.drivelegal.app.monthly",
      transactionId: "tx-1",
      transactionDate: Date.now(),
      appAccountToken: "apple-token",
    };

    const result = await purchasePlan("monthly", "requested-token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.appAccountToken).toBe("apple-token");
    }
  });

  it("falls back to requested token when Apple token is null", async () => {
    mockIapState.nextPurchase = {
      productId: "com.drivelegal.app.monthly",
      transactionId: "tx-2",
      transactionDate: Date.now(),
      appAccountToken: null,
    };

    const result = await purchasePlan("monthly", "requested-token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.appAccountToken).toBe("requested-token");
    }
  });

  it("falls back to requested token when Apple token is empty", async () => {
    mockIapState.nextPurchase = {
      productId: "com.drivelegal.app.monthly",
      transactionId: "tx-3",
      transactionDate: Date.now(),
      appAccountToken: "",
    };

    const result = await purchasePlan("monthly", "requested-token");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.appAccountToken).toBe("requested-token");
    }
  });

  it("does not invent a token when no requested token is provided", async () => {
    mockIapState.nextPurchase = {
      productId: "com.drivelegal.app.monthly",
      transactionId: "tx-4",
      transactionDate: Date.now(),
      appAccountToken: undefined,
    };

    const result = await purchasePlan("monthly", undefined as any);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.appAccountToken).toBeNull();
    }
    expect(IAP.requestSubscription).toHaveBeenCalledWith({
      sku: "com.drivelegal.app.monthly",
      appAccountToken: undefined,
    });
  });

  it("does not leak one account token into another purchase attempt", async () => {
    let releaseFirstRequest: (() => void) | null = null;

    mockIapState.requestSubscriptionImpl = () =>
      new Promise((resolve) => {
        releaseFirstRequest = () => resolve(null);
      });

    const firstPurchase = purchasePlan("monthly", "account-a-token");
    await Promise.resolve();

    const secondPurchase = await purchasePlan("monthly", "account-b-token");

    expect(secondPurchase).toEqual({
      success: false,
      cancelled: false,
      error: "Another subscription purchase is already in progress.",
    });

    mockIapState.requestSubscriptionImpl = null;
    await mockIapState.purchaseUpdatedHandler?.({
      productId: "com.drivelegal.app.monthly",
      transactionId: "tx-5",
      transactionDate: Date.now(),
      appAccountToken: null,
    });
    releaseFirstRequest?.();

    const firstResult = await firstPurchase;
    expect(firstResult.success).toBe(true);
    if (firstResult.success) {
      expect(firstResult.appAccountToken).toBe("account-a-token");
    }
    expect(IAP.requestSubscription).toHaveBeenCalledTimes(1);
  });
});
