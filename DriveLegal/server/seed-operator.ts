/**
 * Seed script for the NZTA test operator account.
 * Run with: npx tsx scripts/seed-operator.ts
 * 
 * Creates:
 * - Test operator: operator@drivelegal.app / DriveLegal2026
 * - Links the demo driver (demo_nzta_reviewer_2026) to this operator
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import { operators, operatorDrivers } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";

// Same simple hash as local-auth.ts
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const db = drizzle(dbUrl);

  // Create test operator
  const operatorData = {
    email: "operator@drivelegal.app",
    passwordHash: simpleHash("DriveLegal2026"),
    companyName: "NZTA Test Operator Ltd",
    contactName: "NZTA Reviewer",
  };

  console.log("Creating test operator:", operatorData.email);
  console.log("Password hash for 'DriveLegal2026':", operatorData.passwordHash);

  await db.insert(operators).values(operatorData).onDuplicateKeyUpdate({
    set: { companyName: operatorData.companyName, contactName: operatorData.contactName, passwordHash: operatorData.passwordHash },
  });

  // Get the operator ID
  const [operator] = await db.select().from(operators).where(eq(operators.email, operatorData.email)).limit(1);
  if (!operator) {
    console.error("Failed to create operator");
    process.exit(1);
  }
  console.log("Operator created with ID:", operator.id);

  // Link demo driver to this operator
  const demoDriverId = "demo_nzta_reviewer_2026";
  const existing = await db.select().from(operatorDrivers)
    .where(and(eq(operatorDrivers.operatorId, operator.id), eq(operatorDrivers.driverLocalUserId, demoDriverId)))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(operatorDrivers).values({
      operatorId: operator.id,
      driverLocalUserId: demoDriverId,
    });
    console.log("Linked demo driver to operator");
  } else {
    console.log("Demo driver already linked");
  }

  console.log("\n✅ Operator portal test account ready:");
  console.log("   Email: operator@drivelegal.app");
  console.log("   Password: DriveLegal2026");
  console.log("   Portal URL: /portal/login");

  process.exit(0);
}

main().catch(console.error);
