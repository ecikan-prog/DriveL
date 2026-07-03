import { describe, it, expect } from "vitest";
import { computeCurrentDrivingSeconds, ActiveShift } from "../lib/logbook-storage";

describe("computeCurrentDrivingSeconds - break reset", () => {
  it("should reset driving to 0 after a 30-minute break", () => {
    const shiftStart = new Date("2025-01-01T08:00:00Z").getTime();
    // Drive for 12 minutes, then take a 30-minute break, then drive for 5 minutes
    const shift: ActiveShift = {
      userId: "test",
      startTime: "2025-01-01T08:00:00Z",
      events: [
        { type: "shift_start", timestamp: "2025-01-01T08:00:00Z" },
        // Drive 12 minutes then start break
        { type: "break_start", timestamp: "2025-01-01T08:12:00Z" },
        // Break ends after 30 minutes
        { type: "break_end", timestamp: "2025-01-01T08:42:00Z" },
      ],
    };

    // Now it's 5 minutes after break ended (08:47:00)
    const now = new Date("2025-01-01T08:47:00Z").getTime();
    const result = computeCurrentDrivingSeconds(shift, now);

    // Should be 5 minutes (300 seconds) — NOT 17 minutes (12 + 5)
    // Because the 30-min break resets the driving accumulator
    expect(result).toBe(300);
  });

  it("should NOT reset driving after a short break (< 30 min)", () => {
    const shift: ActiveShift = {
      userId: "test",
      startTime: "2025-01-01T08:00:00Z",
      events: [
        { type: "shift_start", timestamp: "2025-01-01T08:00:00Z" },
        // Drive 12 minutes then start break
        { type: "break_start", timestamp: "2025-01-01T08:12:00Z" },
        // Break ends after only 20 minutes (not enough)
        { type: "break_end", timestamp: "2025-01-01T08:32:00Z" },
      ],
    };

    // Now it's 5 minutes after break ended (08:37:00)
    const now = new Date("2025-01-01T08:37:00Z").getTime();
    const result = computeCurrentDrivingSeconds(shift, now);

    // Should be 17 minutes (12 + 5 = 1020 seconds) — short break does NOT reset
    expect(result).toBe(1020);
  });

  it("should show full limit remaining immediately after 30-min break ends", () => {
    const shift: ActiveShift = {
      userId: "test",
      startTime: "2025-01-01T08:00:00Z",
      events: [
        { type: "shift_start", timestamp: "2025-01-01T08:00:00Z" },
        // Drive 12 minutes then start break
        { type: "break_start", timestamp: "2025-01-01T08:12:00Z" },
        // Break ends after exactly 30 minutes
        { type: "break_end", timestamp: "2025-01-01T08:42:00Z" },
      ],
    };

    // Now is exactly when break ended (08:42:00) — 0 seconds of driving since reset
    const now = new Date("2025-01-01T08:42:00Z").getTime();
    const result = computeCurrentDrivingSeconds(shift, now);

    // Should be 0 — just came off a qualifying break
    expect(result).toBe(0);
  });

  it("should handle other_work_start correctly (does NOT reset driving)", () => {
    const shift: ActiveShift = {
      userId: "test",
      startTime: "2025-01-01T08:00:00Z",
      events: [
        { type: "shift_start", timestamp: "2025-01-01T08:00:00Z" },
        // Drive 12 minutes then start other work
        { type: "other_work_start", timestamp: "2025-01-01T08:12:00Z" },
        // Other work ends after 30 minutes
        { type: "other_work_end", timestamp: "2025-01-01T08:42:00Z" },
      ],
    };

    // Now it's 5 minutes after other work ended (08:47:00)
    const now = new Date("2025-01-01T08:47:00Z").getTime();
    const result = computeCurrentDrivingSeconds(shift, now);

    // Should be 17 minutes (12 + 5 = 1020 seconds) — other work does NOT reset driving
    expect(result).toBe(1020);
  });

  it("should reset after a break even if there was driving before", () => {
    const shift: ActiveShift = {
      userId: "test",
      startTime: "2025-01-01T06:00:00Z",
      events: [
        { type: "shift_start", timestamp: "2025-01-01T06:00:00Z" },
        // Drive 5 hours (300 minutes)
        { type: "break_start", timestamp: "2025-01-01T11:00:00Z" },
        // 30 min break
        { type: "break_end", timestamp: "2025-01-01T11:30:00Z" },
      ],
    };

    // 10 minutes after break ended
    const now = new Date("2025-01-01T11:40:00Z").getTime();
    const result = computeCurrentDrivingSeconds(shift, now);

    // Should be 10 minutes (600 seconds) — 5 hours of driving was reset by the 30-min break
    expect(result).toBe(600);
  });
});
