import { getDb, schema } from "../server/db";
import { eq, sql } from "drizzle-orm";
import { VerificationOrchestrator } from "../server/verification/orchestrator";
import { PgQueue } from "../server/queue/pg-queue";
import { FileParser } from "../server/imports/file-parser";
import crypto from "crypto";

async function runBulkSmokeTest() {
  console.log("=== MAILGUARD 100-EMAIL BULK PERFORMANCE & COUNTER RECONCILIATION AUDIT ===");
  const startTime = Date.now();
  const initialMem = process.memoryUsage();

  // 1. Generate 100 controlled test emails
  const rawList: string[] = [];

  // 10 invalid syntax
  for (let i = 1; i <= 10; i++) {
    rawList.push(`invalid-syntax-${i}`);
  }

  // 10 disposable domains
  for (let i = 1; i <= 10; i++) {
    rawList.push(`user${i}@mailinator.com`);
  }

  // 10 role accounts
  const roles = ["admin", "billing", "support", "sales", "info", "security", "jobs", "press", "legal", "abuse"];
  for (const role of roles) {
    rawList.push(`${role}@acmecorp.example`);
  }

  // 10 provider typos
  for (let i = 1; i <= 10; i++) {
    rawList.push(`testuser${i}@gmial.com`);
  }

  // 20 valid synthetic addresses
  for (let i = 1; i <= 20; i++) {
    rawList.push(`subscriber${i}@enterprise-leads.example`);
  }

  // 20 duplicates (repeat previous subscriber addresses)
  for (let i = 1; i <= 20; i++) {
    rawList.push(`subscriber${i}@enterprise-leads.example`);
  }

  // 20 distinct non-existent test domain addresses
  for (let i = 1; i <= 20; i++) {
    rawList.push(`probe${i}@nonexistent-subdomain-${i}.localtest`);
  }

  console.log(`[Input] Generated ${rawList.length} raw email rows (includes 20 duplicates)`);

  // 2. Parse using project's FileParser
  const parseResult = FileParser.parsePastedText(rawList.join("\n"));
  console.log(`[Parser Result] Total Processed: ${parseResult.totalRows}, Unique: ${parseResult.uniqueEmails}, Duplicates Removed: ${parseResult.duplicateCount}`);

  expectCondition(parseResult.totalRows === 100, `Expected 100 rows, got ${parseResult.totalRows}`);
  expectCondition(parseResult.uniqueEmails === 80, `Expected 80 unique emails, got ${parseResult.uniqueEmails}`);
  expectCondition(parseResult.duplicateCount === 20, `Expected 20 duplicates removed, got ${parseResult.duplicateCount}`);

  // 3. Create Bulk Job via PgQueue
  const jobId = await PgQueue.createJob({
    name: "Forensic Performance Audit Batch 100",
    sourceType: "paste",
    totalCount: parseResult.uniqueEmails,
  });

  console.log(`[Job Created] Job ID: ${jobId}`);

  const db = getDb();

  // Pre-insert verification run placeholders
  for (const entry of parseResult.entries) {
    await db
      .insert(schema.emails)
      .values({
        id: crypto.randomUUID(),
        normalizedEmail: entry.normalizedEmail,
        originalEmail: entry.originalEmail,
        localPart: entry.localPart,
        domain: entry.domain,
        normalizedDomain: entry.domain,
        syntaxStatus: entry.isValidSyntax ? "PASS" : "FAIL",
        syntaxReason: entry.syntaxReason,
        finalStatus: entry.isValidSyntax ? "UNKNOWN" : "UNDELIVERABLE",
        riskScore: entry.isValidSyntax ? 50 : 100,
        confidence: "LOW",
      })
      .onConflictDoNothing();

    await db
      .insert(schema.verificationRuns)
      .values({
        id: crypto.randomUUID(),
        emailId: entry.normalizedEmail,
        jobId,
        finalStatus: "PENDING",
        riskScore: 50,
        confidence: "LOW",
        engineVersion: "1.0.0",
      });
  }

  await PgQueue.setJobStatus(jobId, "running");

  // 4. Run verification engine across all entries
  console.log("[Verification Engine] Processing batch through VerificationOrchestrator pipeline...");
  let processedCount = 0;

  for (const entry of parseResult.entries) {
    const result = await VerificationOrchestrator.verify(entry.normalizedEmail, {
      jobId,
      persist: true,
    });
    await PgQueue.recordJobProgress(jobId, result.finalStatus);
    processedCount++;
  }

  await PgQueue.setJobStatus(jobId, "completed");

  const durationMs = Date.now() - startTime;
  const finalMem = process.memoryUsage();
  const throughput = ((processedCount / (durationMs / 1000))).toFixed(1);

  console.log(`[Execution Summary] Processed ${processedCount} emails in ${(durationMs / 1000).toFixed(2)}s (${throughput} emails/sec)`);
  console.log(`[Memory Telemetry] Heap Used: ${(initialMem.heapUsed / 1024 / 1024).toFixed(2)} MB -> ${(finalMem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // 5. Forensically verify Database Counter Reconciliation (Section 53)
  const [jobRecord] = await db
    .select()
    .from(schema.verificationJobs)
    .where(eq(schema.verificationJobs.id, jobId));

  console.log("\n--- DATABASE COUNTER RECONCILIATION ---");
  console.log(`Job Total Count:      ${jobRecord.totalCount}`);
  console.log(`Job Processed Count:  ${jobRecord.processedCount}`);
  console.log(`Job Deliverable:      ${jobRecord.deliverableCount}`);
  console.log(`Job Undeliverable:    ${jobRecord.undeliverableCount}`);
  console.log(`Job Risky:            ${jobRecord.riskyCount}`);
  console.log(`Job Unknown:          ${jobRecord.unknownCount}`);

  // Query actual emails in database for this job
  const runRecords = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.verificationRuns)
    .where(eq(schema.verificationRuns.jobId, jobId));
  const actualRunRows = Number(runRecords[0].count);

  console.log(`Actual verification_runs rows in DB: ${actualRunRows}`);
  expectCondition(jobRecord.totalCount === 80, `Job totalCount must be 80, got ${jobRecord.totalCount}`);
  expectCondition(jobRecord.processedCount === 80, `Job processedCount must be 80, got ${jobRecord.processedCount}`);
  expectCondition(jobRecord.processedCount === actualRunRows, `Job processedCount (${jobRecord.processedCount}) does not match DB runs (${actualRunRows})`);
  expectCondition(jobRecord.status === "completed", `Job status must be completed, got ${jobRecord.status}`);

  console.log("\n[VERDICT] Counter reconciliation, deduplication, and bulk pipeline: 100% PASS");
}

function expectCondition(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`FATAL PROOF FAILURE: ${msg}`);
    process.exit(1);
  }
}

runBulkSmokeTest()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Bulk smoke test failed:", err);
    process.exit(1);
  });
