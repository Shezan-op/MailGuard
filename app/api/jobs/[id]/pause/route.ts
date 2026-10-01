import { NextRequest, NextResponse } from "next/server";
import { PgQueue } from "@/server/queue/pg-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await PgQueue.setJobStatus(id, "paused");
    return NextResponse.json({ success: true, data: { status: "paused" } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
