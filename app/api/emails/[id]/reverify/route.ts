import { NextRequest, NextResponse } from "next/server";
import { VerificationOrchestrator } from "@/server/verification/orchestrator";
import { getDb } from "@/server/db";
import { emails } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decoded = decodeURIComponent(id).toLowerCase().trim();

    const db = getDb();
    const rows = await db
      .select()
      .from(emails)
      .where(or(eq(emails.id, decoded), eq(emails.normalizedEmail, decoded)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Email record not found" } },
        { status: 404 }
      );
    }

    const email = rows[0].originalEmail;
    const result = await VerificationOrchestrator.verify(email, {
      forceReverify: true,
      persist: true,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "REVERIFY_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
