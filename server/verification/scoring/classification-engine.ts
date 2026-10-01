import { VerificationStatus } from "../types";
import { RiskEvaluationInput } from "./risk-engine";

export interface ClassificationResult {
  status: VerificationStatus;
  reason: string;
}

export class ClassificationEngine {
  /**
   * Applies deterministic precedence rules to arrive at the final verification status and clear explanation.
   */
  static classify(input: RiskEvaluationInput): ClassificationResult {
    // 1. Suppression Check
    if (input.reputation.isSuppressed) {
      return {
        status: "UNDELIVERABLE",
        reason: input.reputation.suppressionReason || "Address or domain is on the active suppression list",
      };
    }

    // 2. Syntax Check
    if (input.syntax.status === "FAIL") {
      return {
        status: "UNDELIVERABLE",
        reason: input.syntax.reason || "Invalid email address syntax",
      };
    }

    // 3. Domain Check
    if (!input.dns.domainExists || input.dns.status === "FAIL") {
      return {
        status: "UNDELIVERABLE",
        reason: input.dns.reason || "Domain does not exist (NXDOMAIN)",
      };
    }

    // 4. MX Record Check
    if (input.dns.status === "NULL_MX") {
      return {
        status: "UNDELIVERABLE",
        reason: "Domain publishes an RFC 7505 Null MX record explicitly refusing email",
      };
    }

    if (input.dns.mxRecords.length === 0 && input.dns.status === "NO_MX") {
      return {
        status: "UNDELIVERABLE",
        reason: "No mail exchange (MX) or fallback address records found for domain",
      };
    }

    // 5. Disposable Email Provider Check
    if (input.isDisposable) {
      return {
        status: "DISPOSABLE",
        reason: "Domain is a known temporary or disposable email service",
      };
    }

    // 6. Confirmed SMTP Rejection
    if (input.smtp.status === "REJECTED") {
      return {
        status: "UNDELIVERABLE",
        reason: input.smtp.reason || "Recipient mailbox permanently rejected by receiving mail server",
      };
    }

    // 7. Historical Hard Bounce Warning (Risky)
    if (input.reputation.hasHistoricalHardBounce) {
      return {
        status: "RISKY",
        reason: "Recipient address previously resulted in a hard bounce during an earlier campaign",
      };
    }

    // 8. Catch-All Domain
    if (input.isCatchAll) {
      return {
        status: "CATCH_ALL",
        reason: "Domain mail server accepts any arbitrary address; individual mailbox existence cannot be confirmed",
      };
    }

    // 9. Temporary SMTP Failures / Greylisting
    if (input.smtp.status === "TEMPORARY_FAILURE" || input.smtp.status === "TIMEOUT") {
      return {
        status: "TEMPORARY",
        reason: input.smtp.reason || "Server temporarily unavailable or deferred connection (greylisted)",
      };
    }

    // 10. Policy Blocked
    if (input.smtp.status === "BLOCKED") {
      return {
        status: "RISKY",
        reason: input.smtp.reason || "Verification connection blocked by receiving server security/spam filter",
      };
    }

    // 11. Role-Based Address
    if (input.isRoleBased) {
      return {
        status: "ROLE_BASED",
        reason: "Generic role/function-based mailbox (e.g. support, sales, admin) rather than an individual",
      };
    }

    // 12. Deliverable (Accepted by SMTP & Not Catch-All)
    if (input.smtp.status === "ACCEPTED") {
      return {
        status: "DELIVERABLE",
        reason: "Mailbox confirmed active and accepted by recipient mail server",
      };
    }

    // 13. Unknown Fallback
    return {
      status: "UNKNOWN",
      reason: input.smtp.reason || "Insufficient evidence from mail server to determine mailbox deliverability",
    };
  }
}
