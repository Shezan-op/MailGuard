import { describe, it, expect } from "vitest";
import { SmtpClassifier } from "@/server/verification/smtp/smtp-classifier";

describe("SmtpClassifier", () => {
  it("should classify 250 as ACCEPTED and not retryable", () => {
    const res = SmtpClassifier.classify(250, "2.1.5 Recipient OK");
    expect(res.status).toBe("ACCEPTED");
    expect(res.retryable).toBe(false);
  });

  it("should classify definitive 550 mailbox not found rejections", () => {
    const res1 = SmtpClassifier.classify(550, "5.1.1 User unknown");
    expect(res1.status).toBe("REJECTED");
    expect(res1.failureType).toBe("MAILBOX_NOT_FOUND");
    expect(res1.retryable).toBe(false);

    const res2 = SmtpClassifier.classify(550, "Mailbox unavailable");
    expect(res2.status).toBe("REJECTED");
    expect(res2.failureType).toBe("MAILBOX_NOT_FOUND");

    const res3 = SmtpClassifier.classify(554, "Recipient address rejected: Access denied - No such user");
    expect(res3.status).toBe("REJECTED");
    expect(res3.failureType).toBe("MAILBOX_NOT_FOUND");
  });

  it("should classify security/IP policy blocks", () => {
    const res = SmtpClassifier.classify(554, "5.7.1 Service unavailable, client host blocked by Spamhaus ZEN");
    expect(res.status).toBe("BLOCKED");
    expect(res.failureType).toBe("POLICY_BLOCKED");
    expect(res.retryable).toBe(false);
  });

  it("should classify 4xx greylisting and rate limits as retryable TEMPORARY_FAILURE", () => {
    const grey = SmtpClassifier.classify(450, "4.2.0 Greylisting in action, please try again in 5 minutes");
    expect(grey.status).toBe("TEMPORARY_FAILURE");
    expect(grey.retryable).toBe(true);
    expect(grey.failureType).toBe("GREYLISTED");

    const rate = SmtpClassifier.classify(451, "4.7.0 Too many concurrent connections; rate limit exceeded");
    expect(rate.status).toBe("TEMPORARY_FAILURE");
    expect(rate.retryable).toBe(true);
    expect(rate.failureType).toBe("RATE_LIMITED");

    const busy = SmtpClassifier.classify(421, "4.4.2 Server busy, try later");
    expect(busy.status).toBe("TEMPORARY_FAILURE");
    expect(busy.retryable).toBe(true);
    expect(busy.failureType).toBe("SERVER_BUSY");
  });
});
