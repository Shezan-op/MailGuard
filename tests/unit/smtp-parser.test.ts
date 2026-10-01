import { describe, it, expect } from "vitest";
import { SmtpParser } from "@/server/verification/smtp/smtp-parser";

describe("SmtpParser", () => {
  it("should parse standard single-line response", () => {
    const raw = "250 2.1.5 Recipient OK\r\n";
    const res = SmtpParser.parse(raw);
    expect(res).not.toBeNull();
    expect(res?.code).toBe(250);
    expect(res?.message).toBe("2.1.5 Recipient OK");
    expect(res?.isComplete).toBe(true);
    expect(res?.isMultiline).toBe(false);
  });

  it("should parse multi-line EHLO response with capabilities", () => {
    const raw = [
      "250-mail.example.com at your service",
      "250-SIZE 35882577",
      "250-8BITMIME",
      "250-STARTTLS",
      "250-ENHANCEDSTATUSCODES",
      "250 OK",
    ].join("\r\n");

    const res = SmtpParser.parse(raw);
    expect(res).not.toBeNull();
    expect(res?.code).toBe(250);
    expect(res?.isMultiline).toBe(true);
    expect(res?.isComplete).toBe(true);
    expect(res?.capabilities).toContain("STARTTLS");
    expect(res?.capabilities).toContain("8BITMIME");
  });

  it("should parse 550 permanent failure response", () => {
    const raw = "550 5.1.1 <john@example.com>: Recipient address rejected: User unknown in virtual mailbox table\r\n";
    const res = SmtpParser.parse(raw);
    expect(res).not.toBeNull();
    expect(res?.code).toBe(550);
    expect(res?.message).toContain("User unknown");
  });

  it("should handle empty or null input gracefully", () => {
    expect(SmtpParser.parse("")).toBeNull();
    // @ts-expect-error test null input
    expect(SmtpParser.parse(null)).toBeNull();
  });

  it("should truncate excessively long responses to 2000 chars", () => {
    const longMsg = "250 " + "A".repeat(2500) + "\r\n";
    const res = SmtpParser.parse(longMsg);
    expect(res).not.toBeNull();
    expect(res?.message.length).toBeLessThanOrEqual(2000);
    expect(res?.message).toContain("[truncated]");
  });

  it("should sanitize control characters", () => {
    const dirty = "250 OK\x00\x08With\x1FChars";
    const clean = SmtpParser.sanitize(dirty);
    expect(clean).toBe("250 OKWithChars");
  });
});
