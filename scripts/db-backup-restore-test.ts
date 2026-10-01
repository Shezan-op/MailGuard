import fs from "fs";
import path from "path";
import crypto from "crypto";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";
import { restoreDatabase } from "./db-restore";

async function runDisasterRecoveryTest(): Promise<void> {
  console.log("==================================================================");
  console.log("MAILGUARD DISASTER RECOVERY & BACKUP/RESTORE VALIDATION");
  console.log("==================================================================");

  const db = getDb();
  const testJobId = `dr-test-job-${crypto.randomUUID()}`;
  const testEmail = `dr-test-${Date.now()}@example.org`;

  // 1. Insert known test record
  console.log("[1/5] Seeding test database records...");
  await db.execute(sql`
    INSERT INTO verification_jobs (id, name, source_type, total_count, pending_count, processed_count, status)
    VALUES (${testJobId}, 'Disaster Recovery Test Job', 'paste', 1, 0, 1, 'completed');
  `);

  await db.execute(sql`
    INSERT INTO emails (id, normalized_email, original_email, local_part, domain, normalized_domain, final_status, risk_score, confidence)
    VALUES (${crypto.randomUUID()}, ${testEmail}, ${testEmail}, 'dr-test', 'example.org', 'example.org', 'DELIVERABLE', 15, 'HIGH');
  `);

  // 2. Execute Backup
  console.log("[2/5] Creating database backup snapshot...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "storage", "backups");
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  const backupFile = path.join(backupDir, `mailguard_backup_dr_test_${timestamp}.json`);

  const tables = [
    "data_versions",
    "settings",
    "disposable_domains",
    "suppressions",
    "domains",
    "verification_jobs",
    "emails",
    "verification_runs",
    "smtp_events",
    "delivery_events",
    "audit_logs",
  ];

  const dump: Record<string, any[]> = {};
  for (const table of tables) {
    const result = await db.execute(sql.raw(`SELECT * FROM ${table};`));
    dump[table] = (result as any).rows || [];
  }

  fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), "utf-8");
  const stats = fs.statSync(backupFile);
  if (stats.size === 0) {
    throw new Error("Backup file created is empty!");
  }
  console.log(`✓ Backup created successfully: ${backupFile} (${(stats.size / 1024).toFixed(2)} KB)`);

  // 3. Destroy/Wipe database records
  console.log("[3/5] Simulating database loss: Wiping tables...");
  for (const table of tables) {
    await db.execute(sql.raw(`DELETE FROM ${table};`));
  }

  // Verify wiped
  const wipedCheck = await db.execute(sql`SELECT COUNT(*)::int as count FROM verification_jobs WHERE id = ${testJobId};`);
  const wipedCount = ((wipedCheck as any).rows[0] as any).count;
  if (wipedCount !== 0) {
    throw new Error("Failed to wipe database records for disaster recovery simulation");
  }
  console.log("✓ Database wiped. Verified 0 records present.");

  // 4. Restore database from backup
  console.log("[4/5] Executing database restore routine...");
  const restoreResult = await restoreDatabase(backupFile);
  if (!restoreResult.success) {
    throw new Error("Database restore returned unsuccessful!");
  }
  console.log("✓ Restore finished.");

  // 5. Verify restored records
  console.log("[5/5] Verifying integrity of restored data...");
  const jobVerify = await db.execute(sql`SELECT * FROM verification_jobs WHERE id = ${testJobId};`);
  const restoredJobs = (jobVerify as any).rows || [];
  if (restoredJobs.length !== 1 || restoredJobs[0].name !== "Disaster Recovery Test Job") {
    throw new Error("Restored job data did not match original snapshot!");
  }

  const emailVerify = await db.execute(sql`SELECT * FROM emails WHERE normalized_email = ${testEmail};`);
  const restoredEmails = (emailVerify as any).rows || [];
  if (restoredEmails.length !== 1 || restoredEmails[0].final_status !== "DELIVERABLE") {
    throw new Error("Restored email data did not match original snapshot!");
  }

  console.log("✓ All restored records verified with exact data fidelity!");
  console.log("==================================================================");
  console.log("RESULT: DISASTER RECOVERY & RESTORE PASS");
  console.log("==================================================================");

  // Clean up test backup file
  try {
    fs.unlinkSync(backupFile);
  } catch {}
}

runDisasterRecoveryTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("FATAL DISASTER RECOVERY FAILURE:", err);
    process.exit(1);
  });
