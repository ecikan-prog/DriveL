import * as SecureStore from "expo-secure-store";

const PIN_KEY = "drivelegal_pin";
const PIN_ENABLED_KEY = "drivelegal_pin_enabled";

function validatePin(pin: string): void {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }
}

export async function hasPin(): Promise<boolean> {
  const enabled = await SecureStore.getItemAsync(PIN_ENABLED_KEY);
  const storedPin = await SecureStore.getItemAsync(PIN_KEY);

  return enabled === "true" && Boolean(storedPin);
}

export async function savePin(pin: string): Promise<void> {
  validatePin(pin);

  await SecureStore.setItemAsync(PIN_KEY, pin, {
    keychainAccessible:
      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  await SecureStore.setItemAsync(PIN_ENABLED_KEY, "true", {
    keychainAccessible:
      SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function verifyPin(pin: string): Promise<boolean> {
  if (!/^\d{4}$/.test(pin)) {
    return false;
  }

  const storedPin = await SecureStore.getItemAsync(PIN_KEY);

  return storedPin === pin;
}

export async function changePin(
  currentPin: string,
  newPin: string
): Promise<boolean> {
  const valid = await verifyPin(currentPin);

  if (!valid) {
    return false;
  }

  await savePin(newPin);
  return true;
}

export async function removePin(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(PIN_KEY),
    SecureStore.deleteItemAsync(PIN_ENABLED_KEY),
  ]);
}
