/**
 * Cloud Sync Service for Drive Legal.
 *
 * Push-only sync by default: completed shifts are pushed to the cloud DB
 * when internet is available. Pull is used on login to restore history
 * from another device.
 *
 * Local AsyncStorage remains the primary data store (offline-first).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { DailyLog } from "./logbook-storage";
import type { DriverType } from "@/lib/local-auth";

const SYNC_STATUS_KEY = "dl_sync_status";

// API base URL — always points to the live production server.
// On web, derive from the current window origin so the web preview
// also works correctly. On native iOS/Android, always use the
// hardcoded production URL (env vars are NOT available at EAS build
// time via Manus Publish, so we must not rely on them).
const LIVE_BACKEND = "https://drivel-production.up.railway.app";
const API_BASE =
  Platform.OS === "web" && typeof window !== "undefined" && window.location
    ? `${window.location.origin}/api/trpc`
    : `${LIVE_BACKEND}/api/trpc`;

type SyncStatus = {
  lastPushTime?: string;
  pushedLogIds: string[];
};

async function getSyncStatus(userId: string): Promise<SyncStatus> {
  try {
    const raw = await AsyncStorage.getItem(`${SYNC_STATUS_KEY}_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pushedLogIds: [] };
}

async function saveSyncStatus(userId: string, status: SyncStatus): Promise<void> {
  await AsyncStorage.setItem(`${SYNC_STATUS_KEY}_${userId}`, JSON.stringify(status));
}

/**
 * Compute the canonical JSON for a DailyLog (same logic as integrity.ts).
 * This is stored in the cloud to guarantee hash reproducibility.
 */
export function canonicalizeLog(log: DailyLog): string {
  return JSON.stringify({
    id: log.id,
    userId: log.userId,
    date: log.date,
    startTime: log.startTime,
    endTime: log.endTime,
    totalDrivingSeconds: log.totalDrivingSeconds,
    totalWorkSeconds: log.totalWorkSeconds,
    breaks: log.breaks.map((b) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      durationSeconds: b.durationSeconds,
    })),
    events: log.events.map((e) => ({
      type: e.type,
      timestamp: e.timestamp,
    })),
  });
}

/**
 * Call a tRPC endpoint via raw HTTP (avoids needing the full tRPC client
 * which may not be available in all contexts).
 */
async function trpcCall(path: string, input: any, method: "query" | "mutation" = "mutation"): Promise<any> {
  try {
    if (method === "query") {
      const encoded = encodeURIComponent(JSON.stringify({ json: input }));
      const res = await fetch(`${API_BASE}/${path}?input=${encoded}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.result?.data?.json ?? data?.result?.data ?? data;
    } else {
      const res = await fetch(`${API_BASE}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ json: input }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return data?.result?.data?.json ?? data?.result?.data ?? data;
    }
  } catch (e) {
    console.error(`[CloudSync] trpcCall ${path} failed:`, e);
    return null;
  }
}

/**
 * Get the hash chain entries for a user from AsyncStorage.
 */
async function getHashChain(userId: string): Promise<Array<{ logId: string; hash: string; previousHash: string; timestamp: string }>> {
  try {
    const raw = await AsyncStorage.getItem(`drivelegal_hash_chain_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

/**
 * Push all un-synced completed shift logs to the cloud.
 * Idempotent — safe to call multiple times.
 */
export async function pushLogsToCloud(userId: string): Promise<{ pushed: number; skipped: number }> {
  const syncStatus = await getSyncStatus(userId);
  const pushedSet = new Set(syncStatus.pushedLogIds);

  // Load all local logs
  const logsRaw = await AsyncStorage.getItem(`gnzl_logs_${userId}`);
  if (!logsRaw) return { pushed: 0, skipped: 0 };

  const allLogs: DailyLog[] = JSON.parse(logsRaw);
  const hashChain = await getHashChain(userId);
  const hashMap = new Map(hashChain.map((h) => [h.logId, h]));

  // Filter to un-synced logs
  const unsynced = allLogs.filter((log) => !pushedSet.has(log.id));
  if (unsynced.length === 0) return { pushed: 0, skipped: 0 };

  // Build push payload
  const logsToSend = unsynced.map((log) => {
    const chainEntry = hashMap.get(log.id);
    return {
      logId: log.id,
      date: log.date,
      logData: log,
      canonicalJson: canonicalizeLog(log),
      hash: chainEntry?.hash ?? "",
      previousHash: chainEntry?.previousHash ?? "",
      hashTimestamp: chainEntry?.timestamp ?? new Date().toISOString(),
      startTime: log.startTime,
      endTime: log.endTime,
    };
  });

  const result = await trpcCall("sync.pushLogs", {
    driverLocalUserId: userId,
    logs: logsToSend,
  });

  if (result?.success) {
    // Mark all as synced
    const newPushedIds = [...syncStatus.pushedLogIds, ...unsynced.map((l) => l.id)];
    await saveSyncStatus(userId, {
      lastPushTime: new Date().toISOString(),
      pushedLogIds: newPushedIds,
    });
    return { pushed: result.inserted ?? unsynced.length, skipped: result.skipped ?? 0 };
  }

  return { pushed: 0, skipped: 0 };
}

/**
 * Pull shift logs from the cloud and merge into local AsyncStorage.
 * Used on login to restore history from another device.
 */
export async function pullLogsFromCloud(userId: string): Promise<{ pulled: number }> {
  const result = await trpcCall("sync.pullLogs", { driverLocalUserId: userId }, "query");
  if (!result?.logs || result.logs.length === 0) return { pulled: 0 };

  // Load existing local logs
  const logsRaw = await AsyncStorage.getItem(`gnzl_logs_${userId}`);
  const localLogs: DailyLog[] = logsRaw ? JSON.parse(logsRaw) : [];
  const localLogIds = new Set(localLogs.map((l) => l.id));

  // Merge cloud logs that don't exist locally
  let pulled = 0;
  const cloudLogs: DailyLog[] = [];
  const cloudHashChain: Array<{ logId: string; hash: string; previousHash: string; timestamp: string }> = [];

  for (const row of result.logs) {
    const logData = row.logData as DailyLog;
    if (!localLogIds.has(row.logId)) {
      cloudLogs.push(logData);
      pulled++;
    }
    // Always rebuild hash chain from cloud data
    if (row.hash) {
      cloudHashChain.push({
        logId: row.logId,
        hash: row.hash,
        previousHash: row.previousHash,
        timestamp: row.hashTimestamp,
      });
    }
  }

  if (pulled > 0) {
    // Merge and sort by startTime descending
    const merged = [...localLogs, ...cloudLogs].sort(
      (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
    );
    await AsyncStorage.setItem(`gnzl_logs_${userId}`, JSON.stringify(merged));
  }

  // Merge hash chain
  if (cloudHashChain.length > 0) {
    const existingChain = await getHashChain(userId);
    const existingIds = new Set(existingChain.map((e) => e.logId));
    const newEntries = cloudHashChain.filter((e) => !existingIds.has(e.logId));
    if (newEntries.length > 0) {
      const mergedChain = [...existingChain, ...newEntries].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      await AsyncStorage.setItem(`drivelegal_hash_chain_${userId}`, JSON.stringify(mergedChain));
    }
  }

  // Update sync status so we don't re-push what we just pulled
  const syncStatus = await getSyncStatus(userId);
  const allLogIds = result.logs.map((r: any) => r.logId);
  const mergedPushedIds = [...new Set([...syncStatus.pushedLogIds, ...allLogIds])];
  await saveSyncStatus(userId, {
    ...syncStatus,
    pushedLogIds: mergedPushedIds,
  });

  return { pulled };
}

/**
 * Register a driver in the cloud DB for cross-device login.
 */
export async function registerDriverCloud(params: {
  localUserId: string;
  email: string;
  passwordHash: string;
  name: string;
  tslNumber?: string;
  operatorName?: string;
  licenceNumber?: string;
  licenceClass?: string;
  licenceExpiry?: string;
  vehicleRegistration?: string;
  vehicleType?: string;
  driverType?: DriverType;
  trialStartDate?: string;
  baseUrl: string;
}): Promise<{ success: boolean; error?: string }> {
  const result = await trpcCall("driverAuth.register", params);
  if (!result) return { success: false, error: "Network error. Account saved locally." };
  return result;
}

/**
 * Authenticate a driver against the cloud DB.
 * Returns driver profile if successful, null otherwise.
 */
export async function loginDriverCloud(email: string, passwordHash: string): Promise<{
  success: boolean;
  error?: string;
  verificationRequired?: boolean;
  email?: string;
  driver?: {
    localUserId: string;
    email: string;
    name: string;
    tslNumber: string | null;
    operatorName: string | null;
    licenceNumber: string | null;
    licenceClass: string | null;
    licenceExpiry: string | null;
    vehicleRegistration: string | null;
    vehicleType: string | null;
    driverType: DriverType;
    trialStartDate: string | null;
  };
}> {
  const result = await trpcCall("driverAuth.login", { email, passwordHash });
  if (!result) return { success: false, error: "Network error. Using local account." };
  return result;
}

/**
 * Sync profile updates to the cloud.
 */
export async function syncProfileToCloud(params: {
  localUserId: string;
  name?: string;
  tslNumber?: string;
  operatorName?: string;
  licenceNumber?: string;
  licenceClass?: string;
  licenceExpiry?: string;
  vehicleRegistration?: string;
  vehicleType?: string;
  driverType?: DriverType;
}): Promise<void> {
  await trpcCall("driverAuth.updateProfile", params);
}

/**
 * Request a password reset email for a driver account.
 */
export async function forgotPasswordRequest(email: string): Promise<void> {
  const baseUrl = Platform.OS === "web" && typeof window !== "undefined" && window.location
    ? window.location.origin
    : LIVE_BACKEND;
  await trpcCall("driverAuth.forgotPassword", { email, baseUrl });
}

/**
 * Reset a driver's password using a valid reset token.
 */
export async function resetPasswordWithToken(token: string, newPasswordHash: string): Promise<{ success: boolean; error?: string }> {
  const result = await trpcCall("driverAuth.resetPassword", { token, newPasswordHash });
  if (!result) return { success: false, error: "Network error." };
  return result;
}

/**
 * Resend verification email for a driver account.
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; message?: string }> {
  const baseUrl = Platform.OS === "web" && typeof window !== "undefined" && window.location
    ? window.location.origin
    : LIVE_BACKEND;
  const result = await trpcCall("driverAuth.resendVerification", { email, baseUrl });
  if (!result) return { success: false, message: "Network error." };
  return result;
}

/**
 * Verify email using a token from the verification link.
 */
export async function verifyEmailToken(token: string): Promise<{ success: boolean; error?: string }> {
  const result = await trpcCall("driverAuth.verifyEmail", { token });
  if (!result) return { success: false, error: "Network error." };
  return result;
}
