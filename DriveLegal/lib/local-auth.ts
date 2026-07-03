/**
 * Local authentication library for Guided NZ Logbook.
 * Uses AsyncStorage for offline-first user management.
 * Stores hashed passwords (simple hash for MVP - no server required).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const USERS_KEY = "gnzl_users";
const CURRENT_USER_KEY = "gnzl_current_user";

export type DriverType = "goods" | "large_passenger" | "small_passenger" | "vehicle_recovery";

export type Driver = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  tslNumber: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType: DriverType; // Goods=5.5h, Large Passenger=5.5h, Small Passenger=7h, Vehicle Recovery=5.5h
  operatorName?: string;
  licenceClass?: string;
  licenceExpiry?: string;
  createdAt: string;
  trialStartDate: string;
};

export type AuthUser = Omit<Driver, "passwordHash">;

/** Simple deterministic hash for MVP (not cryptographically secure) */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function getAllUsers(): Promise<Driver[]> {
  try {
    const raw = await AsyncStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveAllUsers(users: Driver[]): Promise<void> {
  await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  tslNumber: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType?: DriverType;
  operatorName?: string;
  licenceClass?: string;
  licenceExpiry?: string;
}): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  const users = await getAllUsers();
  const emailLower = params.email.toLowerCase().trim();

  if (users.find((u) => u.email.toLowerCase() === emailLower)) {
    return { success: false, error: "An account with this email already exists." };
  }

  if (params.password.length < 10) {
    return { success: false, error: "Password must be at least 10 characters." };
  }

  const now = new Date().toISOString();
  const driver: Driver = {
    id: generateId(),
    name: params.name.trim(),
    email: emailLower,
    passwordHash: simpleHash(params.password),
    tslNumber: params.tslNumber.trim().toUpperCase(),
    licenceNumber: params.licenceNumber.trim().toUpperCase(),
    vehicleRegistration: params.vehicleRegistration.trim().toUpperCase(),
    vehicleType: params.vehicleType.trim(),
    driverType: params.driverType || "small_passenger",
    operatorName: params.operatorName?.trim() || undefined,
    licenceClass: params.licenceClass?.trim() || undefined,
    licenceExpiry: params.licenceExpiry?.trim() || undefined,
    createdAt: now,
    trialStartDate: now,
  };

  users.push(driver);
  await saveAllUsers(users);

  const { passwordHash: _, ...authUser } = driver;
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
  return { success: true, user: authUser };
}

export async function loginUser(
  email: string,
  password: string
): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  const users = await getAllUsers();
  const emailLower = email.toLowerCase().trim();
  const user = users.find((u) => u.email.toLowerCase() === emailLower);

  if (!user) {
    return { success: false, error: "No account found with this email." };
  }

  if (user.passwordHash !== simpleHash(password)) {
    return { success: false, error: "Incorrect password." };
  }

  const { passwordHash: _, ...authUser } = user;
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
  return { success: true, user: authUser };
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const raw = await AsyncStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<Driver, "name" | "licenceNumber" | "vehicleRegistration" | "vehicleType" | "driverType" | "operatorName" | "licenceClass" | "licenceExpiry">>
): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  const users = await getAllUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return { success: false, error: "User not found." };

  users[idx] = { ...users[idx], ...updates };
  await saveAllUsers(users);

  const { passwordHash: _, ...authUser } = users[idx];
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
  return { success: true, user: authUser };
}

/** Returns days remaining in 14-day trial, or -1 if expired */
export function getTrialDaysRemaining(trialStartDate: string): number {
  const start = new Date(trialStartDate).getTime();
  const now = Date.now();
  const elapsed = (now - start) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(14 - elapsed));
}

/** Expose the hash function for cloud auth integration */
export function hashPassword(password: string): string {
  return simpleHash(password);
}

/**
 * Create a local account from cloud data (used when logging in from a new device).
 * Skips duplicate check since we know this is a cloud-verified account.
 */
export async function createLocalAccountFromCloud(params: {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  tslNumber: string;
  licenceNumber: string;
  vehicleRegistration: string;
  vehicleType: string;
  driverType: DriverType;
  operatorName?: string;
  licenceClass?: string;
  licenceExpiry?: string;
  trialStartDate: string;
}): Promise<{ success: true; user: AuthUser } | { success: false; error: string }> {
  const users = await getAllUsers();
  const emailLower = params.email.toLowerCase().trim();

  // Check if already exists locally
  const existing = users.find((u) => u.email.toLowerCase() === emailLower || u.id === params.id);
  if (existing) {
    // Update existing local account
    const idx = users.indexOf(existing);
    users[idx] = {
      ...existing,
      name: params.name,
      passwordHash: params.passwordHash,
      tslNumber: params.tslNumber,
      licenceNumber: params.licenceNumber,
      vehicleRegistration: params.vehicleRegistration,
      vehicleType: params.vehicleType,
      driverType: params.driverType,
      operatorName: params.operatorName || existing.operatorName,
      licenceClass: params.licenceClass || existing.licenceClass,
      licenceExpiry: params.licenceExpiry || existing.licenceExpiry,
    };
    await saveAllUsers(users);
    const { passwordHash: _, ...authUser } = users[idx];
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
    return { success: true, user: authUser };
  }

  const driver: Driver = {
    id: params.id,
    name: params.name,
    email: emailLower,
    passwordHash: params.passwordHash,
    tslNumber: params.tslNumber,
    licenceNumber: params.licenceNumber,
    vehicleRegistration: params.vehicleRegistration,
    vehicleType: params.vehicleType,
    driverType: params.driverType,
    operatorName: params.operatorName || undefined,
    licenceClass: params.licenceClass || undefined,
    licenceExpiry: params.licenceExpiry || undefined,
    createdAt: new Date().toISOString(),
    trialStartDate: params.trialStartDate,
  };

  users.push(driver);
  await saveAllUsers(users);

  const { passwordHash: _, ...authUser } = driver;
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(authUser));
  return { success: true, user: authUser };
}
