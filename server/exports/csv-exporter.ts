import fs from "fs";
import path from "path";
import crypto from "crypto";
import Papa from "papaparse";
import { getDb } from "../db";
import { emails } from "../db/schema";
import { and, eq, inArray, lte, gte, sql } from "drizzle-orm";

export interface ExportFilterOptions {
  statuses?: string[];
  maxRiskScore?: number;
  minRiskScore?: number;
  includeCatchAll?: boolean;
  excludeDisposable?: boolean;
  cleanListOnly?: boolean;
  jobId?: string;
}

export class CsvExporter {
  /**
   * Generates a CSV file from emails matching filter options.
   */
  static async export(options: ExportFilterOptions): Promise<{ filename: string; filePath: string; recordCount: number }> {
    const db = getDb();
    const exportId = crypto.randomUUID();
    const filename = `mailguard_export_${options.cleanListOnly ? "clean_" : ""}${new Date().toISOString().replace(/[:.]/g, "-")}_${exportId.slice(0, 8)}.csv`;

    const exportsDir = path.join(process.cwd(), "storage", "exports");
    if (!fs.existsSync(exportsDir)) {
      fs.mkdirSync(exportsDir, { recursive: true });
    }

    const filePath = path.join(exportsDir, filename);

    // Build query conditions
    const conditions = [];

    if (options.cleanListOnly) {
      // Clean List Definition: DELIVERABLE only, strictly no disposable, no suppressed
      conditions.push(eq(emails.finalStatus, "DELIVERABLE"));
      conditions.push(eq(emails.disposableStatus, false));
    } else {
      if (options.statuses && options.statuses.length > 0) {
        conditions.push(inArray(emails.finalStatus, options.statuses));
      }
      if (options.maxRiskScore !== undefined) {
        conditions.push(lte(emails.riskScore, options.maxRiskScore));
      }
      if (options.minRiskScore !== undefined) {
        conditions.push(gte(emails.riskScore, options.minRiskScore));
      }
      if (options.excludeDisposable) {
        conditions.push(eq(emails.disposableStatus, false));
      }
      if (options.includeCatchAll === false) {
        conditions.push(eq(emails.catchAllStatus, false));
      }
    }

    const query = db
      .select({
        email: emails.originalEmail,
        status: emails.finalStatus,
        risk_score: emails.riskScore,
        confidence: emails.confidence,
        syntax: emails.syntaxStatus,
        suggested_email: emails.suggestedEmail,
        domain: emails.domain,
        domain_exists: emails.domainExists,
        mx_host: emails.mxHost,
        smtp_status: emails.smtpStatus,
        smtp_code: emails.smtpCode,
        smtp_response: emails.smtpResponse,
        catch_all: emails.catchAllStatus,
        disposable: emails.disposableStatus,
        role_based: emails.roleBasedStatus,
        free_provider: emails.freeProviderStatus,
        provider: emails.providerName,
        reason: emails.classificationReason,
        verified_at: emails.lastVerifiedAt,
      })
      .from(emails)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const rows = await query;

    const formattedRows = rows.map((r) => ({
      email: r.email,
      status: r.status,
      risk_score: r.risk_score,
      confidence: r.confidence,
      syntax: r.syntax || "PASS",
      suggested_email: r.suggested_email || "",
      domain: r.domain,
      domain_exists: r.domain_exists ? "YES" : "NO",
      mx_host: r.mx_host || "",
      smtp_status: r.smtp_status || "",
      smtp_code: r.smtp_code ?? "",
      smtp_response: r.smtp_response || "",
      catch_all: r.catch_all ? "YES" : "NO",
      disposable: r.disposable ? "YES" : "NO",
      role_based: r.role_based ? "YES" : "NO",
      free_provider: r.free_provider ? "YES" : "NO",
      provider: r.provider || "Unknown",
      reason: r.reason || "",
      verified_at: r.verified_at ? new Date(r.verified_at).toISOString() : "",
    }));

    const csvContent = Papa.unparse(formattedRows);
    fs.writeFileSync(filePath, csvContent, "utf-8");

    return {
      filename,
      filePath,
      recordCount: formattedRows.length,
    };
  }
}
