import { NextRequest, NextResponse } from "next/server";
import { CsvExporter, ExportFilterOptions } from "@/server/exports/csv-exporter";

export async function POST(req: NextRequest) {
  try {
    const body: ExportFilterOptions = await req.json().catch(() => ({}));
    const exportResult = await CsvExporter.export(body);

    return NextResponse.json({
      success: true,
      data: {
        filename: exportResult.filename,
        downloadUrl: `/api/exports/${exportResult.filename}`,
        recordCount: exportResult.recordCount,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "EXPORT_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
