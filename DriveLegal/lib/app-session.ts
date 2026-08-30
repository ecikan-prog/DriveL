import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const AUTH_SESSION_KEY = "drivelegal_auth_session";
const DEVICE_ID_KEY = "drivelegal_device_id";
const LOGOUT_NOTICE_KEY = "drivelegal_logout_notice";

export type StoredAuthSession = {
  userId: string;
  sessionToken: string;
  deviceId: string;
  deviceLabel: string;
};

function generateOpaqueId(): string {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2)
  );
}

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);

  if (existing) {
    return existing;
  }

  const created = generateOpaqueId();
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
