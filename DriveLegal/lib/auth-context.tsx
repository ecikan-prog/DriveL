/**
 * Authentication context for Drive Legal.
 *
 * Cloud authentication is authoritative.
 * Local storage is used for offline logbook data and restoring a verified
 * cloud account on the device.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { Platform } from "react-native";

import * as LocalAuth from "./local-auth";
import type { DriverType } from "./local-auth";

import {
  loginDriverCloud,
  pullLogsFromCloud,
  pushLogsToCloud,
  registerDriverCloud,
  deleteDriverCloud,
} from "./cloud-sync";

import { migrateLogCalculations } from "./logbook-storage";
import { lockPinSession } from "./pin-security";
import { syncSubscriptionFromServer, refreshIAPEntitlement } from "./subscription";

const LIVE_BACKEND =
  "https://drivel-production.up.railway.app";

type LoginResult = {
  success: boolean;
  userId?: string;
  error?: string;
  verificationRequired?: boolean;
  email?: string;
};

type RegisterResult = {
  success: boolean;
  error?: string;
  verificationRequired?: boolean;
  email?: string;
};

type RegisterParams = {
  name: string;
  dateOfBirth: string;
  email: string;
  password: string;
  tslNumber: string;
  operatorName?: string;
  licenceNumber: string;
  licenceClass?: string;
  licenceExpiry?: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType?: DriverType;
};

type AuthContextValue = {
  user: LocalAuth.AuthUser | null;
  loading: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<LoginResult>;
  register: (
    params: RegisterParams
  ) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
};

const AuthContext =
  createContext<AuthContextValue | null>(null);

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getVerificationBaseUrl(): string {
  if (
    Platform.OS === "web" &&
    typeof window !== "undefined" &&
    window.location
  ) {
    return window.location.origin;
  }

  return LIVE_BACKEND;
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<LocalAuth.AuthUser | null>(null);

  const [loading, setLoading] =
    useState(true);

  /**
   * Restore the currently authenticated local session.
   */
  const refreshUser = useCallback(async () => {
    const currentUser =
      await LocalAuth.getCurrentUser();

    setUser(currentUser);
  }, []);

  /**
   * Restore a previously verified session when the app starts.
   */
  useEffect(() => {
    let mounted = true;

    async function initialiseAuth() {
      try {
        const currentUser =
          await LocalAuth.getCurrentUser();

        if (!mounted) return;

        setUser(currentUser);

        if (currentUser) {
          migrateLogCalculations(
            currentUser.id
          ).catch((error) => {
            console.error(
              "[Auth] Log migration failed:",
              error
            );
          });

          pushLogsToCloud(
            currentUser.id
          ).catch((error) => {
            console.error(
              "[Auth] Background log sync failed:",
              error
            );
          });
        }
      } catch (error) {
        console.error(
          "[Auth] Initialisation failed:",
          error
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    initialiseAuth();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Sign in through the Railway backend.
   *
   * Important:
   * We do not fall back to local authentication when cloud login fails.
   * That fallback previously allowed unverified accounts to enter the app.
   */
  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<LoginResult> => {
      const normalisedEmail =
        normaliseEmail(email);
      lockPinSession();

      const passwordHash =
        LocalAuth.hashPassword(password);

      try {
        const cloudResult =
          await loginDriverCloud(
            normalisedEmail,
            passwordHash
          );

        if (
          !cloudResult.success &&
          cloudResult.verificationRequired
        ) {
          return {
            success: false,
            verificationRequired: true,
            email:
              cloudResult.email ??
              normalisedEmail,
            error:
              cloudResult.error ??
              "Please verify your email address before signing in.",
          };
        }

        if (
          !cloudResult.success ||
          !cloudResult.driver
        ) {
          return {
            success: false,
            error:
              cloudResult.error ??
              "Unable to sign in. Please check your email and password.",
          };
        }

        const driver =
          cloudResult.driver;

        const localResult =
          await LocalAuth.createLocalAccountFromCloud(
            {
              id: driver.localUserId,
              email: driver.email,
              name: driver.name,
              dateOfBirth: driver.dateOfBirth ?? "",
              passwordHash,
              tslNumber:
                driver.tslNumber ?? "",
              operatorName:
                driver.operatorName ?? "",
              licenceNumber:
                driver.licenceNumber ?? "",
              licenceClass:
                driver.licenceClass ?? "",
              licenceExpiry:
                driver.licenceExpiry ?? "",
              vehicleRegistration:
                driver.vehicleRegistration ??
                "",
              vehicleType:
                driver.vehicleType ?? "",
              driverType:
                driver.driverType,
              trialStartDate:
                driver.trialStartDate ??
                driver.createdAt ??
                undefined,

                createdAt:
                driver.createdAt ??
                driver.trialStartDate ??
                undefined,
            }
          );

        if (
          !localResult.success ||
          !localResult.user
        ) {
          return {
            success: false,
            error:
              localResult.error ??
              "Your account was verified, but it could not be restored on this device.",
          };
        }
        await syncSubscriptionFromServer({
  userId: driver.localUserId,
  status: driver.subscriptionStatus,
  trialStartDate:
    driver.trialStartDate ??
    driver.createdAt ??
    localResult.user.trialStartDate ??
    localResult.user.createdAt,
  trialEndDate: driver.trialEndDate,
  subscriptionId: driver.subscriptionId,
  currentPeriodEnd: driver.currentPeriodEnd,
  plan: driver.subscriptionPlan,
});

 // Refresh from StoreKit immediately so the AsyncStorage cache reflects the
 // real Apple entitlement before the UI renders.  This prevents the
 // server's stale status (e.g. "expired") from flashing on Profile/Paywall
 // after cold start + PIN login.
 await refreshIAPEntitlement(driver.localUserId).catch(() => {
   // Offline or StoreKit unavailable — the server-synced state is fine as
   // a fallback; the UI will show a loading spinner until StoreKit responds.
 });

 await pullLogsFromCloud(driver.localUserId);

 await migrateLogCalculations(driver.localUserId);

 setUser(localResult.user);

 return {
  success: true,
  userId: localResult.user.id,
};

          } catch (error) {
        console.error(
          "[Auth] Login failed:",
          error
        );

        return {
          success: false,
          error:
            "Unable to connect to the Drive Legal server. Please try again.",
        };
      }
    },
    []
  );

  /**
   * Create the local account record, register it with Railway,
   * and require email verification before allowing access.
   */
  const register = useCallback(
    async (
      params: RegisterParams
    ): Promise<RegisterResult> => {
      const email =
        normaliseEmail(params.email);

      const cleanedParams: RegisterParams = {
        ...params,
        email,
        name: params.name.trim(),
        tslNumber:
          params.tslNumber.trim(),
        operatorName:
          params.operatorName?.trim(),
        licenceNumber:
          params.licenceNumber.trim(),
        licenceClass:
          params.licenceClass?.trim(),
        licenceExpiry:
          params.licenceExpiry?.trim(),
        vehicleRegistration:
          params.vehicleRegistration
            .trim()
            .toUpperCase(),
        vehicleType:
          params.vehicleType.trim(),
        driverType:
          params.driverType ??
          "small_passenger",
      };
      const localUserId =
  Date.now().toString(36) +
  Math.random().toString(36).slice(2);

 const trialStartDate =
  new Date().toISOString();

      const passwordHash =
        LocalAuth.hashPassword(
          params.password
        );

      try {
        const cloudResult =
          await registerDriverCloud({
            localUserId,
            email,
            passwordHash,
            name:
             cleanedParams.name,
            dateOfBirth:
             cleanedParams.dateOfBirth,
            tslNumber:
             cleanedParams.tslNumber,
            operatorName:
              cleanedParams.operatorName,
            licenceNumber:
              cleanedParams.licenceNumber,
            licenceClass:
              cleanedParams.licenceClass,
            licenceExpiry:
              cleanedParams.licenceExpiry,
            vehicleRegistration:
              cleanedParams.vehicleRegistration,
            vehicleType:
              cleanedParams.vehicleType,
            driverType:
              cleanedParams.driverType ??
              "small_passenger",
            trialStartDate,
            baseUrl:
              getVerificationBaseUrl(),
          });

        if (!cloudResult.success) {
          await LocalAuth.logoutUser();

          return {
            success: false,
            error:
              cloudResult.error ??
              "Unable to register your account with the Drive Legal server.",
          };
        }
        const localResult =
  await LocalAuth.registerUser({
    ...cleanedParams,
    localUserId,
    trialStartDate,
  });

 if (
  !localResult.success ||
  !localResult.user
) {
  return {
    success: false,
    error:
      localResult.error ??
      "Your account was registered, but it could not be saved on this device.",
  };
}

         /*
         * Registration succeeded, but the user must verify their email
         * before a session is allowed.
         */
        await LocalAuth.logoutUser();
        setUser(null);

        return {
          success: true,
          verificationRequired: true,
          email,
        };
      } catch (error) {
        console.error(
          "[Auth] Cloud registration failed:",
          error
        );

        await LocalAuth.logoutUser();

        return {
          success: false,
          error:
            "Unable to connect to the Drive Legal server. Please try again.",
        };
      }
    },
    []
  );

  /**
   * End the current authenticated session.
   */
  const logout = useCallback(
    async () => {
      if (user) {
        await pushLogsToCloud(
          user.id
        ).catch((error) => {
          console.error(
            "[Auth] Final log sync failed:",
            error
          );
        });
      }

      await LocalAuth.logoutUser();
      setUser(null);
    },
    [user]
  );

  /**
   * Manually push completed logs to Railway.
   */
  const syncToCloud =
    useCallback(async () => {
      if (!user) return;

      await pushLogsToCloud(user.id);
    }, [user]);

  /**
   * Delete the user's account from the cloud and clear local session.
   * Reuses existing deleteDriverCloud mutation.
   */
  const deleteAccount = useCallback(
    async (): Promise<{ success: boolean; error?: string }> => {
      if (!user) {
        return { success: false, error: "No user logged in." };
      }

      try {
        const currentUser = await LocalAuth.getCurrentUser();
        const rawAuthenticatedEmail =
          currentUser?.email ?? user.email;

        if (
          typeof rawAuthenticatedEmail !== "string" ||
          rawAuthenticatedEmail.trim().length === 0
        ) {
          return {
            success: false,
            error:
              "Unable to determine your authenticated email. Please sign out and sign in again, then retry account deletion.",
          };
        }

        const authenticatedEmail =
          normaliseEmail(rawAuthenticatedEmail);

        // Call the existing backend mutation to delete the account
        const result = await deleteDriverCloud(
          authenticatedEmail
        );

        if (!result.success) {
          return {
            success: false,
            error: result.error || "Failed to delete account on the server.",
          };
        }

        // If server deletion succeeds, clear local session
        await LocalAuth.logoutUser();
        setUser(null);

        return { success: true };
      } catch (error) {
        console.error("[Auth] Delete account failed:", error);
        return {
          success: false,
          error: "Unable to delete account. Please try again.",
        };
      }
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        syncToCloud,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuthContext must be used within AuthProvider"
    );
  }

  return context;
}
