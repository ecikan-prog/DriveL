import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatHoursMinutes,
  logsToCSV,
  buildDailyLog,
  computeCurrentDrivingSeconds,
  computeCurrentWorkSeconds,
  isCurrentlyOnBreak,
  type DailyLog,
  type ActiveShift,
} from "../lib/logbook-storage";
import {
  LIMITS,
  getDrivingProgressPercent,
  getWorkProgressPercent,
  getFortnightProgressPercent,
  evaluateCompliance,
} from "../hooks/use-nzta-compliance";

// ─── formatDuration ──────────────────────────────────────────────────────────

describe("formatDuration", () => {
  it("formats 0 seconds as 00:00:00", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formats 3661 seconds as 01:01:01", () => {
    expect(formatDuration(3661)).toBe("01:01:01");
  });

  it("formats 7 hours exactly", () => {
    expect(formatDuration(7 * 3600)).toBe("07:00:00");
  });

  it("formats 13 hours exactly", () => {
    expect(formatDuration(13 * 3600)).toBe("13:00:00");
  });
});

// ─── formatHoursMinutes ──────────────────────────────────────────────────────

describe("formatHoursMinutes", () => {
  it("formats 0 as 0m", () => {
    expect(formatHoursMinutes(0)).toBe("0m");
  });

  it("formats 3600 as 1h", () => {
    expect(formatHoursMinutes(3600)).toBe("1h");
  });

  it("formats 5400 as 1h 30m", () => {
    expect(formatHoursMinutes(5400)).toBe("1h 30m");
  });

  it("formats 7 hours as 7h", () => {
    expect(formatHoursMinutes(7 * 3600)).toBe("7h");
  });
});

// ─── NZTA Limits ─────────────────────────────────────────────────────────────

describe("NZTA Limits constants", () => {
  it("passenger driving warning limit is 7 hours (25200 seconds)", () => {
    expect(LIMITS.PASSENGER_DRIVING_WARNING_SECONDS).toBe(7 * 3600);
  });

  it("goods driving warning limit is 5.5 hours (19800 seconds)", () => {
    expect(LIMITS.GOODS_DRIVING_WARNING_SECONDS).toBe(5.5 * 3600);
  });

  it("work warning limit is 13 hours (46800 seconds)", () => {
    expect(LIMITS.WORK_WARNING_SECONDS).toBe(13 * 3600);
  });

  it("fortnightly limit is 70 hours (252000 seconds)", () => {
    expect(LIMITS.FORTNIGHT_LIMIT_SECONDS).toBe(70 * 3600);
  });

  it("fortnightly warning threshold is 63 hours (226800 seconds)", () => {
    expect(LIMITS.FORTNIGHT_WARNING_SECONDS).toBe(63 * 3600);
  });
});

// ─── Progress Percent ────────────────────────────────────────────────────────

describe("getDrivingProgressPercent", () => {
  it("returns 0 for 0 seconds", () => {
    expect(getDrivingProgressPercent(0)).toBe(0);
  });

  it("returns 50 at 3.5 hours", () => {
    expect(getDrivingProgressPercent(3.5 * 3600)).toBeCloseTo(50, 0);
  });

  it("returns 100 at 7 hours", () => {
    expect(getDrivingProgressPercent(7 * 3600)).toBe(100);
  });

  it("caps at 100 when over limit", () => {
    expect(getDrivingProgressPercent(8 * 3600)).toBe(100);
  });
});

describe("getWorkProgressPercent", () => {
  it("returns 0 for 0 seconds", () => {
    expect(getWorkProgressPercent(0)).toBe(0);
  });

  it("returns 100 at 13 hours", () => {
    expect(getWorkProgressPercent(13 * 3600)).toBe(100);
  });
});

describe("getFortnightProgressPercent", () => {
  it("returns 0 for 0 seconds", () => {
    expect(getFortnightProgressPercent(0)).toBe(0);
  });

  it("returns 100 at 70 hours", () => {
    expect(getFortnightProgressPercent(70 * 3600)).toBe(100);
  });
});

// ─── Compliance Warnings ─────────────────────────────────────────────────────

describe("evaluateCompliance", () => {
  it("returns no warnings when all within limits", () => {
    const result = evaluateCompliance(3 * 3600, 5 * 3600, 10 * 3600);
    expect(result.warnings).toHaveLength(0);
    expect(result.isDrivingWarning).toBe(false);
    expect(result.isWorkWarning).toBe(false);
    expect(result.isFortnightWarning).toBe(false);
    expect(result.isFortnightCritical).toBe(false);
  });

  it("triggers driving warning at exactly 7 hours", () => {
    const result = evaluateCompliance(7 * 3600, 7 * 3600, 10 * 3600);
    expect(result.isDrivingWarning).toBe(true);
    const drivingWarn = result.warnings.find((w) => w.id === "driving_limit");
    expect(drivingWarn).toBeDefined();
    expect(drivingWarn?.level).toBe("warning");
  });

  it("triggers work warning at exactly 13 hours", () => {
    const result = evaluateCompliance(5 * 3600, 13 * 3600, 10 * 3600);
    expect(result.isWorkWarning).toBe(true);
    const workWarn = result.warnings.find((w) => w.id === "work_limit");
    expect(workWarn).toBeDefined();
    expect(workWarn?.level).toBe("critical");
  });

  it("triggers fortnight warning at 63 hours", () => {
    const result = evaluateCompliance(0, 0, 63 * 3600);
    expect(result.isFortnightWarning).toBe(true);
    expect(result.isFortnightCritical).toBe(false);
  });

  it("triggers fortnight critical at 70 hours", () => {
    const result = evaluateCompliance(0, 0, 70 * 3600);
    expect(result.isFortnightCritical).toBe(true);
  });

  it("does NOT trigger driving warning before 7 hours", () => {
    const result = evaluateCompliance(6.9 * 3600, 6.9 * 3600, 0);
    expect(result.isDrivingWarning).toBe(false);
  });

  it("does NOT trigger work warning before 13 hours", () => {
    const result = evaluateCompliance(5 * 3600, 12.9 * 3600, 0);
    expect(result.isWorkWarning).toBe(false);
  });
});

// ─── buildDailyLog ────────────────────────────────────────────────────────────

describe("buildDailyLog", () => {
  const baseShift: ActiveShift = {
    userId: "user-1",
    startTime: "2026-05-01T08:00:00.000Z",
    events: [
      { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
    ],
  };

  it("computes total work seconds correctly", () => {
    const endTime = "2026-05-01T16:00:00.000Z"; // 8 hours later
    const log = buildDailyLog(baseShift, endTime);
    expect(log.totalWorkSeconds).toBe(8 * 3600);
  });

  it("computes driving seconds as work minus breaks", () => {
    const shiftWithBreak: ActiveShift = {
      userId: "user-1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [
        { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
        { type: "break_start", timestamp: "2026-05-01T12:00:00.000Z" },
        { type: "break_end", timestamp: "2026-05-01T12:30:00.000Z" },
      ],
    };
    const endTime = "2026-05-01T16:00:00.000Z"; // 8 hours total, 30min break
    const log = buildDailyLog(shiftWithBreak, endTime);
    expect(log.totalWorkSeconds).toBe(7.5 * 3600); // work = driving + other work (breaks excluded)
    expect(log.totalDrivingSeconds).toBe(7.5 * 3600); // 8h - 30min break = 7.5h driving
    expect(log.breaks).toHaveLength(1);
    expect(log.breaks[0].durationSeconds).toBe(30 * 60);
  });

  it("sets correct date from shift start", () => {
    const log = buildDailyLog(baseShift, "2026-05-01T16:00:00.000Z");
    expect(log.date).toBe("2026-05-01");
  });

  it("assigns correct userId", () => {
    const log = buildDailyLog(baseShift, "2026-05-01T16:00:00.000Z");
    expect(log.userId).toBe("user-1");
  });
});

// ─── computeCurrentDrivingSeconds ────────────────────────────────────────────

describe("computeCurrentDrivingSeconds", () => {
  it("counts all time as driving when no breaks", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [{ type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" }],
    };
    const nowMs = new Date("2026-05-01T10:00:00.000Z").getTime();
    expect(computeCurrentDrivingSeconds(shift, nowMs)).toBe(2 * 3600);
  });

  it("resets driving after a 30-min break (NZTA rule)", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [
        { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
        { type: "break_start", timestamp: "2026-05-01T10:00:00.000Z" },
        { type: "break_end", timestamp: "2026-05-01T10:30:00.000Z" },
      ],
    };
    const nowMs = new Date("2026-05-01T12:00:00.000Z").getTime();
    // 30-min break resets driving. Post-break driving = 12:00 - 10:30 = 1.5h
    expect(computeCurrentDrivingSeconds(shift, nowMs)).toBe(1.5 * 3600);
  });

  it("does NOT reset driving after a short break (< 30 min)", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [
        { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
        { type: "break_start", timestamp: "2026-05-01T10:00:00.000Z" },
        { type: "break_end", timestamp: "2026-05-01T10:20:00.000Z" }, // only 20 min
      ],
    };
    const nowMs = new Date("2026-05-01T12:00:00.000Z").getTime();
    // Short break: driving = 2h pre-break + 1h40m post-break = 3h40m = 13200s
    expect(computeCurrentDrivingSeconds(shift, nowMs)).toBe(2 * 3600 + 100 * 60);
  });
});

// ─── isCurrentlyOnBreak ───────────────────────────────────────────────────────

describe("isCurrentlyOnBreak", () => {
  it("returns false when last event is shift_start", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [{ type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" }],
    };
    expect(isCurrentlyOnBreak(shift)).toBe(false);
  });

  it("returns true when last event is break_start", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [
        { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
        { type: "break_start", timestamp: "2026-05-01T10:00:00.000Z" },
      ],
    };
    expect(isCurrentlyOnBreak(shift)).toBe(true);
  });

  it("returns false after break ends", () => {
    const shift: ActiveShift = {
      userId: "u1",
      startTime: "2026-05-01T08:00:00.000Z",
      events: [
        { type: "shift_start", timestamp: "2026-05-01T08:00:00.000Z" },
        { type: "break_start", timestamp: "2026-05-01T10:00:00.000Z" },
        { type: "break_end", timestamp: "2026-05-01T10:30:00.000Z" },
      ],
    };
    expect(isCurrentlyOnBreak(shift)).toBe(false);
  });
});

// ─── CSV Export ──────────────────────────────────────────────────────────────

describe("logsToCSV", () => {
  const sampleLog: DailyLog = {
    id: "log-1",
    userId: "user-1",
    date: "2026-05-01",
    startTime: "2026-05-01T08:00:00.000Z",
    endTime: "2026-05-01T16:00:00.000Z",
    totalDrivingSeconds: 6 * 3600,
    totalWorkSeconds: 8 * 3600,
    breaks: [
      {
        startTime: "2026-05-01T12:00:00.000Z",
        endTime: "2026-05-01T12:30:00.000Z",
        durationSeconds: 30 * 60,
      },
    ],
    events: [],
  };

  it("includes CSV column header row", () => {
    const csv = logsToCSV([sampleLog], "John Smith", "AB123456");
    expect(csv).toContain("Date");
    expect(csv).toContain("Shift Start");
    expect(csv).toContain("Shift End");
  });

  it("includes driver name in output", () => {
    const csv = logsToCSV([sampleLog], "John Smith", "AB123456");
    expect(csv).toContain("John Smith");
  });

  it("includes licence number in output", () => {
    const csv = logsToCSV([sampleLog], "John Smith", "AB123456");
    expect(csv).toContain("AB123456");
  });

  it("includes the log date", () => {
    const csv = logsToCSV([sampleLog], "John Smith", "AB123456");
    expect(csv).toContain("2026-05-01");
  });

  it("produces multiple lines for one log", () => {
    const csv = logsToCSV([sampleLog], "John Smith", "AB123456");
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBeGreaterThan(1);
  });

  it("returns empty data rows for empty log array", () => {
    const csv = logsToCSV([], "John Smith", "AB123456");
    const lines = csv.split("\n").filter((l) => l.trim());
    // Only the header row
    expect(lines.length).toBe(1);
  });
});
