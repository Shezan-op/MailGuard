import { NextRequest, NextResponse } from "next/server";
import { PgQueue } from "@/server/queue/pg-queue";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const jobs = await PgQueue.listJobs(limit, offset);
    return NextResponse.json({
      success: true,
      data: jobs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
