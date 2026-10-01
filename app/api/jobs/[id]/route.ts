import { NextRequest, NextResponse } from "next/server";
import { PgQueue } from "@/server/queue/pg-queue";
import { getDb } from "@/server/db";
import { verificationRuns, emails } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const job = await PgQueue.getJob(id);

    if (!job) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Job not found" } },
        { status: 404 }
      );
    }

    const db = getDb();

    // Get recent verification runs for this job
    const runs = await db
      .select({
        id: verificationRuns.id,
        email: verificationRuns.emailId,
        finalStatus: verificationRuns.finalStatus,
        riskScore: verificationRuns.riskScore,
        confidence: verificationRuns.confidence,
        reason: verificationRuns.reason,
        smtpCode: verificationRuns.smtpCode,
        smtpResponse: verificationRuns.smtpResponse,
        smtpLatencyMs: verificationRuns.smtpLatencyMs,
        createdAt: verificationRuns.createdAt,
      })
      .from(verificationRuns)
      .where(eq(verificationRuns.jobId, id))
      .orderBy(sql`${verificationRuns.createdAt} DESC`)
      .limit(50);

    return NextResponse.json({
      success: true,
      data: {
        job,
        recentRuns: runs,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
