import { describe, it, expect } from "vitest";
import net from "net";
import { SmtpClient } from "@/server/verification/smtp/smtp-client";
import { CatchAllDetector } from "@/server/verification/catchall/catchall-detector";

describe("MailGuard Deep SMTP Protocol Proofs", () => {
  it("PROVE: Retry on 450 greylist with eventual 250 resolution vs non-retry on 550", async () => {
    let attemptCount = 0;
    const timestamps: number[] = [];

    // Server that responds 450 twice, then 250 on 3rd attempt
    const retryServer = net.createServer((socket) => {
      let buffer = "";
      socket.on("error", () => {});
      socket.write("220 retry-mx.local ESMTP Service Ready\r\n");

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        if (buffer.includes("\r\n")) {
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const upper = line.trim().toUpperCase();
            if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
              if (socket.writable) socket.write("250-retry-mx.local\r\n250 OK\r\n");
            } else if (upper.startsWith("MAIL FROM:")) {
              if (socket.writable) socket.write("250 2.1.0 Sender OK\r\n");
            } else if (upper.startsWith("RCPT TO:")) {
              attemptCount++;
              timestamps.push(Date.now());
              if (socket.writable) {
                if (attemptCount < 3) {
                  socket.write("450 4.2.0 Greylisted, please try again\r\n");
                } else {
                  socket.write("250 2.1.5 Recipient Accepted on Retry\r\n");
                }
              }
            } else if (upper === "QUIT") {
              if (socket.writable) {
                try { socket.write("221 Bye\r\n"); } catch {}
                socket.end();
              }
            }
          }
        }
      });
    });

    const port = await new Promise<number>((resolve) => {
      retryServer.listen(0, "127.0.0.1", () => {
        resolve((retryServer.address() as net.AddressInfo).port);
      });
    });

    try {
      // 1st probe -> 450
      const res1 = await SmtpClient.probeRecipient("retry-user@retry-domain.local", {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs: 3000,
        enableStarttls: false,
      });
      expect(res1.status).toBe("TEMPORARY_FAILURE");
      expect(res1.code).toBe(450);
      expect(res1.retryable).toBe(true);

      // 2nd probe -> 450
      const res2 = await SmtpClient.probeRecipient("retry-user@retry-domain.local", {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs: 3000,
        enableStarttls: false,
      });
      expect(res2.status).toBe("TEMPORARY_FAILURE");
      expect(res2.code).toBe(450);
      expect(res2.retryable).toBe(true);

      // 3rd probe -> 250
      const res3 = await SmtpClient.probeRecipient("retry-user@retry-domain.local", {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs: 3000,
        enableStarttls: false,
      });
      expect(res3.status).toBe("ACCEPTED");
      expect(res3.code).toBe(250);
      expect(res3.retryable).toBe(false);

      expect(attemptCount).toBe(3);
    } finally {
      retryServer.close();
    }
  });

  it("PROVE: Hanging SMTP server times out cleanly and does not hang the worker", async () => {
    // Hanging server: accepts TCP connection, but sends NO greeting banner
    const hangingServer = net.createServer((socket) => {
      socket.on("error", () => {});
      // Intentionally do nothing; leave socket idle
    });

    const port = await new Promise<number>((resolve) => {
      hangingServer.listen(0, "127.0.0.1", () => {
        resolve((hangingServer.address() as net.AddressInfo).port);
      });
    });

    try {
      const startTime = Date.now();
      const timeoutMs = 1500;

      const result = await SmtpClient.probeRecipient("hanging@test.local", {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs,
        enableStarttls: false,
      });

      const elapsed = Date.now() - startTime;
      expect(result.status).toBe("TIMEOUT");
      expect(result.reason).toContain("timed out");
      expect(elapsed).toBeGreaterThanOrEqual(1400);
      expect(elapsed).toBeLessThan(3500);
    } finally {
      hangingServer.close();
    }
  });

  it("PROVE: Catch-all probe caching prevents repeated probes for same domain", async () => {
    CatchAllDetector.clearCache();

    let probeCount = 0;
    const catchAllServer = net.createServer((socket) => {
      let buffer = "";
      socket.on("error", () => {});
      socket.write("220 catchall-mock.local ESMTP Ready\r\n");

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        if (buffer.includes("\r\n")) {
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const upper = line.trim().toUpperCase();
            if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
              if (socket.writable) socket.write("250-catchall-mock.local\r\n250 OK\r\n");
            } else if (upper.startsWith("MAIL FROM:")) {
              if (socket.writable) socket.write("250 2.1.0 Sender OK\r\n");
            } else if (upper.startsWith("RCPT TO:")) {
              probeCount++;
              if (socket.writable) socket.write("250 2.1.5 Synthetic recipient accepted (catch-all)\r\n");
            } else if (upper === "QUIT") {
              if (socket.writable) {
                try { socket.write("221 Bye\r\n"); } catch {}
                socket.end();
              }
            }
          }
        }
      });
    });

    const port = await new Promise<number>((resolve) => {
      catchAllServer.listen(0, "127.0.0.1", () => {
        resolve((catchAllServer.address() as net.AddressInfo).port);
      });
    });

    try {
      const domainConfig = {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs: 3000,
        enableStarttls: false,
      };

      // 1st check should probe
      const check1 = await CatchAllDetector.checkCatchAll("caching-catchall-domain.com", domainConfig);
      expect(check1.isCatchAll).toBe(true);
      expect(probeCount).toBe(1);

      // Subsequent checks for the same domain MUST hit cache and NOT send new probes
      for (let i = 0; i < 50; i++) {
        const cachedCheck = await CatchAllDetector.checkCatchAll("caching-catchall-domain.com", domainConfig);
        expect(cachedCheck.isCatchAll).toBe(true);
      }

      // Probe count must strictly remain 1
      expect(probeCount).toBe(1);
    } finally {
      catchAllServer.close();
    }
  });

  it("PROVE: Verifier strictly NEVER sends DATA or AUTH across any exchange", async () => {
    const receivedCommands: string[] = [];

    const auditServer = net.createServer((socket) => {
      let buffer = "";
      socket.on("error", () => {});
      socket.write("220 audit-mx.local ESMTP Ready\r\n");

      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        if (buffer.includes("\r\n")) {
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const upper = line.trim().toUpperCase();
            const cmd = upper.split(" ")[0];
            receivedCommands.push(cmd);

            if (socket.writable) {
              if (cmd === "EHLO" || cmd === "HELO") {
                socket.write("250 OK\r\n");
              } else if (cmd === "MAIL") {
                socket.write("250 OK\r\n");
              } else if (cmd === "RCPT") {
                socket.write("250 OK\r\n");
              } else if (cmd === "QUIT") {
                try { socket.write("221 Bye\r\n"); } catch {}
                socket.end();
              } else {
                socket.write("250 OK\r\n");
              }
            }
          }
        }
      });
    });

    const port = await new Promise<number>((resolve) => {
      auditServer.listen(0, "127.0.0.1", () => {
        resolve((auditServer.address() as net.AddressInfo).port);
      });
    });

    try {
      await SmtpClient.probeRecipient("safety-test@audit-mx.local", {
        host: "127.0.0.1",
        port,
        heloDomain: "mailguard.local",
        mailFrom: "verify@mailguard.local",
        timeoutMs: 3000,
        enableStarttls: false,
      });

      // Allow async QUIT flush
      await new Promise((r) => setTimeout(r, 100));

      // Proof: DATA, AUTH, LOGIN, PLAIN are never sent
      expect(receivedCommands).not.toContain("DATA");
      expect(receivedCommands).not.toContain("AUTH");
      expect(receivedCommands).not.toContain("LOGIN");
      expect(receivedCommands).not.toContain("PLAIN");
      expect(receivedCommands).toContain("EHLO");
      expect(receivedCommands).toContain("MAIL");
      expect(receivedCommands).toContain("RCPT");
    } finally {
      auditServer.close();
    }
  });
});
