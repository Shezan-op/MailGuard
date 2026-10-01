import { DnsResult, SmtpResult, SyntaxResult } from "../types";
import { AddressReputation } from "../reputation/reputation-service";

export interface RiskEvaluationInput {
  syntax: SyntaxResult;
  dns: DnsResult;
  smtp: SmtpResult;
  isCatchAll: boolean;
  isDisposable: boolean;
  isRoleBased: boolean;
  isFreeProvider: boolean;
  reputation: AddressReputation;
}

export class RiskEngine {
  /**
   * Deterministically calculates a risk score from 0 (lowest risk) to 100 (highest risk).
   * Hard failures strictly override positive signals and clamp to 100.
   */
  static calculate(input: RiskEvaluationInput): number {
    // 1. Hard Failures (Immediate 100)
    if (input.syntax.status === "FAIL") {
      return 100;
    }

    if (!input.dns.domainExists || input.dns.status === "FAIL") {
      return 100;
    }

    if (input.dns.status === "NULL_MX" || (input.dns.mxRecords.length === 0 && input.dns.status === "NO_MX")) {
      return 100;
    }

    if (input.reputation.isSuppressed) {
      return 100;
    }

    if (input.smtp.status === "REJECTED") {
      return 100;
    }

    // 2. Strong Risk Factors (80 - 95)
    if (input.isDisposable) {
      return 90;
    }

    if (input.reputation.hasHistoricalHardBounce) {
      // Even if SMTP server currently accepts (e.g. catch-all or delayed bounce),
      // a verified historical hard bounce is a critical risk indicator.
      return 85;
    }

    // 3. Moderate to High Uncertainty Factors
    if (input.isCatchAll) {
      let score = 65;
      if (input.isRoleBased) score += 10;
      if (input.reputation.domainBounceRate && input.reputation.domainBounceRate > 500) {
        score += 15; // Higher than 5% bounce rate on domain
      }
      return Math.min(score, 90);
    }

    if (input.smtp.status === "TEMPORARY_FAILURE" || input.smtp.status === "TIMEOUT") {
      let score = 60;
      if (input.isRoleBased) score += 10;
      return Math.min(score, 85);
    }

    if (input.smtp.status === "CONNECTION_ERROR" || input.smtp.status === "TLS_ERROR") {
      return 65;
    }

    if (input.smtp.status === "BLOCKED") {
      return 75; // Sender IP or reputation blocked by recipient
    }

    // 4. Low Risk Baseline (SMTP Accepted)
    if (input.smtp.status === "ACCEPTED") {
      let score = 8; // Baseline clean address

      if (input.isRoleBased) {
        score += 15; // 23/100
      }

      if (input.isFreeProvider) {
        score += 4; // 12/100
      }

      // Reward strong historical delivery
      if (input.reputation.historicalDeliveries >= 3) {
        score = Math.max(score - 5, 2);
      }

      return Math.min(Math.max(score, 0), 100);
    }

    // 5. Default / Unknown
    return 50;
  }
}
