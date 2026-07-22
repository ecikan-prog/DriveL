import * as SecureStore from "expo-secure-store";

const LEGACY_PIN_KEY = "drivelegal_pin";
const LEGACY_PIN_ENABLED_KEY = "drivelegal_pin_enabled";

const PIN_KEY_PREFIX = "drivelegal_pin";
const PIN_ENABLED_KEY_PREFIX = "drivelegal_pin_enabled";

let unlockedUserId: string | null = null;

function normalizeUserId(userId: string | number): string {
  const normalized = String(userId).trim();

  if (!normalized) {
    throw new Error("A valid user ID is required for PIN security.");
  }

  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getPinKey(userId: string | number): string {
  return `${PIN_KEY_PREFIX}_${normalizeUserId(userId)}`;
}

function getPinEnabledKey(userId: string | number): string {
  return `${PIN_ENABLED_KEY_PREFIX}_${normalizeUserId(userId)}`;
}

function validatePin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
}

/**
 * Removes the old device-wide PIN.
 *
 * The old PIN must not be assigned to any account because it may have
 * originally belonged to a different user.
 */
export async function removeLegacyGlobalPin(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(LEGACY_PIN_KEY),
    SecureStore.deleteItemAsync(LEGACY_PIN_ENABLED_KEY),
  ]);
}

export function isPinSessionUnlocked(
  userId: string | number
): boolean {
  return unlockedUserId === normalizeUserId(userId);
}

export function markPinSessionUnlocked(
  userId: string | number
): void {
  unlockedUserId = normalizeUserId(userId);
}

export function lockPinSession(): void {
  unlockedUserId = null;
}

export async function hasPin(
  userId: string | number
): Promise<boolean> {
  const [enabled, storedPin] = await Promise.all([
    SecureStore.getItemAsync(getPinEnabledKey(userId)),
    SecureStore.getItemAsync(getPinKey(userId)),
  ]);

  return enabled === "true" && Boolean(storedPin);
}

export async function savePin(
  userId: string | number,
  pin: string
): Promise<void> {
  validatePin(pin);

  await SecureStore.setItemAsync(getPinKey(userId), pin, {
    keychainAccessible:
      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  await SecureStore.setItemAsync(
    getPinEnabledKey(userId),
    "true",
    {
      keychainAccessible:
        SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }
  );
}

export async function verifyPin(
  userId: string | number,
  pin: string
): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) {
    return false;
  }

  const storedPin = await SecureStore.getItemAsync(
    getPinKey(userId)
  );

  return storedPin === pin;
}

export async function changePin(
  userId: string | number,
  currentPin: string,
  newPin: string
): Promise<boolean> {
  validatePin(newPin);

  const valid = await verifyPin(userId, currentPin);

  if (!valid) {
    return false;
  }

  await savePin(userId, newPin);

  return true;
}

export async function removePin(
  userId: string | number
): Promise<void> {
  const normalizedUserId = normalizeUserId(userId);

  await Promise.all([
    SecureStore.deleteItemAsync(getPinKey(normalizedUserId)),
    SecureStore.deleteItemAsync(
      getPinEnabledKey(normalizedUserId)
    ),
  ]);

  if (unlockedUserId === normalizedUserId) {
    unlockedUserId = null;
  }
}
