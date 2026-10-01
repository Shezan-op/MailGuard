import Papa from "papaparse";
import * as xlsx from "xlsx";
import { SyntaxValidator } from "../verification/syntax/syntax-validator";

export interface ParsedEmailEntry {
  originalEmail: string;
  normalizedEmail: string;
  localPart: string;
  domain: string;
  isValidSyntax: boolean;
  syntaxReason?: string;
  metadata?: Record<string, any>;
}

export interface FileParseResult {
  filename: string;
  sourceType: "csv" | "xlsx" | "txt" | "paste";
  totalRows: number;
  uniqueEmails: number;
  duplicateCount: number;
  syntaxInvalidCount: number;
  domainCount: number;
  detectedEmailColumn?: string;
  availableColumns: string[];
  entries: ParsedEmailEntry[];
}

export class FileParser {
  /**
   * Strips formula injection attack characters (=, +, -, @, tab, CR)
   * to protect downstream spreadsheet applications against CVE-level DDE attacks.
   */
  static sanitizeCellValue(val: any): string {
    if (val === null || val === undefined) return "";
    let str = String(val).trim();
    // Remove null bytes
    str = str.replace(/\0/g, "");
    // If string starts with formula trigger characters, neutralize it
    if (/^[=+\-@\t\r]/.test(str)) {
      str = "'" + str;
    }
    return str;
  }

  /**
   * Automatically detects which column contains email addresses from sample rows.
   */
  static detectEmailColumn(rows: Record<string, any>[]): string | undefined {
    if (!rows || rows.length === 0) return undefined;

    const columnScores: Record<string, number> = {};
    const sample = rows.slice(0, 50);

    for (const row of sample) {
      for (const [col, val] of Object.entries(row)) {
        if (!val || typeof val !== "string") continue;
        const lowerCol = col.toLowerCase().trim();
        const trimmedVal = val.trim();

        // Bonus for explicit column header naming
        if (lowerCol === "email" || lowerCol === "e-mail" || lowerCol === "email_address") {
          columnScores[col] = (columnScores[col] || 0) + 10;
        } else if (lowerCol.includes("mail")) {
          columnScores[col] = (columnScores[col] || 0) + 5;
        }

        // Check if value looks like an email
        if (trimmedVal.includes("@") && trimmedVal.includes(".")) {
          columnScores[col] = (columnScores[col] || 0) + 3;
        }
      }
    }

    let bestCol: string | undefined;
    let maxScore = 0;
    for (const [col, score] of Object.entries(columnScores)) {
      if (score > maxScore) {
        maxScore = score;
        bestCol = col;
      }
    }

    return bestCol;
  }

  /**
   * Parses raw pasted text (one or multiple emails per line, comma or semicolon separated).
   */
  static parsePastedText(text: string): FileParseResult {
    if (!text || typeof text !== "string") {
      return {
        filename: "pasted_emails.txt",
        sourceType: "paste",
        totalRows: 0,
        uniqueEmails: 0,
        duplicateCount: 0,
        syntaxInvalidCount: 0,
        domainCount: 0,
        availableColumns: ["email"],
        entries: [],
      };
    }

    const cleanText = text.replace(/\0/g, "");
    const rawLines = cleanText.split(/[\r\n,;]+/);
    const seen = new Set<string>();
    const entries: ParsedEmailEntry[] = [];
    const domains = new Set<string>();
    let duplicates = 0;
    let syntaxInvalid = 0;

    for (const raw of rawLines) {
      let trimmed = raw.trim();
      if (!trimmed) continue;

      // Neutralize formula characters if someone pasted =cmd|' /C ...'
      if (/^[=+\-@]/.test(trimmed)) {
        trimmed = trimmed.replace(/^[=+\-@]+/, "");
      }
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        duplicates++;
        continue;
      }
      seen.add(normalized);

      const syntax = SyntaxValidator.validate(trimmed);
      const isValid = syntax.status === "PASS";
      if (!isValid) {
        syntaxInvalid++;
      } else if (syntax.domain) {
        domains.add(syntax.domain);
      }

      entries.push({
        originalEmail: trimmed,
        normalizedEmail: syntax.normalizedEmail || normalized,
        localPart: syntax.localPart || "",
        domain: syntax.domain || "",
        isValidSyntax: isValid,
        syntaxReason: syntax.reason,
      });
    }

    return {
      filename: "pasted_emails.txt",
      sourceType: "paste",
      totalRows: entries.length + duplicates,
      uniqueEmails: entries.length,
      duplicateCount: duplicates,
      syntaxInvalidCount: syntaxInvalid,
      domainCount: domains.size,
      availableColumns: ["email"],
      entries,
    };
  }

  /**
   * Parses a CSV file buffer with automatic delimiter detection (comma, semicolon, tab).
   */
  static parseCsv(buffer: Buffer, filename: string, targetColumn?: string): FileParseResult {
    if (!buffer || buffer.length === 0) {
      return {
        filename,
        sourceType: "csv",
        totalRows: 0,
        uniqueEmails: 0,
        duplicateCount: 0,
        syntaxInvalidCount: 0,
        domainCount: 0,
        availableColumns: [],
        entries: [],
      };
    }

    // Strip BOM, null bytes, and normalize all CRLF/CR to LF
    const content = buffer
      .toString("utf-8")
      .replace(/^\uFEFF/, "")
      .replace(/\0/g, "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    let parsed: Papa.ParseResult<Record<string, any>>;
    try {
      parsed = Papa.parse<Record<string, any>>(content, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (h) => h.trim(),
      });
    } catch {
      return {
        filename,
        sourceType: "csv",
        totalRows: 0,
        uniqueEmails: 0,
        duplicateCount: 0,
        syntaxInvalidCount: 0,
        domainCount: 0,
        availableColumns: [],
        entries: [],
      };
    }

    const rows = parsed.data || [];
    const availableColumns = parsed.meta.fields || [];

    const emailCol = targetColumn || this.detectEmailColumn(rows) || availableColumns[0] || "email";

    const seen = new Set<string>();
    const entries: ParsedEmailEntry[] = [];
    const domains = new Set<string>();
    let duplicates = 0;
    let syntaxInvalid = 0;

    for (const row of rows) {
      const rawVal = row[emailCol];
      if (!rawVal || typeof rawVal !== "string") continue;

      let trimmed = rawVal.trim();
      if (!trimmed) continue;

      if (/^[=+\-@]/.test(trimmed)) {
        trimmed = trimmed.replace(/^[=+\-@]+/, "");
      }
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        duplicates++;
        continue;
      }
      seen.add(normalized);

      const syntax = SyntaxValidator.validate(trimmed);
      const isValid = syntax.status === "PASS";
      if (!isValid) {
        syntaxInvalid++;
      } else if (syntax.domain) {
        domains.add(syntax.domain);
      }

      entries.push({
        originalEmail: trimmed,
        normalizedEmail: syntax.normalizedEmail || normalized,
        localPart: syntax.localPart || "",
        domain: syntax.domain || "",
        isValidSyntax: isValid,
        syntaxReason: syntax.reason,
        metadata: row,
      });
    }

    return {
      filename,
      sourceType: "csv",
      totalRows: rows.length,
      uniqueEmails: entries.length,
      duplicateCount: duplicates,
      syntaxInvalidCount: syntaxInvalid,
      domainCount: domains.size,
      detectedEmailColumn: emailCol,
      availableColumns,
      entries,
    };
  }

  /**
   * Parses an XLSX file buffer with macro, formula, and sheet exhaustion safety.
   */
  static parseXlsx(buffer: Buffer, filename: string, targetColumn?: string, sheetName?: string): FileParseResult {
    const emptyResult: FileParseResult = {
      filename,
      sourceType: "xlsx",
      totalRows: 0,
      uniqueEmails: 0,
      duplicateCount: 0,
      syntaxInvalidCount: 0,
      domainCount: 0,
      availableColumns: [],
      entries: [],
    };

    if (!buffer || buffer.length === 0) {
      return emptyResult;
    }

    let workbook: xlsx.WorkBook;
    try {
      workbook = xlsx.read(buffer, {
        type: "buffer",
        cellFormula: false, // Never evaluate formulas (prevents arbitrary calculation & RCE exploits)
        cellHTML: false,
        cellText: false,
      });
    } catch {
      return emptyResult;
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      return emptyResult;
    }

    const targetSheet = sheetName || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[targetSheet];
    if (!worksheet) {
      return emptyResult;
    }

    let rows: Record<string, any>[] = [];
    try {
      rows = xlsx.utils.sheet_to_json(worksheet, { defval: "" });
    } catch {
      return emptyResult;
    }

    const availableColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const emailCol = targetColumn || this.detectEmailColumn(rows) || availableColumns[0] || "email";

    const seen = new Set<string>();
    const entries: ParsedEmailEntry[] = [];
    const domains = new Set<string>();
    let duplicates = 0;
    let syntaxInvalid = 0;

    for (const row of rows) {
      const rawVal = row[emailCol];
      if (!rawVal || typeof rawVal !== "string") continue;

      let trimmed = rawVal.trim();
      if (!trimmed) continue;

      if (/^[=+\-@]/.test(trimmed)) {
        trimmed = trimmed.replace(/^[=+\-@]+/, "");
      }
      if (!trimmed) continue;

      const normalized = trimmed.toLowerCase();
      if (seen.has(normalized)) {
        duplicates++;
        continue;
      }
      seen.add(normalized);

      const syntax = SyntaxValidator.validate(trimmed);
      const isValid = syntax.status === "PASS";
      if (!isValid) {
        syntaxInvalid++;
      } else if (syntax.domain) {
        domains.add(syntax.domain);
      }

      entries.push({
        originalEmail: trimmed,
        normalizedEmail: syntax.normalizedEmail || normalized,
        localPart: syntax.localPart || "",
        domain: syntax.domain || "",
        isValidSyntax: isValid,
        syntaxReason: syntax.reason,
        metadata: row,
      });
    }

    return {
      filename,
      sourceType: "xlsx",
      totalRows: rows.length,
      uniqueEmails: entries.length,
      duplicateCount: duplicates,
      syntaxInvalidCount: syntaxInvalid,
      domainCount: domains.size,
      detectedEmailColumn: emailCol,
      availableColumns,
      entries,
    };
  }

  /**
   * Parses plain text file (one email per line).
   */
  static parseTxt(buffer: Buffer, filename: string): FileParseResult {
    if (!buffer || buffer.length === 0) {
      return {
        filename,
        sourceType: "txt",
        totalRows: 0,
        uniqueEmails: 0,
        duplicateCount: 0,
        syntaxInvalidCount: 0,
        domainCount: 0,
        availableColumns: ["email"],
        entries: [],
      };
    }
    const text = buffer.toString("utf-8");
    const result = this.parsePastedText(text);
    result.filename = filename;
    result.sourceType = "txt";
    return result;
  }
}
