import { ConfidenceLevel, DnsResult, SmtpResult, SyntaxResult } from "../types";

export class ConfidenceEngine {
  /**
   * Determines confidence (HIGH / MEDIUM / LOW) based on evidence quality.
   */
  static evaluate(
    syntax: SyntaxResult,
    dns: DnsResult,
    smtp: SmtpResult,
    isCatchAll: boolean
  ): ConfidenceLevel {
    // Definitive failures -> HIGH confidence
    if (syntax.status === "FAIL") {
      return "HIGH";
    }

    if (!dns.domainExists || dns.status === "NULL_MX" || dns.status === "FAIL") {
      return "HIGH";
    }

    if (smtp.status === "REJECTED") {
      return "HIGH";
    }

    // SMTP Accepted + Catch-All -> Evidence is ambiguous because server accepts everything
    if (smtp.status === "ACCEPTED" && isCatchAll) {
      return "MEDIUM";
    }

    // SMTP Accepted + Confirmed Not Catch-All -> HIGH confidence
    if (smtp.status === "ACCEPTED" && !isCatchAll) {
      return "HIGH";
    }

    // Temporary failures or connection errors -> LOW or MEDIUM confidence
    if (smtp.status === "TEMPORARY_FAILURE" || smtp.status === "TIMEOUT") {
      return "LOW";
    }

    if (smtp.status === "BLOCKED" || smtp.status === "CONNECTION_ERROR") {
      return "LOW";
    }

    return "LOW";
  }
}
