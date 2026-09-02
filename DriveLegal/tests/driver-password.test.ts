import { describe, expect, it } from "vitest";

import {
  hashDriverPassword,
  verifyDriverPassword,
} from "../server/driver-password";

describe("driver password verification", () => {
  it("matches the canonical scrypt driver hash without migration", () => {
    const password = "DriveLegal2026!";
    const storedHash = hashDriverPassword(password);

    expect(storedHash.startsWith("s1$")).toBe(true);
    expect(storedHash.length).toBeLessThanOrEqual(64);
    expect(verifyDriverPassword(password, storedHash)).toEqual({
      matches: true,
      needsMigration: false,
    });
  });

  it("matches the legacy simple hash and requests migration", () => {
    const password = "DriveLegal2026!";
    const result = verifyDriverPassword(password, "27abdd50", {
      simpleHash: "27abdd50",
    });

    expect(result.matches).toBe(true);
    expect(result.needsMigration).toBe(true);
    expect(result.nextHash).toBeTruthy();
    expect(result.nextHash?.startsWith("s1$")).toBe(true);
    expect(
      result.nextHash && verifyDriverPassword(password, result.nextHash),
    ).toEqual({
      matches: true,
      needsMigration: false,
    });
  });

  it("matches the legacy SHA-256 hash and requests migration", () => {
    const password = "DriveLegal2026!";
    const storedHash =
      "7f576096fe3499935c6549bf2078e723752ded172190559bf38f27e20c9c3e89";
    const result = verifyDriverPassword(password, storedHash, {
      sha256Hex: storedHash,
    });

    expect(result.matches).toBe(true);
    expect(result.needsMigration).toBe(true);
    expect(result.nextHash).toBeTruthy();
    expect(result.nextHash?.startsWith("s1$")).toBe(true);
  });

  it("rejects a wrong password", () => {
    const storedHash = hashDriverPassword("DriveLegal2026!");

    expect(verifyDriverPassword("WrongPassword2026!", storedHash)).toEqual({
      matches: false,
      needsMigration: false,
    });
  });
});
