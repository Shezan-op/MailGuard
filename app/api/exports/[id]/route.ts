import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    // Sanitized filename check against path traversal
    const safeFilename = path.basename(id);
    const filePath = path.join(process.cwd(), "storage", "exports", safeFilename);

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Export file not found or expired" } },
        { status: 404 }
      );
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeFilename}"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "DOWNLOAD_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
