/**
 * Authentication context for Drive Legal.
 * Provides current user state and auth actions throughout the app.
 * Integrates cloud sync: registers/logins against cloud DB, pulls logs on login.
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as LocalAuth from "./local-auth";
import type { DriverType } from "./local-auth";
import { registerDriverCloud, loginDriverCloud, pullLogsFromCloud, pushLogsToCloud } from "./cloud-sync";
import { migrateLogCalculations } from "./logbook-storage";

type AuthContextValue = {
  user: LocalAuth.AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string; verificationRequired?: boolean; email?: string }>;
  register: (params: {
    name: string;
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
  }) => Promise<{ success: boolean; error?: string; verificationRequired?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  syncToCloud: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<LocalAuth.AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const currentUser = await LocalAuth.getCurrentUser();
    setUser(currentUser);
  }, []);

  useEffect(() => {
    LocalAuth.getCurrentUser()
      .then((u) => {
        setUser(u);
        // Background push sync if user is logged in
        if (u) {
          migrateLogCalculations(u.id).catch(() => {});
          pushLogsToCloud(u.id).catch(() => {});
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const passwordHash = LocalAuth.hashPassword(password);

    // Step 1: Try cloud auth first — this works even after clearing local storage
    const cloudResult = await loginDriverCloud(email, passwordHash);

    // Handle email verification required
    if (!cloudResult.success && cloudResult.verificationRequired) {
      return {
        success: false,
        error: "Please verify your email address before signing in.",
        verificationRequired: true,
        email: cloudResult.email || email,
      };
    }

    if (cloudResult.success && cloudResult.driver) {
      const driver = cloudResult.driver;
      // Restore/update local account from cloud data
      const createResult = await LocalAuth.createLocalAccountFromCloud({
        id: driver.localUserId,
        email: driver.email,
        name: driver.name,
        passwordHash: passwordHash,
        tslNumber: driver.tslNumber ?? "",
        operatorName: driver.operatorName ?? "",
        licenceNumber: driver.licenceNumber ?? "",
        licenceClass: driver.licenceClass ?? "",
        licenceExpiry: driver.licenceExpiry ?? "",
        vehicleRegistration: driver.vehicleRegistration ?? "",
        vehicleType: driver.vehicleType ?? "",
        driverType: driver.driverType,
        trialStartDate: driver.trialStartDate ?? new Date().toISOString(),
      });
      if (createResult.success) {
        setUser(createResult.user);
        // Pull logs from cloud to restore history on this device
        pullLogsFromCloud(driver.localUserId).catch(() => {});
        return { success: true };
      }
    }

    // Step 2: Cloud unavailable or not found — fall back to local auth
    // (handles offline use or accounts not yet synced to cloud)
    const localResult = await LocalAuth.loginUser(email, password);
    if (localResult.success && localResult.user) {
      const localUser = localResult.user;
      setUser(localUser);
      // Opportunistically push this account to cloud so future logins from
      // any device/browser work (handles accounts that registered offline)
      registerDriverCloud({
        localUserId: localUser.id,
        email: localUser.email,
        passwordHash,
        name: localUser.name,
        licenceNumber: localUser.licenceNumber,
        vehicleRegistration: localUser.vehicleRegistration,
        vehicleType: localUser.vehicleType,
        driverType: localUser.driverType,
        trialStartDate: localUser.trialStartDate ?? new Date().toISOString(),
      }).catch(() => {});
      pullLogsFromCloud(localUser.id).catch(() => {});
      pushLogsToCloud(localUser.id).catch(() => {});
      return { success: true };
    }

    // Both failed — return the most useful error message
    const localError = !localResult.success ? localResult.error : undefined;
    const errorMsg = cloudResult.error && !cloudResult.error.includes("Network error") && cloudResult.error !== "__VERIFICATION_REQUIRED__"
      ? cloudResult.error
      : localError || "Login failed. Please check your credentials.";
    return { success: false, error: errorMsg };
  }, []);

  const register = useCallback(
    async (params: {
      name: string;
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
    }) => {
      const result = await LocalAuth.registerUser(params);
      if (result.success) {
        // Do NOT setUser here — user must verify email first
        // CRITICAL: Await cloud registration so the account exists in the DB
        const passwordHash = LocalAuth.hashPassword(params.password);
        try {
          // baseUrl is used by the server to build email verification links.
          // On web, use the current origin; on native, always use the live backend.
          const baseUrl = typeof window !== "undefined" && window.location
            ? window.location.origin
            : "https://guidedlogbook-6i7vyx5h.manus.space";
          await registerDriverCloud({
            localUserId: result.user.id,
            email: params.email,
            passwordHash,
            name: params.name,
            tslNumber: params.tslNumber,
            operatorName: params.operatorName,
            licenceNumber: params.licenceNumber,
            licenceClass: params.licenceClass,
            licenceExpiry: params.licenceExpiry,
            vehicleRegistration: params.vehicleRegistration,
            vehicleType: params.vehicleType,
            driverType: params.driverType ?? "small_passenger",
            trialStartDate: result.user.trialStartDate ?? new Date().toISOString(),
            baseUrl,
          });
        } catch {
          // Cloud registration failed (offline) — account is saved locally,
          // will be synced next time the user is online
        }
        // Clear local user — they need to verify email before accessing the app
        await LocalAuth.logoutUser();
        return { success: true, verificationRequired: true };
      }
      return { success: false, error: result.error };
    },
    []
  );

  const logout = useCallback(async () => {
    // Push any remaining logs before logout
    if (user) {
      await pushLogsToCloud(user.id).catch(() => {});
    }
    await LocalAuth.logoutUser();
    setUser(null);
  }, [user]);

  const syncToCloud = useCallback(async () => {
    if (user) {
      await pushLogsToCloud(user.id);
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser, syncToCloud }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuthContext must be used within AuthProvider");
  }
  return ctx;
}
