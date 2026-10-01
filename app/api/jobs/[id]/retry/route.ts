import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { verificationJobs, verificationRuns } from "@/server/db/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { PgQueue } from "@/server/queue/pg-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const filter = body.filter || "temporary"; // 'temporary', 'failed', 'all'

    const db = getDb();
    let statusesToReset: string[] = [];

    if (filter === "temporary") {
      statusesToReset = ["TEMPORARY"];
    } else if (filter === "failed") {
      statusesToReset = ["UNKNOWN", "TEMPORARY"];
    } else {
      statusesToReset = ["UNKNOWN", "TEMPORARY", "UNDELIVERABLE", "RISKY"];
    }

    // Reset matching verification runs to PENDING
    const result = await db.execute(sql`
      UPDATE verification_runs
      SET final_status = 'PENDING'
      WHERE job_id = ${id} AND final_status IN (${sql.join(statusesToReset.map(s => sql`${s}`), sql`, `)})
      RETURNING id;
    `);

    const resetCount = result.rows ? result.rows.length : 0;

    if (resetCount > 0) {
      await db
        .update(verificationJobs)
        .set({
          pendingCount: sql`pending_count + ${resetCount}`,
          status: "queued",
        })
        .where(eq(verificationJobs.id, id));
    }

    return NextResponse.json({
      success: true,
      data: {
        resetCount,
        filter,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "RETRY_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
