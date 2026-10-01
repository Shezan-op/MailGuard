import { getDb } from "../server/db";
import { sql } from "drizzle-orm";
import { PgQueue } from "../server/queue/pg-queue";

interface ConsistencyIssue {
  category: string;
  description: string;
  severity: "INFO" | "WARN" | "ERROR";
  count: number;
  sampleIds?: string[];
}

export async function runSystemVerify(autoFix = false): Promise<{
  passed: boolean;
  totalIssues: number;
  issues: ConsistencyIssue[];
}> {
  console.log("==================================================================");
  console.log("MAILGUARD INTERNAL DATA INTEGRITY & SYSTEM CONSISTENCY CHECK");
  console.log("==================================================================\n");

  const db = getDb();
  const issues: ConsistencyIssue[] = [];

  // 1. Orphaned Verification Runs (Referencing non-existent jobs)
  const orphanRunsRes = await db.execute(sql`
    SELECT r.id, r.job_id
    FROM verification_runs r
    LEFT JOIN verification_jobs j ON r.job_id = j.id
    WHERE r.job_id IS NOT NULL AND j.id IS NULL
    LIMIT 10;
  `);
  const orphanRuns = (orphanRunsRes as any).rows || [];
  if (orphanRuns.length > 0) {
    issues.push({
      category: "ORPHANED_RUNS",
      description: "Verification runs referencing deleted or non-existent job IDs",
      severity: "WARN",
      count: orphanRuns.length,
      sampleIds: orphanRuns.map((r: any) => r.id),
    });
  }

  // 2. Orphaned Emails (No verification runs)
  const orphanEmailsRes = await db.execute(sql`
    SELECT e.id, e.normalized_email
    FROM emails e
    LEFT JOIN verification_runs r ON e.normalized_email = r.email_id
    WHERE r.id IS NULL
    LIMIT 10;
  `);
  const orphanEmails = (orphanEmailsRes as any).rows || [];
  if (orphanEmails.length > 0) {
    issues.push({
      category: "ORPHANED_EMAILS",
      description: "Email records created without any associated verification run",
      severity: "INFO",
      count: orphanEmails.length,
      sampleIds: orphanEmails.map((e: any) => e.normalized_email),
    });
  }

  // 3. Job Counter Drift Detection
  const jobsRes = await db.execute(sql`SELECT id, name, status FROM verification_jobs;`);
  const jobs = (jobsRes as any).rows || [];
  let driftedJobCount = 0;

  for (const job of jobs) {
    const check = await PgQueue.reconcileJobCounters(job.id);
    if (check.driftDetected) {
      driftedJobCount++;
    }
  }

  if (driftedJobCount > 0) {
    issues.push({
      category: "COUNTER_DRIFT",
      description: `Detected and reconciled counter drift across ${driftedJobCount} jobs`,
      severity: "WARN",
      count: driftedJobCount,
    });
  }

  // 4. Stale Jobs (Running with no activity for > 2 hours)
  const staleJobsRes = await db.execute(sql`
    SELECT id, name, updated_at
    FROM verification_jobs
    WHERE status = 'running'
      AND updated_at < (CURRENT_TIMESTAMP - INTERVAL '2 hours')
    LIMIT 10;
  `);
  const staleJobs = (staleJobsRes as any).rows || [];
  if (staleJobs.length > 0) {
    issues.push({
      category: "STALE_JOBS",
      description: "Jobs stuck in 'running' state with no activity in over 2 hours",
      severity: "ERROR",
      count: staleJobs.length,
      sampleIds: staleJobs.map((j: any) => j.id),
    });
  }

  // 5. Invalid Email Statuses
  const validStatuses = [
    "DELIVERABLE",
    "UNDELIVERABLE",
    "RISKY",
    "CATCH_ALL",
    "DISPOSABLE",
    "ROLE_BASED",
    "TEMPORARY",
    "UNKNOWN",
  ];
  const invalidStatusRes = await db.execute(sql`
    SELECT id, normalized_email, final_status
    FROM emails
    WHERE final_status NOT IN (${sql.join(validStatuses.map((s) => sql`${s}`), sql`, `)})
    LIMIT 10;
  `);
  const invalidStatuses = (invalidStatusRes as any).rows || [];
  if (invalidStatuses.length > 0) {
    issues.push({
      category: "INVALID_STATUS",
      description: "Email records found with unrecognized final_status enum value",
      severity: "ERROR",
      count: invalidStatuses.length,
      sampleIds: invalidStatuses.map((i: any) => `${i.normalized_email} (${i.final_status})`),
    });
  }

  // 6. Missing Core System Settings
  const settingsRes = await db.execute(sql`SELECT key FROM settings;`);
  const existingSettings = ((settingsRes as any).rows || []).map((r: any) => r.key.toLowerCase());
  const requiredSettings = [
    "smtp_timeout_ms",
    "max_global_concurrency",
    "max_domain_concurrency",
    "helo_domain",
    "verification_from_address",
  ];
  const missingSettings = requiredSettings.filter((k) => !existingSettings.includes(k));
  if (missingSettings.length > 0) {
    issues.push({
      category: "MISSING_SETTINGS",
      description: "Core settings missing from the database settings table",
      severity: "WARN",
      count: missingSettings.length,
      sampleIds: missingSettings,
    });
  }

  // Print Summary
  if (issues.length === 0) {
    console.log("✓ All data integrity checks PASSED. Zero orphan records, counter drift, or invalid states.\n");
  } else {
    for (const issue of issues) {
      console.log(`[${issue.severity}] ${issue.category}: ${issue.description} (Count: ${issue.count})`);
      if (issue.sampleIds && issue.sampleIds.length > 0) {
        console.log(`  Sample IDs: ${issue.sampleIds.slice(0, 3).join(", ")}`);
      }
    }
    console.log("");
  }

  const errorsCount = issues.filter((i) => i.severity === "ERROR").length;
  const passed = errorsCount === 0;

  console.log("Integrity Check Result:");
  console.log(passed ? "CONSISTENT (PASS)" : "CORRUPTED (FAIL)");
  console.log("==================================================================");

  return {
    passed,
    totalIssues: issues.length,
    issues,
  };
}

// Allow direct execution
if (process.argv[1]?.endsWith("system-verify.ts")) {
  const autoFix = process.argv.includes("--fix");
  runSystemVerify(autoFix)
    .then((res) => {
      process.exit(res.passed ? 0 : 1);
    })
    .catch((err) => {
      console.error("[SystemVerify] Fatal error:", err);
      process.exit(1);
    });
}
