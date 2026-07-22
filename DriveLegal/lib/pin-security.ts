import AsyncStorage from "@react-native-async-storage/async-storage";

const PIN_KEY = "drivelegal_pin";

export async function hasPin(): Promise<boolean> {
  const pin = await AsyncStorage.getItem(PIN_KEY);
  return !!pin;
}

export async function savePin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) {
    throw new Error("PIN must be exactly 4 digits.");
  }

  await AsyncStorage.setItem(PIN_KEY, pin);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const saved = await AsyncStorage.getItem(PIN_KEY);

  if (!saved) {
    return false;
  }

  return saved === pin;
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
  await AsyncStorage.removeItem(PIN_KEY);
}
