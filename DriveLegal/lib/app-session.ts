import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

const AUTH_SESSION_KEY = "drivelegal_auth_session";
const DEVICE_ID_KEY = "drivelegal_device_id";
const LOGOUT_NOTICE_KEY = "drivelegal_logout_notice";

export type StoredAuthSession = {
  userId: string;
  sessionToken: string;
  deviceId: string;
  deviceLabel: string;
  appAccountToken?: string;
};

type SessionInvalidationListener = (message: string) => void;

const sessionInvalidationListeners = new Set<SessionInvalidationListener>();

function formatUuidFromBytes(bytes: Uint8Array): string {
  const copy = new Uint8Array(bytes);
  copy[6] = (copy[6] & 0x0f) | 0x40;
  copy[8] = (copy[8] & 0x3f) | 0x80;

  const hex = Array.from(copy, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

async function generateOpaqueId(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return formatUuidFromBytes(Uint8Array.from(bytes));
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const created = await generateOpaqueId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, created);
  return created;
}

export function getDeviceLabel(): string {
  if (Platform.OS === "ios") {
    return "iOS device";
  }

  if (Platform.OS === "android") {
    return "Android device";
  }

  if (Platform.OS === "web") {
    return "Web browser";
  }

  return "This device";
}

export async function saveAuthSession(
  session: StoredAuthSession,
): Promise<void> {
  await AsyncStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function getAuthSession(): Promise<StoredAuthSession | null> {
  try {
    const raw = await AsyncStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthSession) : null;
  } catch {
    return null;
  }
}

export async function patchAuthSession(
  patch: Partial<StoredAuthSession>,
): Promise<StoredAuthSession | null> {
  const existing = await getAuthSession();

  if (!existing) {
    return null;
  }

  const updated = {
    ...existing,
    ...patch,
  };

  await saveAuthSession(updated);
  return updated;
}

export async function clearAuthSession(): Promise<void> {
  await AsyncStorage.removeItem(AUTH_SESSION_KEY);
}

export async function setPendingLogoutNotice(message: string): Promise<void> {
  await AsyncStorage.setItem(LOGOUT_NOTICE_KEY, message);
}

export async function consumePendingLogoutNotice(): Promise<string | null> {
  const message = await AsyncStorage.getItem(LOGOUT_NOTICE_KEY);

  if (message) {
    await AsyncStorage.removeItem(LOGOUT_NOTICE_KEY);
  }

  return message;
}

export function subscribeToSessionInvalidation(
  listener: SessionInvalidationListener,
): () => void {
  sessionInvalidationListeners.add(listener);

  return () => {
    sessionInvalidationListeners.delete(listener);
  };
}

export function notifySessionInvalidated(message: string): void {
  for (const listener of sessionInvalidationListeners) {
    try {
      listener(message);
    } catch (error) {
      console.error("[AppSession] Session invalidation listener failed:", error);
    }
  }
}
