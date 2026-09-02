import crypto from "crypto";

const SCRYPT_PREFIX = "s1";
const SCRYPT_SALT_BYTES = 10;
const SCRYPT_KEY_BYTES = 24;

export function hashDriverPassword(password: string): string {
  const salt = crypto.randomBytes(SCRYPT_SALT_BYTES);
  const derivedKey = crypto.scryptSync(password, salt, SCRYPT_KEY_BYTES);

  return `${SCRYPT_PREFIX}$${salt.toString("base64url")}$${derivedKey.toString("base64url")}`;
}

function verifyScryptPassword(password: string, storedHash: string): boolean {
  const [prefix, encodedSalt, encodedHash] = storedHash.split("$");

  if (!prefix || !encodedSalt || !encodedHash || prefix !== SCRYPT_PREFIX) {
    return false;
  }

  try {
    const salt = Buffer.from(encodedSalt, "base64url");
    const expectedHash = Buffer.from(encodedHash, "base64url");
    const derivedKey = crypto.scryptSync(password, salt, expectedHash.length);

    return crypto.timingSafeEqual(derivedKey, expectedHash);
  } catch {
    return false;
  }
}

export function verifyDriverPassword(
  password: string,
  storedHash: string,
  legacyHashes?: {
    simpleHash?: string;
    sha256Hex?: string;
  },
): {
  matches: boolean;
  nextHash?: string;
  needsMigration: boolean;
} {
  if (verifyScryptPassword(password, storedHash)) {
    return {
      matches: true,
      needsMigration: false,
    };
  }

  if (
    storedHash === legacyHashes?.sha256Hex ||
    storedHash === legacyHashes?.simpleHash
  ) {
    return {
      matches: true,
      nextHash: hashDriverPassword(password),
      needsMigration: true,
    };
  }

  return {
    matches: false,
    needsMigration: false,
  };
}
