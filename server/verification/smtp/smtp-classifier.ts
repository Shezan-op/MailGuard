import { SmtpStatus } from "../types";

export interface SmtpClassification {
  status: SmtpStatus;
  retryable: boolean;
  failureType?: string;
  reason: string;
}

export class SmtpClassifier {
  /**
   * Classifies an SMTP response code and message into a definitive operational status.
   */
  static classify(code: number, message: string): SmtpClassification {
    const lower = message.toLowerCase();

    // 252: Cannot verify recipient, but will accept message and attempt delivery (RFC 5321)
    if (code === 252) {
      return {
        status: "UNKNOWN",
        retryable: false,
        failureType: "CANNOT_VERIFY",
        reason: `Server cannot verify recipient (${code}): ${message}`,
      };
    }

    // 250 / 251: Recipient accepted by mail server
    if (code >= 200 && code < 300) {
      return {
        status: "ACCEPTED",
        retryable: false,
        reason: "Mailbox accepted recipient check",
      };
    }

    // 4xx Temporary Failures (Greylisting, Rate-Limiting, Server Busy)
    if (code >= 400 && code < 500) {
      if (lower.includes("grey") || lower.includes("gray") || lower.includes("try again") || lower.includes("deferred")) {
        return {
          status: "TEMPORARY_FAILURE",
          retryable: true,
          failureType: "GREYLISTED",
          reason: "Server temporarily deferred delivery due to greylisting or rate policy",
        };
      }

      if (lower.includes("rate") || lower.includes("limit") || lower.includes("too many") || lower.includes("throttl")) {
        return {
          status: "TEMPORARY_FAILURE",
          retryable: true,
          failureType: "RATE_LIMITED",
          reason: "Server rejected request due to temporary rate limiting",
        };
      }

      if (lower.includes("busy") || lower.includes("overloaded") || lower.includes("try later")) {
        return {
          status: "TEMPORARY_FAILURE",
          retryable: true,
          failureType: "SERVER_BUSY",
          reason: "Server is temporarily busy or unavailable",
        };
      }

      return {
        status: "TEMPORARY_FAILURE",
        retryable: true,
        failureType: "TEMPORARY_ERROR",
        reason: `Temporary server response (${code}): ${message}`,
      };
    }

    // 5xx Permanent Failures
    if (code >= 500 && code < 600) {
      // Definitive Mailbox Rejections
      const mailboxNotFoundPatterns = [
        "user unknown",
        "user not found",
        "mailbox unavailable",
        "mailbox not found",
        "recipient rejected",
        "recipient unknown",
        "no such user",
        "unknown user",
        "account does not exist",
        "account disabled",
        "address rejected",
        "invalid recipient",
        "does not exist",
        "undeliverable",
        "no mailbox",
        "bad destination",
      ];

      for (const pattern of mailboxNotFoundPatterns) {
        if (lower.includes(pattern)) {
          return {
            status: "REJECTED",
            retryable: false,
            failureType: "MAILBOX_NOT_FOUND",
            reason: `Mailbox permanently rejected by server: ${pattern}`,
          };
        }
      }

      // Security / Spam / IP Policy blocks (e.g. sender IP blocked by Proofpoint/Spamhaus)
      const policyBlockedPatterns = [
        "blocked",
        "blacklisted",
        "spamhaus",
        "barracuda",
        "reputation",
        "policy violation",
        "access denied",
        "relay access denied",
        "administrative prohibition",
      ];

      for (const pattern of policyBlockedPatterns) {
        if (lower.includes(pattern)) {
          return {
            status: "BLOCKED",
            retryable: false,
            failureType: "POLICY_BLOCKED",
            reason: `Connection or sender IP blocked by recipient mail security policy: ${pattern}`,
          };
        }
      }

      // Mailbox full / quota exceeded (mailbox exists, but cannot accept)
      if (lower.includes("quota") || lower.includes("mailbox full") || lower.includes("storage")) {
        return {
          status: "REJECTED",
          retryable: false,
          failureType: "MAILBOX_FULL",
          reason: "Mailbox exists but quota is exceeded",
        };
      }

      return {
        status: "REJECTED",
        retryable: false,
        failureType: "PERMANENT_ERROR",
        reason: `Permanent rejection (${code}): ${message}`,
      };
    }

    return {
      status: "TEMPORARY_FAILURE",
      retryable: true,
      reason: `Unrecognized SMTP response (${code}): ${message}`,
    };
  }
}
