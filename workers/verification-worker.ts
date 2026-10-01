import { getDb } from "../server/db";
import { verificationJobs, emails, verificationRuns } from "../server/db/schema";
import { VerificationOrchestrator } from "../server/verification/orchestrator";
import { PgQueue } from "../server/queue/pg-queue";
import { DomainRateLimiter } from "../server/queue/domain-rate-limiter";
import { eq, and, sql } from "drizzle-orm";

let isRunning = true;

process.on("SIGINT", () => {
  console.log("[VerificationWorker] Received SIGINT. Shutting down gracefully...");
  isRunning = false;
});

process.on("SIGTERM", () => {
  console.log("[VerificationWorker] Received SIGTERM. Shutting down gracefully...");
  isRunning = false;
});

export async function startWorker(): Promise<void> {
  console.log("[VerificationWorker] Starting MailGuard verification worker daemon...");
  const db = getDb();

  while (isRunning) {
    try {
      // 1. Look for active jobs (queued or running)
      const activeJobs = await db
        .select()
        .from(verificationJobs)
        .where(sql`status IN ('queued', 'running') AND pending_count > 0`)
        .orderBy(verificationJobs.createdAt)
        .limit(1);

      if (activeJobs.length === 0) {
        // Idle wait
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      const job = activeJobs[0];

      if (job.status === "queued") {
        await PgQueue.setJobStatus(job.id, "running");
      }

      // Check if job has been paused or cancelled
      const freshJob = await PgQueue.getJob(job.id);
      if (!freshJob || freshJob.status === "paused" || freshJob.status === "cancelled") {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }

      // Find unverified or pending emails for this job
      // Verification runs record the run for a job. Emails not yet verified in this job:
      const pendingRecords = await db.execute(sql`
        SELECT e.id, e.normalized_email, e.domain
        FROM emails e
        WHERE e.id IN (
          SELECT r.email_id FROM verification_runs r WHERE r.job_id = ${job.id} AND r.final_status = 'PENDING'
        )
        OR (
          -- If batch was pre-inserted with initial job marker
          EXISTS (SELECT 1 FROM verification_runs vr WHERE vr.job_id = ${job.id} AND vr.email_id = e.normalized_email AND vr.final_status = 'PENDING')
        )
        LIMIT 10;
      `);

      // Fallback: If pendingRecords empty, check if pending_count is 0 or complete
      if (!pendingRecords.rows || pendingRecords.rows.length === 0) {
        // Double check if any pending items remain
        if (job.pendingCount > 0) {
          // Adjust pending count to 0 if all done
          await db
            .update(verificationJobs)
            .set({ pendingCount: 0, status: "completed", completedAt: new Date() })
            .where(eq(verificationJobs.id, job.id));
        }
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      for (const row of pendingRecords.rows as any[]) {
        if (!isRunning) break;

        // Verify if job was cancelled in the middle
        const statusCheck = await PgQueue.getJob(job.id);
        if (statusCheck?.status === "cancelled" || statusCheck?.status === "paused") {
          break;
        }

        const email = row.normalized_email;
        const domain = row.domain || email.split("@")[1] || "unknown.com";

        // Acquire slot with domain rate limiting
        const acquired = await DomainRateLimiter.acquireSlot(domain, {
          maxGlobalConcurrency: 10,
          maxDomainConcurrency: 2,
          maxWaitMs: 10000,
        });

        if (!acquired) {
          continue;
        }

        try {
          const result = await VerificationOrchestrator.verify(email, {
            jobId: job.id,
            persist: true,
          });

          await PgQueue.recordJobProgress(job.id, result.finalStatus);
        } catch (err) {
          console.error(`[VerificationWorker] Error verifying ${email}:`, err);
          await PgQueue.recordJobProgress(job.id, "UNKNOWN");
        } finally {
          DomainRateLimiter.releaseSlot(domain);
        }
      }
    } catch (loopError) {
      console.error("[VerificationWorker] Unexpected loop error:", loopError);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log("[VerificationWorker] Worker daemon exited.");
}

// Allow direct execution
if (process.argv[1]?.endsWith("verification-worker.ts")) {
  startWorker().catch((err) => {
    console.error("[VerificationWorker] Fatal error:", err);
    process.exit(1);
  });
}
