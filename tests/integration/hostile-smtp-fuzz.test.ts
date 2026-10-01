import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { SmtpClient } from "@/server/verification/smtp/smtp-client";
import { SmtpParser } from "@/server/verification/smtp/smtp-parser";
import { SmtpClassifier } from "@/server/verification/smtp/smtp-classifier";

describe("Hostile SMTP Failure Injection & Fuzzing", () => {
  // Helper to run a custom ephemeral mock SMTP server for testing hostile socket behaviors
  const createMockServer = (handler: (socket: net.Socket) => void): Promise<{ server: net.Server; port: number }> => {
    return new Promise((resolve) => {
      const server = net.createServer((socket) => {
        socket.on("error", () => {});
        handler(socket);
      });
      server.listen(0, "127.0.0.1", () => {
        const port = (server.address() as net.AddressInfo).port;
        resolve({ server, port });
      });
    });
  };

  it("FAIL INJECTION: Disconnect immediately before sending greeting banner", async () => {
    const { server, port } = await createMockServer((socket) => {
      socket.destroy(); // Immediate drop
    });

    try {
      const res = await SmtpClient.probeRecipient("test@hostile.local", {
        host: "127.0.0.1",
        port,
        timeoutMs: 2000,
        allowPrivateIps: true,
      });

      expect(res.status).toBe("CONNECTION_ERROR");
      expect(res.retryable).toBe(true);
    } finally {
      server.close();
    }
  });

  it("FAIL INJECTION: Disconnect immediately after sending 220 greeting", async () => {
    const { server, port } = await createMockServer((socket) => {
      socket.write("220 hostile.local ESMTP Ready\r\n");
      setTimeout(() => {
        try { socket.destroy(); } catch {}
      }, 50);
    });

    try {
      const res = await SmtpClient.probeRecipient("test@hostile.local", {
        host: "127.0.0.1",
        port,
        timeoutMs: 2000,
        allowPrivateIps: true,
      });

      expect(res.status).toBe("CONNECTION_ERROR");
      expect(res.retryable).toBe(true);
    } finally {
      server.close();
    }
  });

  it("FAIL INJECTION: Malformed non-numeric greeting banner", async () => {
    const { server, port } = await createMockServer((socket) => {
      socket.write("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nHello");
      socket.on("data", () => {
        try { socket.destroy(); } catch {}
      });
    });

    try {
      const res = await SmtpClient.probeRecipient("test@hostile.local", {
        host: "127.0.0.1",
        port,
        timeoutMs: 2000,
        allowPrivateIps: true,
      });

      // Should not crash and should fail gracefully
      expect(res.status).toBeDefined();
      expect(res.retryable).toBe(true);
    } finally {
      server.close();
    }
  });

  it("FAIL INJECTION: EHLO rejected (500) -> HELO fallback succeeds (250)", async () => {
    let receivedHelo = false;

    const { server, port } = await createMockServer((socket) => {
      socket.write("220 helo-fallback.local ESMTP\r\n");
      let buffer = "";

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        if (buffer.includes("\r\n")) {
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const upper = line.trim().toUpperCase();
            if (upper.startsWith("EHLO")) {
              if (socket.writable && !socket.destroyed) socket.write("500 5.5.1 Unrecognized command EHLO\r\n");
            } else if (upper.startsWith("HELO")) {
              receivedHelo = true;
              if (socket.writable && !socket.destroyed) socket.write("250 helo-fallback.local Hello\r\n");
            } else if (upper.startsWith("MAIL FROM:")) {
              if (socket.writable && !socket.destroyed) socket.write("250 Sender OK\r\n");
            } else if (upper.startsWith("RCPT TO:")) {
              if (socket.writable && !socket.destroyed) socket.write("250 Recipient OK\r\n");
            } else if (upper === "QUIT") {
              if (socket.writable && !socket.destroyed) {
                try { socket.write("221 Bye\r\n"); } catch {}
              }
              try { socket.end(); } catch {}
            }
          }
        }
      });
    });

    try {
      const res = await SmtpClient.probeRecipient("valid@helo-fallback.local", {
        host: "127.0.0.1",
        port,
        timeoutMs: 3000,
        allowPrivateIps: true,
        enableStarttls: false,
      });

      expect(receivedHelo).toBe(true);
      expect(res.status).toBe("ACCEPTED");
      expect(res.code).toBe(250);
    } finally {
      server.close();
    }
  });

  it("FAIL INJECTION: RCPT TO response codes comprehensive classification matrix", async () => {
    const testCases: { code: number; text: string; expectedStatus: string; expectedRetryable: boolean }[] = [
      { code: 250, text: "2.1.5 Recipient OK", expectedStatus: "ACCEPTED", expectedRetryable: false },
      { code: 251, text: "2.1.5 User not local; will forward", expectedStatus: "ACCEPTED", expectedRetryable: false },
      { code: 252, text: "2.1.5 Cannot verify recipient", expectedStatus: "UNKNOWN", expectedRetryable: false },
      { code: 421, text: "4.4.2 Service unavailable, closing transmission channel", expectedStatus: "TEMPORARY_FAILURE", expectedRetryable: true },
      { code: 450, text: "4.2.0 Mailbox unavailable, greylisted", expectedStatus: "TEMPORARY_FAILURE", expectedRetryable: true },
      { code: 451, text: "4.3.0 Local error in processing", expectedStatus: "TEMPORARY_FAILURE", expectedRetryable: true },
      { code: 452, text: "4.2.2 Mailbox full", expectedStatus: "TEMPORARY_FAILURE", expectedRetryable: true },
      { code: 500, text: "5.5.2 Syntax error, command unrecognized", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 501, text: "5.5.4 Syntax error in parameters", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 503, text: "5.5.1 Bad sequence of commands", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 521, text: "5.2.1 Host does not accept mail", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 550, text: "5.1.1 User unknown", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 551, text: "5.1.1 User not local", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 552, text: "5.2.2 Exceeded storage allocation", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 553, text: "5.1.3 Mailbox name invalid", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 554, text: "5.7.1 Transaction failed", expectedStatus: "REJECTED", expectedRetryable: false },
      { code: 554, text: "5.7.1 Connection blocked by Spamhaus ZEN", expectedStatus: "BLOCKED", expectedRetryable: false },
    ];

    for (const tc of testCases) {
      const classification = SmtpClassifier.classify(tc.code, tc.text);
      expect(classification.status).toBe(tc.expectedStatus);
      expect(classification.retryable).toBe(tc.expectedRetryable);
    }
  });

  it("FAIL INJECTION: Oversized stream (100KB) triggers buffer guard without memory explosion", async () => {
    const { server, port } = await createMockServer((socket) => {
      // Send 100KB of repeated 'A's without CRLF
      socket.write("220 ");
      const chunk = "A".repeat(1024);
      for (let i = 0; i < 100; i++) {
        socket.write(chunk);
      }
    });

    try {
      const res = await SmtpClient.probeRecipient("test@hostile.local", {
        host: "127.0.0.1",
        port,
        timeoutMs: 3000,
        allowPrivateIps: true,
      });

      expect(res.status).toBe("CONNECTION_ERROR");
      expect(res.reason).toContain("exceeding 64KB limit");
    } finally {
      server.close();
    }
  });

  it("FAIL INJECTION: Fuzz parser with randomized garbage byte sequences", () => {
    // Generate 50 iterations of randomized byte chunks
    for (let i = 0; i < 50; i++) {
      const len = Math.floor(Math.random() * 500) + 10;
      let randomStr = "";
      for (let j = 0; j < len; j++) {
        randomStr += String.fromCharCode(Math.floor(Math.random() * 256));
      }

      // Parser must never throw or crash on fuzzed input
      expect(() => {
        const parsed = SmtpParser.parse(randomStr);
        if (parsed) {
          expect(typeof parsed.code).toBe("number");
          expect(typeof parsed.message).toBe("string");
        }
      }).not.toThrow();
    }
  });

  it("FAIL INJECTION: Log sanitization strips CR, LF, and null bytes to prevent log injection", () => {
    const maliciousInput = "250 OK\r\nFAKE_LOG_ENTRY: [SECURITY] Root login succeeded\x00\x1B[31m";
    const sanitized = SmtpParser.sanitize(maliciousInput);

    expect(sanitized).not.toContain("\r");
    expect(sanitized).not.toContain("\n");
    expect(sanitized).not.toContain("\0");
    expect(sanitized).toContain("250 OK FAKE_LOG_ENTRY");
  });
});
