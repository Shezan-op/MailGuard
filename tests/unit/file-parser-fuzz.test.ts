import { describe, it, expect } from "vitest";
import { FileParser } from "@/server/imports/file-parser";

describe("File Upload & Parser Hardening (CSV, XLSX, TXT)", () => {
  it("0-BYTE DEFENSE: Safely parses empty 0-byte buffer without crashing", () => {
    const emptyBuf = Buffer.from("");

    const csvRes = FileParser.parseCsv(emptyBuf, "empty.csv");
    expect(csvRes.totalRows).toBe(0);
    expect(csvRes.uniqueEmails).toBe(0);
    expect(csvRes.entries).toHaveLength(0);

    const xlsxRes = FileParser.parseXlsx(emptyBuf, "empty.xlsx");
    expect(xlsxRes.totalRows).toBe(0);
    expect(xlsxRes.uniqueEmails).toBe(0);

    const txtRes = FileParser.parseTxt(emptyBuf, "empty.txt");
    expect(txtRes.totalRows).toBe(0);
  });

  it("FORMULA INJECTION: Strips formula triggers (=, +, -, @) to prevent DDE execution", () => {
    const maliciousCsv = Buffer.from(
      `email,name\n=cmd|' /C calc'!A0@evil.com,Attacker\n+12345@domain.com,User\n@malicious@target.com,Spammer\nclean@legit.com,Normal`
    );

    const res = FileParser.parseCsv(maliciousCsv, "formula_test.csv");
    expect(res.entries.length).toBeGreaterThan(0);

    for (const entry of res.entries) {
      expect(entry.originalEmail.startsWith("=")).toBe(false);
      expect(entry.originalEmail.startsWith("+")).toBe(false);
      expect(entry.originalEmail.startsWith("@")).toBe(false);
    }
  });

  it("NULL BYTE STRIPPING: Removes null bytes (\\0) from CSV buffer", () => {
    const corruptedCsv = Buffer.from("email,note\nuser\0@example.com,test\0with\0nulls\n");
    const res = FileParser.parseCsv(corruptedCsv, "nulls.csv");

    expect(res.entries).toHaveLength(1);
    expect(res.entries[0].originalEmail).toBe("user@example.com");
    expect(res.entries[0].originalEmail).not.toContain("\0");
  });

  it("BOM & CRLF: Automatically strips UTF-8 BOM and handles mixed line endings", () => {
    const bomCsv = Buffer.from("\uFEFFemail\r\nfirst@example.com\nsecond@example.com\rthird@example.com");
    const res = FileParser.parseCsv(bomCsv, "bom.csv");

    expect(res.uniqueEmails).toBe(3);
    expect(res.entries.map((e) => e.normalizedEmail)).toContain("first@example.com");
    expect(res.entries.map((e) => e.normalizedEmail)).toContain("second@example.com");
    expect(res.entries.map((e) => e.normalizedEmail)).toContain("third@example.com");
  });

  it("MALFORMED CSV: Handles unclosed quotes and uneven columns gracefully", () => {
    const brokenCsv = Buffer.from(`email,notes\n"broken-quote@example.com,some text\nvalid@example.com,good`);
    const res = FileParser.parseCsv(brokenCsv, "broken.csv");

    expect(res).toBeDefined();
    expect(Array.isArray(res.entries)).toBe(true);
  });
});
