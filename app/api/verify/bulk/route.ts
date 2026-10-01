import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { FileParser, FileParseResult } from "@/server/imports/file-parser";
import { PgQueue } from "@/server/queue/pg-queue";
import { getDb } from "@/server/db";
import { emails, verificationRuns } from "@/server/db/schema";

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB limit
const MAX_DATASET_ROWS = 250000; // 250,000 row safety limit

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    let parseResult: FileParseResult;
    let jobName = "Bulk Verification Job";
    let originalFilename: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const customName = formData.get("name") as string | null;
      const targetColumn = formData.get("targetColumn") as string | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "No file provided" } },
          { status: 400 }
        );
      }

      // Enforce file size limit before buffering into memory
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { success: false, error: { code: "FILE_TOO_LARGE", message: "File size exceeds 50MB limit" } },
          { status: 413 }
        );
      }

      originalFilename = file.name;
      jobName = customName || file.name.replace(/\.[^/.]+$/, "");

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      // Save upload to storage/uploads
      const uploadsDir = path.join(process.cwd(), "storage", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const safeFilename = `${Date.now()}_${path.basename(file.name).replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const savedPath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(savedPath, buffer);

      const ext = path.extname(file.name).toLowerCase();
      if (ext === ".csv") {
        parseResult = FileParser.parseCsv(buffer, file.name, targetColumn || undefined);
      } else if (ext === ".xlsx" || ext === ".xls") {
        parseResult = FileParser.parseXlsx(buffer, file.name, targetColumn || undefined);
      } else {
        parseResult = FileParser.parseTxt(buffer, file.name);
      }
    } else {
      // JSON body (e.g. manual paste)
      const body = await req.json();
      const { pasteText, name } = body;

      if (!pasteText || typeof pasteText !== "string") {
        return NextResponse.json(
          { success: false, error: { code: "VALIDATION_ERROR", message: "Pasted text is required" } },
          { status: 400 }
        );
      }

      // Guard pasted text payload size (max 5MB)
      if (pasteText.length > 5 * 1024 * 1024) {
        return NextResponse.json(
          { success: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Pasted text exceeds 5MB limit" } },
          { status: 413 }
        );
      }

      jobName = name || `Manual Paste (${new Date().toLocaleDateString()})`;
      parseResult = FileParser.parsePastedText(pasteText);
    }

    // Row count ceiling
    if (parseResult.totalRows > MAX_DATASET_ROWS) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "DATASET_TOO_LARGE",
            message: `Dataset contains ${parseResult.totalRows} rows, which exceeds the limit of ${MAX_DATASET_ROWS} rows`,
          },
        },
        { status: 400 }
      );
    }

    if (parseResult.uniqueEmails === 0) {
      return NextResponse.json(
        { success: false, error: { code: "EMPTY_DATASET", message: "No valid email addresses found in input" } },
        { status: 400 }
      );
    }

    // Create Job in Database
    const jobId = await PgQueue.createJob({
      name: jobName,
      sourceType: parseResult.sourceType,
      sourceFilename: originalFilename,
      totalCount: parseResult.uniqueEmails,
    });

    const db = getDb();

    // Pre-insert email placeholders and verification runs for tracking
    for (const entry of parseResult.entries) {
      const emailId = crypto.randomUUID();

      // Upsert email
      await db
        .insert(emails)
        .values({
          id: emailId,
          normalizedEmail: entry.normalizedEmail,
          originalEmail: entry.originalEmail,
          localPart: entry.localPart,
          domain: entry.domain,
          normalizedDomain: entry.domain,
          syntaxStatus: entry.isValidSyntax ? "PASS" : "FAIL",
          syntaxReason: entry.syntaxReason,
          finalStatus: entry.isValidSyntax ? "UNKNOWN" : "UNDELIVERABLE",
          riskScore: entry.isValidSyntax ? 50 : 100,
          confidence: "LOW",
        })
        .onConflictDoNothing();

      // Queue run placeholder
      await db
        .insert(verificationRuns)
        .values({
          id: crypto.randomUUID(),
          emailId: entry.normalizedEmail,
          jobId,
          finalStatus: "PENDING",
          riskScore: 50,
          confidence: "LOW",
          engineVersion: "1.0.0",
        });
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId,
        name: jobName,
        totalRows: parseResult.totalRows,
        uniqueEmails: parseResult.uniqueEmails,
        duplicateCount: parseResult.duplicateCount,
        syntaxInvalidCount: parseResult.syntaxInvalidCount,
        domainCount: parseResult.domainCount,
        detectedEmailColumn: parseResult.detectedEmailColumn,
        availableColumns: parseResult.availableColumns,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "BULK_ERROR", message: err.message || "Bulk processing failed" } },
      { status: 500 }
    );
  }
}
