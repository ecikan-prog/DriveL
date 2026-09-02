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
  useRef,
  useState,
} from "react";
import * as Crypto from "expo-crypto";
import { AppState, Platform } from "react-native";

import * as LocalAuth from "./local-auth";
import type { DriverType } from "./local-auth";

import {
  loginDriverCloud,
  logoutDriverCloud,
  pullLogsFromCloud,
  pushLogsToCloud,
  registerDriverCloud,
  deleteDriverCloud,
  restoreDriverSessionCloud,
} from "./cloud-sync";
import {
  clearAuthSession,
  getAuthSession,
  getDeviceLabel,
  getOrCreateDeviceId,
  patchAuthSession,
  saveAuthSession,
  setPendingLogoutNotice,
  subscribeToSessionInvalidation,
} from "./app-session";

import { migrateLogCalculations } from "./logbook-storage";
import { lockPinSession } from "./pin-security";
import { syncSubscriptionFromServer } from "./subscription";

const LIVE_BACKEND = "https://drivel-production.up.railway.app";

type LoginResult = {
  success: boolean;
  userId?: string;
  error?: string;
  verificationRequired?: boolean;
  sessionConflict?: boolean;
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
  appAccountToken: string | null;
  loading: boolean;
  login: (
    email: string,
    password: string,
    options?: { forceContinue?: boolean },
  ) => Promise<LoginResult>;
  register: (params: RegisterParams) => Promise<RegisterResult>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncToCloud: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function createSecureLocalUserId(): Promise<string> {
  if (typeof Crypto.randomUUID === "function") {
    return Crypto.randomUUID().replace(/-/g, "");
  }

  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
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

export function AuthProvider({ children }: { children?: React.ReactNode }) {
  const [user, setUser] = useState<LocalAuth.AuthUser | null>(null);
  const [appAccountToken, setAppAccountToken] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);

  const sessionCheckInFlightRef = useRef(false);

  const applyAuthenticatedDriver = useCallback(
    async (
      driver: Awaited<ReturnType<typeof restoreDriverSessionCloud>>["driver"],
      passwordHash?: string,
      options?: { pullLogs?: boolean },
    ): Promise<
      | {
          success: true;
          user: LocalAuth.AuthUser;
        }
      | {
          success: false;
          error: string;
        }
    > => {
      if (!driver) {
        return {
          success: false,
          error: "Your account could not be loaded. Please sign in again.",
        };
      }

      const localResult = await LocalAuth.createLocalAccountFromCloud({
        id: driver.localUserId,
        email: driver.email,
        name: driver.name,
        dateOfBirth: driver.dateOfBirth ?? "",
        passwordHash,
        tslNumber: driver.tslNumber ?? "",
        operatorName: driver.operatorName ?? "",
        licenceNumber: driver.licenceNumber ?? "",
        licenceClass: driver.licenceClass ?? "",
        licenceExpiry: driver.licenceExpiry ?? "",
        vehicleRegistration: driver.vehicleRegistration ?? "",
        vehicleType: driver.vehicleType ?? "",
        driverType: driver.driverType,
        trialStartDate: driver.trialStartDate ?? driver.createdAt ?? undefined,
        createdAt: driver.createdAt ?? driver.trialStartDate ?? undefined,
      });

      if (localResult.success === false) {
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

      if (driver.appAccountToken) {
        await patchAuthSession({
          appAccountToken: driver.appAccountToken,
        });
      }

      setAppAccountToken(driver.appAccountToken ?? null);

      if (options?.pullLogs !== false) {
        await pullLogsFromCloud(driver.localUserId);
        await migrateLogCalculations(driver.localUserId);
      }

      setUser(localResult.user);

      return {
        success: true,
        user: localResult.user,
      };
    },
    [],
  );

  const clearAuthenticatedState = useCallback(async () => {
    lockPinSession();
    await LocalAuth.logoutUser();
    await clearAuthSession();
    setAppAccountToken(null);
    setUser(null);
  }, []);

  const forceLogout = useCallback(
    async (message?: string) => {
      if (message) {
        await setPendingLogoutNotice(message);
      }

      await clearAuthenticatedState();
    },
    [clearAuthenticatedState],
  );

  useEffect(() => {
    return subscribeToSessionInvalidation(() => {
      void clearAuthenticatedState();
    });
  }, [clearAuthenticatedState]);

  /**
   * Restore the currently authenticated local session.
   */
  const refreshUser = useCallback(async () => {
    const currentUser = await LocalAuth.getCurrentUser();

    setUser(currentUser);
  }, []);

  const validateAuthenticatedSession =
    useCallback(async (): Promise<boolean> => {
      if (sessionCheckInFlightRef.current) {
        return true;
      }

      const currentUser = await LocalAuth.getCurrentUser();
      const authSession = await getAuthSession();

      if (
        !currentUser ||
        !authSession ||
        authSession.userId !== currentUser.id
      ) {
        if (currentUser) {
          await forceLogout("Please sign in again.");
        }

        return false;
      }

      sessionCheckInFlightRef.current = true;

      try {
        const result = await restoreDriverSessionCloud();

        if (result.success && result.driver) {
          const applied = await applyAuthenticatedDriver(
            result.driver,
            undefined,
            { pullLogs: false },
          );

          return applied.success;
        }

        if (result.revoked || result.sessionInvalid) {
          await forceLogout(
            "You’ve been signed out because this account was signed in on another device.",
          );
          return false;
        }

        return true;
      } catch (error) {
        console.error("[Auth] Session validation failed:", error);
        return true;
      } finally {
        sessionCheckInFlightRef.current = false;
      }
    }, [applyAuthenticatedDriver, forceLogout]);

  /**
   * Restore a previously verified session when the app starts.
   */
  useEffect(() => {
    let mounted = true;

    async function initialiseAuth() {
      try {
        const currentUser = await LocalAuth.getCurrentUser();
        const authSession = await getAuthSession();

        if (!mounted) return;

        if (currentUser) {
          setUser(currentUser);

          if (!authSession || authSession.userId !== currentUser.id) {
            await forceLogout("Please sign in again.");
            return;
          }

          setAppAccountToken(authSession.appAccountToken ?? null);

          const restored = await restoreDriverSessionCloud();

          if (restored.success && restored.driver) {
            const applied = await applyAuthenticatedDriver(
              restored.driver,
              undefined,
              { pullLogs: true },
            );

            if (applied.success) {
              pushLogsToCloud(currentUser.id).catch((error) => {
                console.error("[Auth] Background log sync failed:", error);
              });
            }
          } else if (restored.revoked || restored.sessionInvalid) {
            await forceLogout(
              "You’ve been signed out because this account was signed in on another device.",
            );
          } else {
            const valid = await validateAuthenticatedSession();

            if (valid) {
              pushLogsToCloud(currentUser.id).catch((error) => {
                console.error("[Auth] Background log sync failed:", error);
              });
            }
          }
        } else {
          setAppAccountToken(null);
        }
      } catch (error) {
        console.error("[Auth] Initialisation failed:", error);
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
  }, [applyAuthenticatedDriver, forceLogout, validateAuthenticatedSession]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void validateAuthenticatedSession();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user?.id, validateAuthenticatedSession]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    const interval = setInterval(() => {
      void validateAuthenticatedSession();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id, validateAuthenticatedSession]);

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
      password: string,
      options?: { forceContinue?: boolean },
    ): Promise<LoginResult> => {
      const normalisedEmail = normaliseEmail(email);
      lockPinSession();

      const localPasswordHash = LocalAuth.hashPassword(password);

      try {
        const legacyPasswordSha256 = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          password,
        );
        const deviceId = await getOrCreateDeviceId();
        const deviceLabel = getDeviceLabel();
        const cloudResult = await loginDriverCloud(
          normalisedEmail,
          password,
          {
            legacyPasswordHash: localPasswordHash,
            legacyPasswordSha256,
            deviceId,
            deviceLabel,
            forceContinue: options?.forceContinue,
          },
        );

        if (!cloudResult.success && cloudResult.verificationRequired) {
          return {
            success: false,
            verificationRequired: true,
            email: cloudResult.email ?? normalisedEmail,
            error:
              cloudResult.error ??
              "Please verify your email address before signing in.",
          };
        }

        if (!cloudResult.success && cloudResult.sessionConflict) {
          return {
            success: false,
            sessionConflict: true,
            error:
              cloudResult.error ??
              "This account is currently active on another device.",
          };
        }

        if (
          !cloudResult.success ||
          !cloudResult.driver ||
          !cloudResult.sessionToken
        ) {
          return {
            success: false,
            error:
              cloudResult.error ??
              "Unable to sign in. Please check your email and password.",
          };
        }

        const driver = cloudResult.driver;
        await saveAuthSession({
          userId: driver.localUserId,
          sessionToken: cloudResult.sessionToken,
          deviceId,
          deviceLabel,
          appAccountToken: driver.appAccountToken ?? undefined,
        });
        const applied = await applyAuthenticatedDriver(
          driver,
          localPasswordHash,
          {
            pullLogs: true,
          },
        );

        if (!applied.success) {
          await clearAuthSession();
          setAppAccountToken(null);
          return {
            success: false,
            error: applied.error,
          };
        }

        return {
          success: true,
          userId: applied.user.id,
        };
      } catch (error) {
        console.error("[Auth] Login failed:", error);

        return {
          success: false,
          error:
            "Unable to connect to the Drive Legal server. Please try again.",
        };
      }
    },
    [applyAuthenticatedDriver],
  );

  /**
   * Create the local account record, register it with Railway,
   * and require email verification before allowing access.
   */
  const register = useCallback(
    async (params: RegisterParams): Promise<RegisterResult> => {
      const email = normaliseEmail(params.email);
      const password = params.password;

      const cleanedParams: RegisterParams = {
        ...params,
        email,
        password,
        name: params.name.trim(),
        tslNumber: params.tslNumber.trim(),
        operatorName: params.operatorName?.trim(),
        licenceNumber: params.licenceNumber.trim(),
        licenceClass: params.licenceClass?.trim(),
        licenceExpiry: params.licenceExpiry?.trim(),
        vehicleRegistration: params.vehicleRegistration.trim().toUpperCase(),
        vehicleType: params.vehicleType.trim(),
        driverType: params.driverType ?? "small_passenger",
      };
      const localUserId = await createSecureLocalUserId();

      const trialStartDate = new Date().toISOString();

      try {
        const cloudResult = await registerDriverCloud({
          localUserId,
          email,
          password: cleanedParams.password,
          name: cleanedParams.name,
          dateOfBirth: cleanedParams.dateOfBirth,
          tslNumber: cleanedParams.tslNumber,
          operatorName: cleanedParams.operatorName,
          licenceNumber: cleanedParams.licenceNumber,
          licenceClass: cleanedParams.licenceClass,
          licenceExpiry: cleanedParams.licenceExpiry,
          vehicleRegistration: cleanedParams.vehicleRegistration,
          vehicleType: cleanedParams.vehicleType,
          driverType: cleanedParams.driverType ?? "small_passenger",
          trialStartDate,
          baseUrl: getVerificationBaseUrl(),
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
        const localResult = await LocalAuth.registerUser({
          ...cleanedParams,
          localUserId,
          trialStartDate,
        });

        if (localResult.success === false) {
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
        console.error("[Auth] Cloud registration failed:", error);

        await LocalAuth.logoutUser();

        return {
          success: false,
          error:
            "Unable to connect to the Drive Legal server. Please try again.",
        };
      }
    },
    [],
  );

  /**
   * End the current authenticated session.
   */
  const logout = useCallback(async () => {
    if (user) {
      await pushLogsToCloud(user.id).catch((error) => {
        console.error("[Auth] Final log sync failed:", error);
      });
    }

    await logoutDriverCloud().catch(() => {});
    await clearAuthenticatedState();
  }, [clearAuthenticatedState, user]);

  /**
   * Manually push completed logs to Railway.
   */
  const syncToCloud = useCallback(async () => {
    if (!user) return;

    await pushLogsToCloud(user.id);
  }, [clearAuthenticatedState, user]);

  /**
   * Delete the user's account from the cloud and clear local session.
   * Reuses existing deleteDriverCloud mutation.
   */
  const deleteAccount = useCallback(async (): Promise<{
    success: boolean;
    error?: string;
  }> => {
    if (!user) {
      return { success: false, error: "No user logged in." };
    }

    try {
      const currentUser = await LocalAuth.getCurrentUser();
      const rawAuthenticatedEmail = currentUser?.email ?? user.email;

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

      const authenticatedEmail = normaliseEmail(rawAuthenticatedEmail);

      // Call the existing backend mutation to delete the account
      const result = await deleteDriverCloud(authenticatedEmail);

      if (!result.success) {
        return {
          success: false,
          error: result.error || "Failed to delete account on the server.",
        };
      }

      // If server deletion succeeds, clear local session
      await clearAuthenticatedState();

      return { success: true };
    } catch (error) {
      console.error("[Auth] Delete account failed:", error);
      return {
        success: false,
        error: "Unable to delete account. Please try again.",
      };
    }
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        appAccountToken,
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
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }

  return context;
}
