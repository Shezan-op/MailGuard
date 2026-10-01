import { describe, it, expect } from "vitest";
import { ClassificationEngine } from "@/server/verification/scoring/classification-engine";
import { ConfidenceEngine } from "@/server/verification/scoring/confidence-engine";
import { RiskEvaluationInput } from "@/server/verification/scoring/risk-engine";

describe("ClassificationEngine & ConfidenceEngine", () => {
  const baseInput: RiskEvaluationInput = {
    syntax: { status: "PASS", normalizedEmail: "john@company.com" },
    dns: { domainExists: true, status: "PASS", mxRecords: [{ exchange: "mail.company.com", priority: 10 }] },
    smtp: { status: "ACCEPTED", code: 250, response: "2.1.5 Recipient OK", events: [] },
    isCatchAll: false,
    isDisposable: false,
    isRoleBased: false,
    isFreeProvider: false,
    reputation: {
      isSuppressed: false,
      hasHistoricalHardBounce: false,
      historicalDeliveries: 0,
      historicalBounces: 0,
    },
  };

  it("should classify clean accepted address as DELIVERABLE with HIGH confidence", () => {
    const verdict = ClassificationEngine.classify(baseInput);
    const confidence = ConfidenceEngine.evaluate(baseInput.syntax, baseInput.dns, baseInput.smtp, baseInput.isCatchAll);

    expect(verdict.status).toBe("DELIVERABLE");
    expect(confidence).toBe("HIGH");
  });

  it("should classify catch-all domain as CATCH_ALL with MEDIUM confidence", () => {
    const input: RiskEvaluationInput = { ...baseInput, isCatchAll: true };
    const verdict = ClassificationEngine.classify(input);
    const confidence = ConfidenceEngine.evaluate(input.syntax, input.dns, input.smtp, input.isCatchAll);

    expect(verdict.status).toBe("CATCH_ALL");
    expect(confidence).toBe("MEDIUM");
  });

  it("should prioritize SUPPRESSION as UNDELIVERABLE", () => {
    const input: RiskEvaluationInput = {
      ...baseInput,
      reputation: { ...baseInput.reputation, isSuppressed: true, suppressionReason: "Suppressed manual" },
    };
    const verdict = ClassificationEngine.classify(input);
    expect(verdict.status).toBe("UNDELIVERABLE");
  });

  it("should classify DISPOSABLE addresses as DISPOSABLE", () => {
    const input: RiskEvaluationInput = { ...baseInput, isDisposable: true };
    const verdict = ClassificationEngine.classify(input);
    expect(verdict.status).toBe("DISPOSABLE");
  });

  it("should classify ROLE_BASED addresses when accepted and not catch-all", () => {
    const input: RiskEvaluationInput = { ...baseInput, isRoleBased: true };
    const verdict = ClassificationEngine.classify(input);
    expect(verdict.status).toBe("ROLE_BASED");
  });

  it("should classify temporary failures / greylisting as TEMPORARY with LOW confidence", () => {
    const input: RiskEvaluationInput = {
      ...baseInput,
      smtp: { status: "TEMPORARY_FAILURE", code: 450, retryable: true, events: [] },
    };
    const verdict = ClassificationEngine.classify(input);
    const confidence = ConfidenceEngine.evaluate(input.syntax, input.dns, input.smtp, input.isCatchAll);

    expect(verdict.status).toBe("TEMPORARY");
    expect(confidence).toBe("LOW");
  });

  it("should classify historical hard bounce as RISKY even if SMTP accepts", () => {
    const input: RiskEvaluationInput = {
      ...baseInput,
      reputation: { ...baseInput.reputation, hasHistoricalHardBounce: true },
    };
    const verdict = ClassificationEngine.classify(input);
    expect(verdict.status).toBe("RISKY");
  });

  it("should classify 550 permanent reject as UNDELIVERABLE with HIGH confidence", () => {
    const input: RiskEvaluationInput = {
      ...baseInput,
      smtp: { status: "REJECTED", code: 550, response: "5.1.1 User unknown", events: [] },
    };
    const verdict = ClassificationEngine.classify(input);
    const confidence = ConfidenceEngine.evaluate(input.syntax, input.dns, input.smtp, input.isCatchAll);

    expect(verdict.status).toBe("UNDELIVERABLE");
    expect(confidence).toBe("HIGH");
  });
});
