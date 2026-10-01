import { describe, it, expect } from "vitest";
import { SyntaxValidator } from "@/server/verification/syntax/syntax-validator";

describe("SyntaxValidator", () => {
  describe("Valid email formats", () => {
    const validEmails = [
      "simple@example.com",
      "very.common@example.com",
      "disposable.style.email.with+symbol@example.com",
      "other.email-with-hyphen@example.com",
      "fully-qualified-domain@sub.example.com",
      "user.name+tag+sorting@example.com",
      "x@example.com",
      "example-indeed@strange-example.com",
      "admin@mailserver1.domain.org",
      "1234567890@example.com",
    ];

    validEmails.forEach((email) => {
      it(`should accept valid email: ${email}`, () => {
        const result = SyntaxValidator.validate(email);
        expect(result.status).toBe("PASS");
        expect(result.localPart).toBeDefined();
        expect(result.domain).toBeDefined();
      });
    });
  });

  describe("Invalid email formats", () => {
    const invalidEmails = [
      "",
      "plainaddress",
      "#@%^%#$@#$@#.com",
      "@example.com",
      "Joe Smith <email@example.com>",
      "email.example.com",
      "email@example@example.com",
      ".email@example.com",
      "email.@example.com",
      "email..email@example.com",
      "email@example.com (Joe Smith)",
      "email@example",
      "email@-example.com",
      "email@example..com",
      "Abc..123@example.com",
    ];

    invalidEmails.forEach((email) => {
      it(`should reject invalid email: "${email}"`, () => {
        const result = SyntaxValidator.validate(email);
        expect(result.status).toBe("FAIL");
        expect(result.reason).toBeDefined();
      });
    });
  });

  describe("RFC Length constraints", () => {
    it("should reject local part exceeding 64 characters", () => {
      const longLocal = "a".repeat(65) + "@example.com";
      const result = SyntaxValidator.validate(longLocal);
      expect(result.status).toBe("FAIL");
      expect(result.reason).toContain("64");
    });

    it("should accept local part with exactly 64 characters", () => {
      const maxLocal = "a".repeat(64) + "@example.com";
      const result = SyntaxValidator.validate(maxLocal);
      expect(result.status).toBe("PASS");
    });

    it("should reject total email exceeding 254 characters", () => {
      const longDomain = "a".repeat(60) + "." + "b".repeat(60) + "." + "c".repeat(60) + "." + "d".repeat(60) + ".com";
      const email = "verylongusername@" + longDomain;
      const result = SyntaxValidator.validate(email);
      expect(result.status).toBe("FAIL");
    });
  });

  describe("Normalization & Parsing", () => {
    it("should extract normalized lowercase components and trim whitespace", () => {
      const result = SyntaxValidator.validate("  User.Name+Tag@Example.COM  ");
      expect(result.status).toBe("PASS");
      expect(result.normalizedEmail).toBe("User.Name+Tag@example.com");
      expect(result.localPart).toBe("User.Name+Tag");
      expect(result.domain).toBe("example.com");
    });
  });
});
