import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { PgQueue, JobStatus } from "@/server/queue/pg-queue";
import { getDb } from "@/server/db";
import { verificationJobs, verificationRuns } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

describe("Queue State Machine & Concurrency Hardening", () => {
  it("FSM: Enforces valid state transition lifecycle (queued -> running -> completed)", async () => {
    const jobId = await PgQueue.createJob({
      name: "Lifecycle Test Job",
      sourceType: "paste",
      totalCount: 5,
    });

    let job = await PgQueue.getJob(jobId);
    expect(job?.status).toBe("queued");

    // Transition: queued -> running
    await PgQueue.setJobStatus(jobId, "running");
    job = await PgQueue.getJob(jobId);
    expect(job?.status).toBe("running");

    // Transition: running -> completed
    await PgQueue.setJobStatus(jobId, "completed");
    job = await PgQueue.getJob(jobId);
    expect(job?.status).toBe("completed");
  });

  it("FSM: Rejects illegal state transitions (completed -> running, cancelled -> running)", async () => {
    const jobId = await PgQueue.createJob({
      name: "Illegal Transition Test",
      sourceType: "paste",
      totalCount: 3,
    });

    await PgQueue.setJobStatus(jobId, "running");
    await PgQueue.setJobStatus(jobId, "completed");

    // Attempt illegal transition: completed -> running
    await expect(PgQueue.setJobStatus(jobId, "running")).rejects.toThrow(/Illegal job status transition/);

    // Create cancelled job
    const cancelJobId = await PgQueue.createJob({
      name: "Cancel FSM Test",
      sourceType: "paste",
      totalCount: 3,
    });
    await PgQueue.setJobStatus(cancelJobId, "cancelled");

    // Attempt illegal transition: cancelled -> running
    await expect(PgQueue.setJobStatus(cancelJobId, "running")).rejects.toThrow(/Illegal job status transition/);
  });

  it("CANCELLATION: Cleans up pending runs and zeroes pendingCount atomically", async () => {
    const db = getDb();
    const jobId = await PgQueue.createJob({
      name: "Cancellation Cleanup Test",
      sourceType: "paste",
      totalCount: 3,
    });

    // Insert 3 pending verification runs
    for (let i = 0; i < 3; i++) {
      await db.insert(verificationRuns).values({
        id: crypto.randomUUID(),
        emailId: `cancel-test-${i}@example.org`,
        jobId,
        finalStatus: "PENDING",
        riskScore: 50,
        confidence: "LOW",
        engineVersion: "1.0.0",
      });
    }

    // Cancel job
    await PgQueue.setJobStatus(jobId, "cancelled");

    const updatedJob = await PgQueue.getJob(jobId);
    expect(updatedJob?.status).toBe("cancelled");
    expect(updatedJob?.pendingCount).toBe(0);

    // Check that pending runs were updated to CANCELLED
    const runs = await db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.jobId, jobId));

    expect(runs).toHaveLength(3);
    for (const r of runs) {
      expect(r.finalStatus).toBe("CANCELLED");
      expect(r.reason).toContain("cancelled by operator");
    }
  });

  it("RECONCILIATION: Reconciles drifted job counters against ground-truth runs", async () => {
    const db = getDb();
    const jobId = await PgQueue.createJob({
      name: "Drift Reconciliation Test",
      sourceType: "paste",
      totalCount: 2,
    });

    // Insert completed runs
    await db.insert(verificationRuns).values({
      id: crypto.randomUUID(),
      emailId: `reconcile-1@example.org`,
      jobId,
      finalStatus: "DELIVERABLE",
      riskScore: 10,
      confidence: "HIGH",
      engineVersion: "1.0.0",
    });

    await db.insert(verificationRuns).values({
      id: crypto.randomUUID(),
      emailId: `reconcile-2@example.org`,
      jobId,
      finalStatus: "UNDELIVERABLE",
      riskScore: 90,
      confidence: "HIGH",
      engineVersion: "1.0.0",
    });

    // Intentionally inject corrupted job counters
    await db
      .update(verificationJobs)
      .set({
        processedCount: 99,
        deliverableCount: 0,
        undeliverableCount: 0,
      })
      .where(eq(verificationJobs.id, jobId));

    // Execute reconciliation
    const result = await PgQueue.reconcileJobCounters(jobId);

    expect(result.driftDetected).toBe(true);
    expect(result.reconciledCounts.processed).toBe(2);
    expect(result.reconciledCounts.deliverable).toBe(1);
    expect(result.reconciledCounts.undeliverable).toBe(1);

    const reconciledJob = await PgQueue.getJob(jobId);
    expect(reconciledJob?.processedCount).toBe(2);
    expect(reconciledJob?.deliverableCount).toBe(1);
    expect(reconciledJob?.undeliverableCount).toBe(1);
  });
});
