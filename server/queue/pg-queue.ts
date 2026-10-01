import crypto from "crypto";
import { getDb } from "../db";
import { verificationJobs, emails, verificationRuns } from "../db/schema";
import { eq, sql, and, inArray } from "drizzle-orm";
import { VerificationStatus } from "../verification/types";

export type JobStatus = "queued" | "running" | "paused" | "cancelling" | "cancelled" | "completed" | "failed";

export interface CreateJobInput {
  name: string;
  sourceType: "csv" | "xlsx" | "txt" | "paste";
  sourceFilename?: string;
  totalCount: number;
}

const VALID_STATE_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  queued: ["running", "cancelling", "cancelled"],
  running: ["paused", "cancelling", "cancelled", "completed", "failed"],
  paused: ["running", "cancelling", "cancelled"],
  cancelling: ["cancelled", "failed"],
  completed: [], // Terminal state
  cancelled: [], // Terminal state
  failed: ["queued"], // Can only restart failed job to queued
};

export class PgQueue {
  /**
   * Creates a new verification job in the database.
   */
  static async createJob(input: CreateJobInput): Promise<string> {
    const db = getDb();
    const jobId = crypto.randomUUID();

    await db.insert(verificationJobs).values({
      id: jobId,
      name: input.name,
      sourceType: input.sourceType,
      sourceFilename: input.sourceFilename || null,
      totalCount: input.totalCount,
      pendingCount: input.totalCount,
      processedCount: 0,
      status: "queued",
      progressPercentage: 0,
    });

    return jobId;
  }

  /**
   * Fetches active jobs that are queued or running.
   */
  static async getActiveJobs() {
    const db = getDb();
    return db
      .select()
      .from(verificationJobs)
      .where(inArray(verificationJobs.status, ["queued", "running"]));
  }

  /**
   * Updates job status enforcing strict finite state machine transitions.
   */
  static async setJobStatus(jobId: string, targetStatus: JobStatus): Promise<void> {
    const db = getDb();
    const existing = await this.getJob(jobId);

    if (!existing) {
      throw new Error(`Job ${jobId} not found`);
    }

    const currentStatus = existing.status as JobStatus;

    // Idempotent no-op
    if (currentStatus === targetStatus) {
      return;
    }

    // Validate transition
    const allowed = VALID_STATE_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new Error(`Illegal job status transition from '${currentStatus}' to '${targetStatus}' for job ${jobId}`);
    }

    const updates: Record<string, any> = {
      status: targetStatus,
      updatedAt: new Date(),
    };

    if (targetStatus === "running") {
      updates.startedAt = sql`COALESCE(${verificationJobs.startedAt}, CURRENT_TIMESTAMP)`;
    } else if (targetStatus === "completed" || targetStatus === "cancelled" || targetStatus === "failed") {
      updates.completedAt = new Date();
    }

    if (targetStatus === "cancelled") {
      // Safely terminate any remaining pending runs
      await db.execute(sql`
        UPDATE verification_runs
        SET
          final_status = 'CANCELLED',
          reason = 'Verification cancelled by operator',
          completed_at = CURRENT_TIMESTAMP
        WHERE job_id = ${jobId} AND final_status = 'PENDING';
      `);

      updates.pendingCount = 0;
    }

    await db.update(verificationJobs).set(updates).where(eq(verificationJobs.id, jobId));
  }

  /**
   * Atomically records a verified email outcome and updates the job's progress counters.
   */
  static async recordJobProgress(jobId: string, status: VerificationStatus): Promise<void> {
    const db = getDb();

    let deliverableInc = status === "DELIVERABLE" ? 1 : 0;
    let undeliverableInc = status === "UNDELIVERABLE" ? 1 : 0;
    let riskyInc = status === "RISKY" ? 1 : 0;
    let catchAllInc = status === "CATCH_ALL" ? 1 : 0;
    let disposableInc = status === "DISPOSABLE" ? 1 : 0;
    let roleBasedInc = status === "ROLE_BASED" ? 1 : 0;
    let temporaryInc = status === "TEMPORARY" ? 1 : 0;
    let unknownInc = status === "UNKNOWN" ? 1 : 0;

    await db.execute(sql`
      UPDATE verification_jobs
      SET
        processed_count = processed_count + 1,
        pending_count = GREATEST(0, pending_count - 1),
        deliverable_count = deliverable_count + ${deliverableInc},
        undeliverable_count = undeliverable_count + ${undeliverableInc},
        risky_count = risky_count + ${riskyInc},
        catch_all_count = catch_all_count + ${catchAllInc},
        disposable_count = disposable_count + ${disposableInc},
        role_based_count = role_based_count + ${roleBasedInc},
        temporary_count = temporary_count + ${temporaryInc},
        unknown_count = unknown_count + ${unknownInc},
        progress_percentage = CASE 
          WHEN total_count > 0 THEN LEAST(100, ROUND((processed_count + 1)::float * 100 / total_count::float)::int)
          ELSE 100
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${jobId};
    `);

    // Check if job has finished all pending rows
    const updated = await db.select().from(verificationJobs).where(eq(verificationJobs.id, jobId)).limit(1);
    if (updated.length > 0 && updated[0].pendingCount <= 0 && updated[0].status === "running") {
      await this.setJobStatus(jobId, "completed");
    }
  }

  /**
   * Reconciles job counters with actual database records in verification_runs.
   * Detects and fixes any drift caused by restarts, duplicate tasks, or worker interruptions.
   */
  static async reconcileJobCounters(jobId: string): Promise<{
    driftDetected: boolean;
    reconciledCounts: Record<string, number>;
  }> {
    const db = getDb();
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found for counter reconciliation`);
    }

    const countsRes = await db.execute(sql`
      SELECT
        COUNT(*)::int as total_runs,
        COUNT(CASE WHEN final_status = 'DELIVERABLE' THEN 1 END)::int as deliverable,
        COUNT(CASE WHEN final_status = 'UNDELIVERABLE' THEN 1 END)::int as undeliverable,
        COUNT(CASE WHEN final_status = 'RISKY' THEN 1 END)::int as risky,
        COUNT(CASE WHEN final_status = 'CATCH_ALL' THEN 1 END)::int as catch_all,
        COUNT(CASE WHEN final_status = 'DISPOSABLE' THEN 1 END)::int as disposable,
        COUNT(CASE WHEN final_status = 'ROLE_BASED' THEN 1 END)::int as role_based,
        COUNT(CASE WHEN final_status = 'TEMPORARY' THEN 1 END)::int as temporary,
        COUNT(CASE WHEN final_status = 'UNKNOWN' THEN 1 END)::int as unknown,
        COUNT(CASE WHEN final_status = 'PENDING' THEN 1 END)::int as pending
      FROM verification_runs
      WHERE job_id = ${jobId};
    `);

    const row = (countsRes.rows && countsRes.rows[0]) as any;
    if (!row) {
      return { driftDetected: false, reconciledCounts: {} };
    }

    const completedRuns = (row.total_runs || 0) - (row.pending || 0);
    const pendingCount = row.pending || 0;

    const driftDetected =
      job.processedCount !== completedRuns ||
      job.pendingCount !== pendingCount ||
      job.deliverableCount !== (row.deliverable || 0) ||
      job.undeliverableCount !== (row.undeliverable || 0);

    if (driftDetected) {
      const progressPercentage =
        job.totalCount > 0
          ? Math.min(100, Math.round((completedRuns / job.totalCount) * 100))
          : 100;

      await db
        .update(verificationJobs)
        .set({
          processedCount: completedRuns,
          pendingCount: pendingCount,
          deliverableCount: row.deliverable || 0,
          undeliverableCount: row.undeliverable || 0,
          riskyCount: row.risky || 0,
          catchAllCount: row.catch_all || 0,
          disposableCount: row.disposable || 0,
          roleBasedCount: row.role_based || 0,
          temporaryCount: row.temporary || 0,
          unknownCount: row.unknown || 0,
          progressPercentage,
          updatedAt: new Date(),
        })
        .where(eq(verificationJobs.id, jobId));
    }

    return {
      driftDetected,
      reconciledCounts: {
        total: job.totalCount,
        processed: completedRuns,
        pending: pendingCount,
        deliverable: row.deliverable || 0,
        undeliverable: row.undeliverable || 0,
      },
    };
  }

  /**
   * Retrieves all jobs.
   */
  static async listJobs(limit = 50, offset = 0) {
    const db = getDb();
    return db
      .select()
      .from(verificationJobs)
      .orderBy(sql`${verificationJobs.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Retrieves a single job by ID.
   */
  static async getJob(jobId: string) {
    const db = getDb();
    const rows = await db.select().from(verificationJobs).where(eq(verificationJobs.id, jobId)).limit(1);
    return rows[0] || null;
  }
}
