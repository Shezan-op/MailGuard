import { describe, it, beforeAll, afterAll, expect } from "vitest";
import { FakeSmtpServer } from "../smtp/fake-smtp-server";
import { SmtpClient } from "@/server/verification/smtp/smtp-client";
import { CatchAllDetector } from "@/server/verification/catchall/catchall-detector";

describe("SMTP Verification Integration with FakeSmtpServer", () => {
  let fakeSmtp: FakeSmtpServer;
  let smtpPort: number;

  beforeAll(async () => {
    fakeSmtp = new FakeSmtpServer({ port: 0 }); // pick an open ephemeral port
    smtpPort = await fakeSmtp.start();
  });

  afterAll(async () => {
    await fakeSmtp.stop();
  });

  it("should successfully accept a valid recipient (250 OK)", async () => {
    const result = await SmtpClient.probeRecipient("john@acme.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 4000,
      enableStarttls: false,
    });

    expect(result.status).toBe("ACCEPTED");
    expect(result.code).toBe(250);
    expect(result.response).toContain("Recipient OK");
    expect(result.retryable).toBe(false);
    expect(result.events.length).toBeGreaterThanOrEqual(4); // CONNECT, GREETING, EHLO, MAIL FROM, RCPT TO
  });

  it("should detect a rejected mailbox (550 User unknown)", async () => {
    const result = await SmtpClient.probeRecipient("reject@acme.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 4000,
      enableStarttls: false,
    });

    expect(result.status).toBe("REJECTED");
    expect(result.code).toBe(550);
    expect(result.response).toContain("User unknown");
    expect(result.retryable).toBe(false);
  });

  it("should classify 450 greylisting as a retryable TEMPORARY_FAILURE", async () => {
    const result = await SmtpClient.probeRecipient("greylist@acme.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 4000,
      enableStarttls: false,
    });

    expect(result.status).toBe("TEMPORARY_FAILURE");
    expect(result.code).toBe(450);
    expect(result.retryable).toBe(true);
  });

  it("should detect catch-all domain when random addresses are accepted", async () => {
    CatchAllDetector.clearCache();

    const catchAllResult = await CatchAllDetector.checkCatchAll("catchall.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 4000,
      enableStarttls: false,
    });

    expect(catchAllResult.isCatchAll).toBe(true);
    expect(catchAllResult.confidence).toBe("HIGH");
  });

  it("should confirm non-catch-all domain when synthetic address is rejected (550)", async () => {
    CatchAllDetector.clearCache();

    const result = await CatchAllDetector.checkCatchAll("nocatchall.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 4000,
      enableStarttls: false,
    });

    expect(result.isCatchAll).toBe(false);
    expect(result.confidence).toBe("HIGH");
  });

  it("should handle socket timeout gracefully", async () => {
    const result = await SmtpClient.probeRecipient("timeout@acme.test", {
      host: "127.0.0.1",
      port: smtpPort,
      heloDomain: "test.local",
      mailFrom: "verify@test.local",
      timeoutMs: 1000, // short timeout
      enableStarttls: false,
    });

    expect(result.status).toBe("TIMEOUT");
    expect(result.retryable).toBe(true);
    expect(result.reason).toContain("timed out");
  });
});
