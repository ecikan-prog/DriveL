import crypto from "crypto";

function legacySimpleHash(value: string): string {
  let hash = 0;

  for (let i = 0; i < value.length; i++) {
    const char = value.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }

  return hash.toString(16);
}

export function hashDriverPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

export function verifyDriverPassword(
  password: string,
  storedHash: string,
): {
  matches: boolean;
  canonicalHash: string;
  needsMigration: boolean;
} {
  const canonicalHash = hashDriverPassword(password);

  if (storedHash === canonicalHash) {
    return {
      matches: true,
      canonicalHash,
      needsMigration: false,
    };
  }

  if (storedHash === legacySimpleHash(password)) {
    return {
      matches: true,
      canonicalHash,
      needsMigration: true,
    };
  }

  return {
    matches: false,
    canonicalHash,
    needsMigration: false,
  };
}
