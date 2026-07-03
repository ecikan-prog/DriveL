/**
 * Seed / fix the operator portal test account.
 * Run: npx tsx scripts/seed-operator-fix.ts
 */
import "./load-env.js";
import { createOperator, getOperatorByEmail } from "../server/db";

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
  const email = "operator@drivelegal.app";
  const password = "DriveLegal2026";
  const passwordHash = simpleHash(password);

  console.log(`Seeding operator: ${email}`);
  console.log(`Password hash: ${passwordHash}`);

  await createOperator({
    email,
    passwordHash,
    companyName: "NZTA Test Operator",
    contactName: "NZTA Reviewer",
  });

  const check = await getOperatorByEmail(email);
  if (check) {
    console.log("✅ Operator account verified in DB:");
    console.log(`  ID: ${check.id}`);
    console.log(`  Email: ${check.email}`);
    console.log(`  Company: ${check.companyName}`);
    console.log(`  Hash matches: ${check.passwordHash === passwordHash}`);
  } else {
    console.error("❌ Operator account NOT found after insert!");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
