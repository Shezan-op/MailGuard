import net from "net";
import tls from "tls";
import dns from "dns/promises";
import { SmtpEventLog, SmtpResult } from "../types";
import { SmtpParser } from "./smtp-parser";
import { SmtpClassifier } from "./smtp-classifier";
import { SsrfGuard } from "../dns/ssrf-guard";

export interface SmtpProbeOptions {
  host: string;
  ip?: string;
  port?: number;
  heloDomain?: string;
  mailFrom?: string;
  timeoutMs?: number;
  enableStarttls?: boolean;
  allowPrivateIps?: boolean;
}

export class SmtpClient {
  /**
   * Executes a controlled SMTP probe for a recipient mailbox without sending DATA.
   */
  static async probeRecipient(email: string, options: SmtpProbeOptions): Promise<SmtpResult> {
    const port = options.port ?? 25;
    const rawTarget = options.ip || options.host;
    const heloDomain = options.heloDomain || "mailguard.local";
    const mailFrom = options.mailFrom || "verify@mailguard.local";
    const timeoutMs = options.timeoutMs ?? 10000;
    const enableStarttls = options.enableStarttls ?? true;
    const allowPrivate = options.allowPrivateIps ?? (process.env.ALLOW_PRIVATE_IPS === "true");

    const events: SmtpEventLog[] = [];
    let currentSocket: net.Socket | tls.TLSSocket | null = null;
    let buffer = "";
    let supportsStarttls = false;

    const startTime = Date.now();

    const recordEvent = (
      stage: SmtpEventLog["stage"],
      command?: string,
      code?: number,
      response?: string,
      latency?: number
    ) => {
      events.push({
        stage,
        command,
        code,
        response: response ? SmtpParser.sanitize(response) : undefined,
        latencyMs: latency ?? (Date.now() - startTime),
        timestamp: new Date().toISOString(),
      });
    };

    // 1. SSRF Guard Pre-flight Validation
    let connectIp = rawTarget;
    try {
      if (!net.isIP(rawTarget)) {
        // Target is a domain name; resolve to IP before connecting
        const lookup = await dns.lookup(rawTarget);
        connectIp = lookup.address;
      }

      if (!SsrfGuard.isAllowedTarget(connectIp, allowPrivate)) {
        return {
          status: "CONNECTION_ERROR",
          stage: "TCP_SOCKET_ERROR",
          reason: `Target ${rawTarget} (${connectIp}) blocked by SSRF protection`,
          retryable: false,
          supportsStarttls: false,
          events: [
            {
              stage: "CONNECT",
              command: `CONNECT ${connectIp}:${port} [BLOCKED_BY_SSRF]`,
              latencyMs: 0,
              timestamp: new Date().toISOString(),
            },
          ],
          latencyMs: 0,
        };
      }
    } catch (dnsErr: any) {
      return {
        status: "CONNECTION_ERROR",
        stage: "CONNECT_INIT_ERROR",
        reason: `Failed to resolve SMTP host ${rawTarget}: ${dnsErr.message}`,
        retryable: true,
        supportsStarttls: false,
        events: [],
        latencyMs: 0,
      };
    }

    return new Promise<SmtpResult>((resolve) => {
      let resolved = false;

      // Set overall operation timeout
      const overallTimer = setTimeout(() => {
        finish({
          status: "TIMEOUT",
          stage: "TIMEOUT",
          reason: `SMTP negotiation timed out after ${timeoutMs}ms`,
          retryable: true,
        });
      }, timeoutMs);

      const finish = (result: Partial<SmtpResult>) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(overallTimer);

        if (currentSocket && !currentSocket.destroyed) {
          try {
            currentSocket.write("QUIT\r\n");
            currentSocket.end();
            setTimeout(() => {
              try {
                if (currentSocket && !currentSocket.destroyed) {
                  currentSocket.destroy();
                }
              } catch {}
            }, 200);
          } catch {
            try {
              currentSocket.destroy();
            } catch {}
          }
        }

        const totalLatency = Date.now() - startTime;
        resolve({
          status: result.status || "UNKNOWN",
          code: result.code,
          response: result.response ? SmtpParser.sanitize(result.response) : undefined,
          stage: result.stage,
          latencyMs: totalLatency,
          retryable: result.retryable ?? false,
          supportsStarttls,
          events,
          reason: result.reason,
        });
      };

      // Helper to read until a complete SMTP response arrives with error and close protection
      const readResponse = (stepTimeoutMs = timeoutMs): Promise<{ code: number; message: string; capabilities: string[] }> => {
        return new Promise((resRead, rejRead) => {
          let stepTimer: NodeJS.Timeout | null = null;

          const cleanup = () => {
            if (stepTimer) clearTimeout(stepTimer);
            if (currentSocket) {
              currentSocket.off("data", onData);
              currentSocket.off("error", onError);
              currentSocket.off("close", onClose);
              currentSocket.off("end", onClose);
            }
          };

          const onData = (chunk: Buffer) => {
            buffer += chunk.toString("utf-8");
            // Bound memory buffer to 64KB
            if (buffer.length > 65536) {
              cleanup();
              rejRead(new Error("Oversized SMTP response stream exceeding 64KB limit"));
              return;
            }

            const parsed = SmtpParser.parse(buffer);
            if (parsed && parsed.isComplete) {
              buffer = "";
              cleanup();
              resRead(parsed);
            }
          };

          const onError = (err: Error) => {
            cleanup();
            rejRead(new Error(`Socket error during read: ${err.message}`));
          };

          const onClose = () => {
            cleanup();
            rejRead(new Error("Remote SMTP server closed connection prematurely"));
          };

          stepTimer = setTimeout(() => {
            cleanup();
            rejRead(new Error(`Read timeout waiting for SMTP response after ${stepTimeoutMs}ms`));
          }, stepTimeoutMs);

          if (currentSocket) {
            currentSocket.on("data", onData);
            currentSocket.once("error", onError);
            currentSocket.once("close", onClose);
            currentSocket.once("end", onClose);
          }
        });
      };

      // Helper to send command safely
      const sendCommand = (cmd: string) => {
        if (!currentSocket || currentSocket.destroyed) {
          throw new Error("Socket disconnected unexpectedly");
        }
        currentSocket.write(cmd + "\r\n");
      };

      // Create TCP Connection
      try {
        const rawSocket = net.createConnection({ host: connectIp, port });
        currentSocket = rawSocket;

        rawSocket.on("connect", async () => {
          recordEvent("CONNECT", `CONNECT ${connectIp}:${port}`);

          try {
            // 1. Read Greeting Banner (220)
            const greeting = await readResponse();
            recordEvent("GREETING", undefined, greeting.code, greeting.message);

            if (greeting.code !== 220) {
              const classification = SmtpClassifier.classify(greeting.code, greeting.message);
              return finish({
                status: classification.status,
                code: greeting.code,
                response: greeting.message,
                stage: "GREETING",
                retryable: classification.retryable,
                reason: classification.reason,
              });
            }

            // 2. Send EHLO (with HELO fallback if rejected)
            sendCommand(`EHLO ${heloDomain}`);
            let ehlo = await readResponse();
            recordEvent("EHLO", `EHLO ${heloDomain}`, ehlo.code, ehlo.message);

            // RFC 5321 Fallback: If EHLO rejected with 500/501/502/504, attempt HELO
            if (ehlo.code >= 500 && ehlo.code <= 504) {
              sendCommand(`HELO ${heloDomain}`);
              ehlo = await readResponse();
              recordEvent("EHLO", `HELO ${heloDomain}`, ehlo.code, ehlo.message);
            }

            if (ehlo.code >= 400) {
              const classification = SmtpClassifier.classify(ehlo.code, ehlo.message);
              return finish({
                status: classification.status,
                code: ehlo.code,
                response: ehlo.message,
                stage: "EHLO",
                retryable: classification.retryable,
                reason: `EHLO/HELO rejected: ${classification.reason}`,
              });
            }

            // Check if STARTTLS is advertised
            supportsStarttls = ehlo.capabilities.some((c) => c.includes("STARTTLS"));

            // 3. Optional STARTTLS Upgrade
            if (enableStarttls && supportsStarttls) {
              try {
                sendCommand("STARTTLS");
                const tlsReady = await readResponse();
                recordEvent("STARTTLS", "STARTTLS", tlsReady.code, tlsReady.message);

                if (tlsReady.code === 220) {
                  // Upgrade TCP socket to TLS socket
                  rawSocket.removeAllListeners("data");
                  const tlsSocket = tls.connect({
                    socket: rawSocket,
                    host: options.host,
                    rejectUnauthorized: false, // Opportunistic TLS
                  });

                  currentSocket = tlsSocket;

                  tlsSocket.on("error", (err) => {
                    finish({
                      status: "CONNECTION_ERROR",
                      stage: "TLS_SOCKET_ERROR",
                      reason: `TLS socket error: ${err.message}`,
                      retryable: true,
                    });
                  });

                  await new Promise<void>((tlsResolve, tlsReject) => {
                    tlsSocket.once("secureConnect", () => tlsResolve());
                    tlsSocket.once("error", (err) => tlsReject(err));
                  });

                  // Re-send EHLO after TLS handshake (RFC 3207)
                  sendCommand(`EHLO ${heloDomain}`);
                  const tlsEhlo = await readResponse();
                  recordEvent("EHLO", `EHLO ${heloDomain} (TLS)`, tlsEhlo.code, tlsEhlo.message);
                }
              } catch (tlsErr: any) {
                recordEvent("STARTTLS", "STARTTLS [FAILED_HANDSHAKE]", 454, tlsErr.message);
                // Non-fatal if server allows continuing plaintext or graceful abort
              }
            }

            // 4. Send MAIL FROM
            const mailFromCmd = `MAIL FROM:<${mailFrom}>`;
            sendCommand(mailFromCmd);
            const mailFromResp = await readResponse();
            recordEvent("MAIL_FROM", mailFromCmd, mailFromResp.code, mailFromResp.message);

            if (mailFromResp.code >= 400) {
              const classification = SmtpClassifier.classify(mailFromResp.code, mailFromResp.message);
              return finish({
                status: classification.status,
                code: mailFromResp.code,
                response: mailFromResp.message,
                stage: "MAIL_FROM",
                retryable: classification.retryable,
                reason: `Sender rejected at MAIL FROM: ${classification.reason}`,
              });
            }

            // 5. Send RCPT TO
            const rcptToCmd = `RCPT TO:<${email}>`;
            const rcptStart = Date.now();
            sendCommand(rcptToCmd);
            const rcptResp = await readResponse();
            const rcptLatency = Date.now() - rcptStart;
            recordEvent("RCPT_TO", rcptToCmd, rcptResp.code, rcptResp.message, rcptLatency);

            // 6. Send QUIT (Best effort)
            try {
              sendCommand("QUIT");
              recordEvent("QUIT", "QUIT");
            } catch {}

            // Classify RCPT TO response
            const classification = SmtpClassifier.classify(rcptResp.code, rcptResp.message);
            finish({
              status: classification.status,
              code: rcptResp.code,
              response: rcptResp.message,
              stage: "RCPT_TO",
              retryable: classification.retryable,
              reason: classification.reason,
            });
          } catch (err: any) {
            finish({
              status: "CONNECTION_ERROR",
              stage: "PROBE_EXCEPTION",
              reason: err.message || "Error during SMTP protocol sequence",
              retryable: true,
            });
          }
        });

        rawSocket.on("error", (err) => {
          finish({
            status: "CONNECTION_ERROR",
            stage: "TCP_SOCKET_ERROR",
            reason: `TCP socket error connecting to ${connectIp}:${port} - ${err.message}`,
            retryable: true,
          });
        });
      } catch (err: any) {
        finish({
          status: "CONNECTION_ERROR",
          stage: "CONNECT_INIT_ERROR",
          reason: `Failed to initialize connection: ${err.message}`,
          retryable: true,
        });
      }
    });
  }
}
