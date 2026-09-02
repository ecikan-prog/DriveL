import { describe, expect, it } from "vitest";

import {
  hashDriverPassword,
  verifyDriverPassword,
} from "../server/driver-password";

describe("driver password verification", () => {
  it("matches the canonical SHA-256 driver hash without migration", () => {
    const password = "DriveLegal2026!";
    const storedHash = hashDriverPassword(password);

    expect(verifyDriverPassword(password, storedHash)).toEqual({
      matches: true,
      canonicalHash: storedHash,
      needsMigration: false,
    });
  });

  it("matches the legacy simple hash and requests migration", () => {
    const password = "DriveLegal2026!";

    expect(verifyDriverPassword(password, "27abdd50")).toEqual({
      matches: true,
      canonicalHash: hashDriverPassword(password),
      needsMigration: true,
    });
  });

  it("rejects a wrong password", () => {
    const storedHash = hashDriverPassword("DriveLegal2026!");

    expect(verifyDriverPassword("WrongPassword2026!", storedHash)).toEqual({
      matches: false,
      canonicalHash: hashDriverPassword("WrongPassword2026!"),
      needsMigration: false,
    });
  });
});
