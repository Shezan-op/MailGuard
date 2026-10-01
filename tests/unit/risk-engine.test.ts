import { describe, it, expect } from "vitest";
import { RiskEngine, RiskEvaluationInput } from "@/server/verification/scoring/risk-engine";

describe("RiskEngine", () => {
  const baseInput: RiskEvaluationInput = {
    syntax: { status: "PASS", normalizedEmail: "user@example.com" },
    dns: { domainExists: true, status: "PASS", mxRecords: [{ exchange: "mx.example.com", priority: 10 }] },
    smtp: { status: "ACCEPTED", code: 250, response: "2.1.5 OK", latencyMs: 120, events: [] },
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

  it("should calculate low risk for clean accepted mailbox", () => {
    const score = RiskEngine.calculate(baseInput);
    expect(score).toBe(8);
  });

  it("should reward positive historical deliverability", () => {
    const score = RiskEngine.calculate({
      ...baseInput,
      reputation: {
        ...baseInput.reputation,
        historicalDeliveries: 5,
      },
    });
    expect(score).toBeLessThan(8);
  });

  it("should enforce immediate 100 risk for hard failures (syntax, domain, MX, suppression, SMTP rejected)", () => {
    expect(RiskEngine.calculate({ ...baseInput, syntax: { status: "FAIL" } })).toBe(100);
    expect(RiskEngine.calculate({ ...baseInput, dns: { domainExists: false, status: "FAIL", mxRecords: [] } })).toBe(100);
    expect(RiskEngine.calculate({ ...baseInput, dns: { domainExists: true, status: "NULL_MX", mxRecords: [] } })).toBe(100);
    expect(RiskEngine.calculate({ ...baseInput, reputation: { ...baseInput.reputation, isSuppressed: true } })).toBe(100);
    expect(RiskEngine.calculate({ ...baseInput, smtp: { status: "REJECTED", code: 550, events: [] } })).toBe(100);
  });

  it("should assign 90 risk for disposable email domains", () => {
    const score = RiskEngine.calculate({ ...baseInput, isDisposable: true });
    expect(score).toBe(90);
  });

  it("should assign 85 risk if there is a verified historical hard bounce", () => {
    const score = RiskEngine.calculate({
      ...baseInput,
      reputation: { ...baseInput.reputation, hasHistoricalHardBounce: true },
    });
    expect(score).toBe(85);
  });

  it("should assign elevated risk for catch-all domains (65-90)", () => {
    const score = RiskEngine.calculate({ ...baseInput, isCatchAll: true });
    expect(score).toBeGreaterThanOrEqual(65);
    expect(score).toBeLessThanOrEqual(90);
  });

  it("should assign moderate risk for temporary failure / greylisting", () => {
    const score = RiskEngine.calculate({
      ...baseInput,
      smtp: { status: "TEMPORARY_FAILURE", code: 450, retryable: true, events: [] },
    });
    expect(score).toBe(60);
  });
});
