import { describe, it, expect } from "vitest";
import { TypoDetector } from "@/server/verification/typo/typo-detector";

describe("TypoDetector", () => {
  it("should detect common Gmail misspellings", () => {
    const typo1 = TypoDetector.check("john@gmial.com", "john", "gmial.com");
    expect(typo1.detected).toBe(true);
    expect(typo1.suggestedEmail).toBe("john@gmail.com");
    expect(typo1.suggestedDomain).toBe("gmail.com");

    const typo2 = TypoDetector.check("sarah@gmal.com", "sarah", "gmal.com");
    expect(typo2.detected).toBe(true);
    expect(typo2.suggestedEmail).toBe("sarah@gmail.com");

    const typo3 = TypoDetector.check("alex@gmaill.com", "alex", "gmaill.com");
    expect(typo3.detected).toBe(true);
    expect(typo3.suggestedEmail).toBe("alex@gmail.com");
  });

  it("should detect common Outlook & Hotmail misspellings", () => {
    const typo1 = TypoDetector.check("dave@outlok.com", "dave", "outlok.com");
    expect(typo1.detected).toBe(true);
    expect(typo1.suggestedEmail).toBe("dave@outlook.com");

    const typo2 = TypoDetector.check("lisa@hotmial.com", "lisa", "hotmial.com");
    expect(typo2.detected).toBe(true);
    expect(typo2.suggestedEmail).toBe("lisa@hotmail.com");
  });

  it("should detect common Yahoo misspellings", () => {
    const typo = TypoDetector.check("mark@yaho.com", "mark", "yaho.com");
    expect(typo.detected).toBe(true);
    expect(typo.suggestedEmail).toBe("mark@yahoo.com");
  });

  it("should not flag legitimate domains", () => {
    expect(TypoDetector.check("user@gmail.com", "user", "gmail.com").detected).toBe(false);
    expect(TypoDetector.check("admin@outlook.com", "admin", "outlook.com").detected).toBe(false);
    expect(TypoDetector.check("support@yahoo.com", "support", "yahoo.com").detected).toBe(false);
    expect(TypoDetector.check("info@acmecorp.io", "info", "acmecorp.io").detected).toBe(false);
    expect(TypoDetector.check("founder@stripe.com", "founder", "stripe.com").detected).toBe(false);
  });
});
