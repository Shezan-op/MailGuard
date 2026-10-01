import { describe, it, expect, beforeAll, afterAll } from "vitest";
import net from "net";
import { CatchAllDetector } from "@/server/verification/catchall/catchall-detector";

describe("Catch-All Concurrency & Race Condition Elimination", () => {
  let probeCount = 0;
  let server: net.Server;
  let port: number;

  beforeAll(async () => {
    // Ephemeral SMTP server that counts catch-all synthetic probes
    server = net.createServer((socket) => {
      socket.write("220 catchall-race.local ESMTP\r\n");
      let buffer = "";

      socket.on("error", () => {});
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf-8");
        if (buffer.includes("\r\n")) {
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            const upper = line.trim().toUpperCase();
            if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
              if (socket.writable && !socket.destroyed) socket.write("250-catchall-race.local\r\n250 OK\r\n");
            } else if (upper.startsWith("MAIL FROM:")) {
              if (socket.writable && !socket.destroyed) socket.write("250 Sender OK\r\n");
            } else if (upper.startsWith("RCPT TO:")) {
              probeCount++;
              // Simulate small network delay to test in-flight concurrency overlap
              setTimeout(() => {
                if (socket.writable && !socket.destroyed) {
                  try { socket.write("250 2.1.5 Recipient Accepted (Catch-All)\r\n"); } catch {}
                }
              }, 40);
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

    port = await new Promise<number>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve((server.address() as net.AddressInfo).port);
      });
    });
  });

  afterAll(() => {
    server.close();
  });

  it("PROVE: 50 concurrent requests to the same domain trigger exactly 1 catch-all probe", async () => {
    CatchAllDetector.clearCache();
    probeCount = 0;

    const domain = "concurrency-test.local";
    const probeOptions = {
      host: "127.0.0.1",
      port,
      timeoutMs: 5000,
      allowPrivateIps: true,
      enableStarttls: false,
    };

    // Dispatch 50 simultaneous checks for the same domain
    const promises = Array.from({ length: 50 }, () =>
      CatchAllDetector.checkCatchAll(domain, probeOptions)
    );

    const results = await Promise.all(promises);

    // All 50 promises should resolve successfully
    expect(results).toHaveLength(50);
    for (const r of results) {
      expect(r.isCatchAll).toBe(true);
      expect(r.confidence).toBe("HIGH");
    }

    // Crucial proof: Despite 50 concurrent callers, exactly 1 SMTP probe was made
    expect(probeCount).toBe(1);
  });
});
