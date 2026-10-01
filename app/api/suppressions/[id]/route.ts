import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { suppressions } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const db = getDb();

    await db.delete(suppressions).where(eq(suppressions.id, id));

    return NextResponse.json({
      success: true,
      data: { deleted: true },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "DELETE_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
