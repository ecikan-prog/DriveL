/**
 * Seed the NZTA demo account and TWO full Cumulative Work Periods into the cloud database.
 * Run with: npx tsx scripts/seed-demo-cloud.ts
 */
import "../scripts/load-env.js";
import { drizzle } from "drizzle-orm/mysql2";
import { drivers, shiftLogs } from "../drizzle/schema";

const DEMO_USER_ID = "demo_nzta_reviewer_2026";
const DEMO_EMAIL = "nzta.demo@roadlog.nz";
const DEMO_PASSWORD_HASH = "-4e34ebf2"; // simpleHash("NZTAReview2026!")

const LOCATIONS = [
  { latitude: -45.0312, longitude: 168.6626, displayName: "Frankton, Queenstown" },
  { latitude: -45.0301, longitude: 168.6613, displayName: "Queenstown CBD" },
  { latitude: -44.9956, longitude: 168.7395, displayName: "Arrowtown" },
  { latitude: -44.6681, longitude: 169.3139, displayName: "Cromwell" },
  { latitude: -45.4000, longitude: 168.3581, displayName: "Kingston" },
  { latitude: -44.8940, longitude: 168.8590, displayName: "Gibbston Valley" },
  { latitude: -44.7001, longitude: 169.1500, displayName: "Bannockburn" },
  { latitude: -45.1200, longitude: 168.9500, displayName: "Lake Hayes" },
  { latitude: -45.0500, longitude: 168.7000, displayName: "Kelvin Heights" },
  { latitude: -44.9700, longitude: 168.7900, displayName: "Lake Hayes Estate" },
];

type SampleShift = {
  daysAgo: number;
  startHour: number;
  drivingHours: number;
  otherWorkHours: number;
  breakMinutes: number;
  startOdometer: number;
  distanceKm: number;
  startLocIdx: number;
  endLocIdx: number;
};

// CWP 1: Days 28–15 ago (~68 hours driving)
const CWP1_SHIFTS: SampleShift[] = [
  { daysAgo: 28, startHour: 5, drivingHours: 6.5, otherWorkHours: 0.5, breakMinutes: 35, startOdometer: 82000, distanceKm: 298, startLocIdx: 0, endLocIdx: 3 },
  { daysAgo: 27, startHour: 6, drivingHours: 6, otherWorkHours: 1, breakMinutes: 40, startOdometer: 82298, distanceKm: 276, startLocIdx: 3, endLocIdx: 6 },
  { daysAgo: 26, startHour: 5, drivingHours: 5.5, otherWorkHours: 0.5, breakMinutes: 30, startOdometer: 82574, distanceKm: 243, startLocIdx: 6, endLocIdx: 0 },
  { daysAgo: 25, startHour: 7, drivingHours: 4, otherWorkHours: 1.5, breakMinutes: 30, startOdometer: 82817, distanceKm: 178, startLocIdx: 0, endLocIdx: 2 },
  { daysAgo: 24, startHour: 6, drivingHours: 6.5, otherWorkHours: 0.5, breakMinutes: 45, startOdometer: 82995, distanceKm: 312, startLocIdx: 2, endLocIdx: 4 },
  { daysAgo: 23, startHour: 5, drivingHours: 7, otherWorkHours: 0, breakMinutes: 35, startOdometer: 83307, distanceKm: 334, startLocIdx: 4, endLocIdx: 0 },
  { daysAgo: 21, startHour: 6, drivingHours: 6, otherWorkHours: 1, breakMinutes: 40, startOdometer: 83641, distanceKm: 265, startLocIdx: 0, endLocIdx: 5 },
  { daysAgo: 20, startHour: 5, drivingHours: 5.5, otherWorkHours: 0.5, breakMinutes: 30, startOdometer: 83906, distanceKm: 241, startLocIdx: 5, endLocIdx: 3 },
  { daysAgo: 19, startHour: 7, drivingHours: 6.5, otherWorkHours: 0.5, breakMinutes: 35, startOdometer: 84147, distanceKm: 289, startLocIdx: 3, endLocIdx: 0 },
  { daysAgo: 18, startHour: 6, drivingHours: 5, otherWorkHours: 1, breakMinutes: 30, startOdometer: 84436, distanceKm: 218, startLocIdx: 0, endLocIdx: 7 },
  { daysAgo: 17, startHour: 5, drivingHours: 5, otherWorkHours: 0.5, breakMinutes: 35, startOdometer: 84654, distanceKm: 223, startLocIdx: 7, endLocIdx: 4 },
  { daysAgo: 16, startHour: 6, drivingHours: 4.5, otherWorkHours: 1, breakMinutes: 30, startOdometer: 84877, distanceKm: 198, startLocIdx: 4, endLocIdx: 0 },
  { daysAgo: 15, startHour: 7, drivingHours: 4.5, otherWorkHours: 0.5, breakMinutes: 30, startOdometer: 85075, distanceKm: 201, startLocIdx: 0, endLocIdx: 8 },
];

// CWP 2: Days 13–1 ago (~52 hours driving, current period)
const CWP2_SHIFTS: SampleShift[] = [
  { daysAgo: 13, startHour: 6, drivingHours: 6, otherWorkHours: 0.5, breakMinutes: 35, startOdometer: 85276, distanceKm: 278, startLocIdx: 8, endLocIdx: 3 },
  { daysAgo: 12, startHour: 5, drivingHours: 6.5, otherWorkHours: 1, breakMinutes: 40, startOdometer: 85554, distanceKm: 301, startLocIdx: 3, endLocIdx: 6 },
  { daysAgo: 11, startHour: 6, drivingHours: 5.5, otherWorkHours: 0.5, breakMinutes: 30, startOdometer: 85855, distanceKm: 245, startLocIdx: 6, endLocIdx: 0 },
  { daysAgo: 10, startHour: 7, drivingHours: 4, otherWorkHours: 1.5, breakMinutes: 30, startOdometer: 86100, distanceKm: 176, startLocIdx: 0, endLocIdx: 2 },
  { daysAgo: 8, startHour: 5, drivingHours: 6.5, otherWorkHours: 0.5, breakMinutes: 45, startOdometer: 86276, distanceKm: 312, startLocIdx: 2, endLocIdx: 4 },
  { daysAgo: 7, startHour: 6, drivingHours: 5, otherWorkHours: 1, breakMinutes: 35, startOdometer: 86588, distanceKm: 221, startLocIdx: 4, endLocIdx: 0 },
  { daysAgo: 6, startHour: 5, drivingHours: 3.5, otherWorkHours: 0.5, breakMinutes: 0, startOdometer: 86809, distanceKm: 156, startLocIdx: 0, endLocIdx: 9 },
  { daysAgo: 5, startHour: 6, drivingHours: 6, otherWorkHours: 1, breakMinutes: 40, startOdometer: 86965, distanceKm: 267, startLocIdx: 9, endLocIdx: 3 },
  { daysAgo: 4, startHour: 7, drivingHours: 4.5, otherWorkHours: 0.5, breakMinutes: 30, startOdometer: 87232, distanceKm: 198, startLocIdx: 3, endLocIdx: 0 },
  { daysAgo: 3, startHour: 6, drivingHours: 5, otherWorkHours: 0.5, breakMinutes: 35, startOdometer: 87430, distanceKm: 223, startLocIdx: 0, endLocIdx: 5 },
  { daysAgo: 2, startHour: 5, drivingHours: 3, otherWorkHours: 1, breakMinutes: 30, startOdometer: 87653, distanceKm: 134, startLocIdx: 5, endLocIdx: 7 },
  { daysAgo: 1, startHour: 8, drivingHours: 2, otherWorkHours: 0.5, breakMinutes: 0, startOdometer: 87787, distanceKm: 89, startLocIdx: 7, endLocIdx: 0 },
];

function buildDailyLog(shift: SampleShift, userId: string) {
  const now = new Date();
  const shiftDate = new Date(now);
  shiftDate.setDate(now.getDate() - shift.daysAgo);
  shiftDate.setHours(shift.startHour, 0, 0, 0);

  const startTime = new Date(shiftDate);
  const drivingMs = shift.drivingHours * 3600 * 1000;
  const otherWorkMs = shift.otherWorkHours * 3600 * 1000;
  const breakMs = shift.breakMinutes * 60 * 1000;

  const driving1Pct = 0.55;
  const driving1Ms = drivingMs * driving1Pct;
  const driving2Ms = drivingMs * (1 - driving1Pct);

  const startLoc = LOCATIONS[shift.startLocIdx];
  const endLoc = LOCATIONS[shift.endLocIdx];
  const midLoc = LOCATIONS[(shift.startLocIdx + shift.endLocIdx) % LOCATIONS.length];

  const events: any[] = [
    { type: "shift_start", timestamp: startTime.toISOString(), location: startLoc, odometer: shift.startOdometer },
  ];

  let cursor = startTime.getTime() + driving1Ms;

  if (shift.otherWorkHours > 0) {
    events.push({ type: "other_work_start", timestamp: new Date(cursor).toISOString(), location: midLoc });
    cursor += otherWorkMs;
    events.push({ type: "other_work_end", timestamp: new Date(cursor).toISOString(), location: midLoc });
  }

  if (shift.breakMinutes > 0) {
    events.push({ type: "break_start", timestamp: new Date(cursor).toISOString(), location: midLoc });
    cursor += breakMs;
    events.push({ type: "break_end", timestamp: new Date(cursor).toISOString(), location: midLoc });
  }

  cursor += driving2Ms;
  const endTime = new Date(cursor);

  events.push({
    type: "shift_end", timestamp: endTime.toISOString(), location: endLoc, odometer: shift.startOdometer + shift.distanceKm,
  });

  const breaks = shift.breakMinutes > 0
    ? [{
        startTime: new Date(startTime.getTime() + driving1Ms + otherWorkMs).toISOString(),
        endTime: new Date(startTime.getTime() + driving1Ms + otherWorkMs + breakMs).toISOString(),
        durationSeconds: shift.breakMinutes * 60,
      }]
    : [];

  const totalDrivingSeconds = Math.round(shift.drivingHours * 3600);
  const totalWorkSeconds = Math.round((shift.drivingHours + shift.otherWorkHours) * 3600 + shift.breakMinutes * 60);
  const dateStr = startTime.toISOString().split("T")[0];

  return {
    id: `${userId}_${startTime.toISOString()}`,
    userId,
    date: dateStr,
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    totalDrivingSeconds,
    totalWorkSeconds,
    breaks,
    events,
    startLocation: startLoc,
    endLocation: endLoc,
    startOdometer: shift.startOdometer,
    endOdometer: shift.startOdometer + shift.distanceKm,
    distanceKm: shift.distanceKm,
  };
}

function canonicalizeLog(log: any): string {
  return JSON.stringify({
    id: log.id,
    userId: log.userId,
    date: log.date,
    startTime: log.startTime,
    endTime: log.endTime,
    totalDrivingSeconds: log.totalDrivingSeconds,
    totalWorkSeconds: log.totalWorkSeconds,
    breaks: log.breaks.map((b: any) => ({
      startTime: b.startTime,
      endTime: b.endTime,
      durationSeconds: b.durationSeconds,
    })),
    events: log.events.map((e: any) => ({
      type: e.type,
      timestamp: e.timestamp,
    })),
  });
}

async function sha256(message: string): Promise<string> {
  const { createHash } = await import("crypto");
  return createHash("sha256").update(message).digest("hex");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set. Cannot seed cloud database.");
    process.exit(1);
  }

  const db = drizzle(dbUrl);
  console.log("Connected to database.");

  // 1. Upsert demo driver with NZTA test credentials
  const trialStart = new Date();
  trialStart.setDate(trialStart.getDate() - 30);

  try {
    await db.insert(drivers).values({
      localUserId: DEMO_USER_ID,
      email: DEMO_EMAIL,
      passwordHash: DEMO_PASSWORD_HASH,
      name: "NZTA",
      licenceNumber: "ZY987654",
      vehicleRegistration: "DEMO01",
      vehicleType: "Van",
      driverType: "passenger",
      trialStartDate: trialStart.toISOString(),
    }).onDuplicateKeyUpdate({
      set: {
        name: "NZTA",
        passwordHash: DEMO_PASSWORD_HASH,
        licenceNumber: "ZY987654",
        vehicleRegistration: "DEMO01",
        vehicleType: "Van",
        driverType: "passenger",
      },
    });
    console.log("✅ Demo driver upserted (Username: NZTA, Licence: ZY987654).");
  } catch (e: any) {
    console.log("Driver upsert result:", e.message);
  }

  // 2. Build and insert TWO full CWPs with hash chain
  const allShifts = [...CWP1_SHIFTS, ...CWP2_SHIFTS];
  const logs = allShifts.map((s) => buildDailyLog(s, DEMO_USER_ID));
  let previousHash = "";
  let inserted = 0;

  for (const log of logs) {
    const canonical = canonicalizeLog(log);
    const payload = `${previousHash}|${canonical}`;
    const hash = await sha256(payload);
    const hashTimestamp = new Date().toISOString();

    try {
      await db.insert(shiftLogs).values({
        logId: log.id,
        driverLocalUserId: DEMO_USER_ID,
        date: log.date,
        logData: log,
        canonicalJson: canonical,
        hash,
        previousHash,
        hashTimestamp,
        startTime: log.startTime,
        endTime: log.endTime,
      }).onDuplicateKeyUpdate({
        set: {
          logData: log,
          canonicalJson: canonical,
          hash,
          previousHash,
          hashTimestamp,
        },
      });
      inserted++;
    } catch (e: any) {
      console.log(`  Shift ${log.id}: ${e.message}`);
    }

    previousHash = hash;
  }

  console.log(`✅ ${inserted} shift logs seeded with hash chain (2 full CWPs).`);
  console.log("\nDemo account ready:");
  console.log(`  Username: NZTA`);
  console.log(`  Email: ${DEMO_EMAIL}`);
  console.log(`  Password: NZTAReview2026!`);
  console.log(`  Licence: ZY987654`);
  console.log(`  Driver Type: Passenger Service (7hr limit)`);
  console.log(`  CWP 1: 13 shifts (~68h driving, days 28-15 ago)`);
  console.log(`  CWP 2: 12 shifts (~52h driving, days 13-1 ago)`);

  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
