import { NextRequest, NextResponse } from "next/server";
import { BounceImporter, BounceImportMapping } from "@/server/imports/bounce-importer";

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let csvContent = "";
    let mapping: BounceImportMapping = {
      emailColumn: "email",
      eventTypeColumn: "event",
      campaignColumn: "campaign",
      smtpCodeColumn: "code",
      smtpResponseColumn: "response",
      dateColumn: "date",
    };

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const customMappingRaw = formData.get("mapping") as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "No file provided" } },
          { status: 400 }
        );
      }

      csvContent = await file.text();
      if (customMappingRaw) {
        try {
          mapping = JSON.parse(customMappingRaw);
        } catch {}
      }
    } else {
      const body = await req.json();
      csvContent = body.csvContent;
      if (body.mapping) {
        mapping = body.mapping;
      }
    }

    if (!csvContent) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "CSV content is empty" } },
        { status: 400 }
      );
    }

    const summary = await BounceImporter.importCsv(csvContent, mapping);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "IMPORT_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
