import net from "net";

export interface FakeSmtpServerOptions {
  port?: number;
}

export class FakeSmtpServer {
  private server: net.Server | null = null;
  private port: number;
  private connections: Set<net.Socket> = new Set();

  constructor(options?: FakeSmtpServerOptions) {
    this.port = options?.port ?? 2525;
  }

  async start(): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      this.server = net.createServer((socket) => {
        this.connections.add(socket);
        let buffer = "";

        socket.on("close", () => {
          this.connections.delete(socket);
        });

        socket.on("error", () => {
          this.connections.delete(socket);
        });

        // Send 220 initial greeting banner
        socket.write("220 fake-mx.test.local ESMTP MailGuard Test Engine Ready\r\n");

        socket.on("data", (chunk) => {
          buffer += chunk.toString("utf-8");
          const lines = buffer.split("\r\n");
          buffer = lines.pop() || ""; // retain incomplete line in buffer

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            const upper = trimmed.toUpperCase();

            if (upper.startsWith("EHLO") || upper.startsWith("HELO")) {
              socket.write("250-fake-mx.test.local\r\n250-8BITMIME\r\n250-SIZE 35882577\r\n250 OK\r\n");
            } else if (upper.startsWith("MAIL FROM:")) {
              socket.write("250 2.1.0 Sender OK\r\n");
            } else if (upper.startsWith("RCPT TO:")) {
              const recipientMatch = trimmed.match(/<([^>]+)>/);
              const recipient = (recipientMatch ? recipientMatch[1] : "").toLowerCase();

              if (recipient.includes("timeout@")) {
                // Do not respond; let the client trigger a timeout
                return;
              } else if (recipient.includes("reject@") || recipient.includes("invalid-user@")) {
                socket.write("550 5.1.1 User unknown, recipient does not exist\r\n");
              } else if (recipient.includes("temp@") || recipient.includes("greylist@")) {
                socket.write("450 4.2.0 Greylisted, please try again later\r\n");
              } else if (recipient.includes("blocked@")) {
                socket.write("554 5.7.1 Service unavailable, client host blocked by spam filter\r\n");
              } else if (recipient.includes("@catchall.test")) {
                // Accepts any address including synthetic catchall
                socket.write("250 2.1.5 Recipient OK (Catch-all)\r\n");
              } else if (recipient.includes("__mg_catchall_") && recipient.includes("@nocatchall.test")) {
                socket.write("550 5.1.1 Synthetic address rejected\r\n");
              } else {
                // Default acceptance
                socket.write("250 2.1.5 Recipient OK\r\n");
              }
            } else if (upper === "QUIT") {
              socket.write("221 2.0.0 fake-mx.test.local closing connection\r\n");
              socket.end();
            } else if (upper === "RSET") {
              socket.write("250 2.0.0 OK\r\n");
            } else if (upper === "NOOP") {
              socket.write("250 2.0.0 OK\r\n");
            } else {
              socket.write("500 5.5.1 Unrecognized command\r\n");
            }
          }
        });
      });

      this.server.listen(this.port, "127.0.0.1", () => {
        const addr = this.server?.address() as net.AddressInfo;
        this.port = addr.port;
        resolve(this.port);
      });

      this.server.on("error", (err) => {
        reject(err);
      });
    });
  }

  async stop(): Promise<void> {
    for (const socket of this.connections) {
      socket.destroy();
    }
    this.connections.clear();

    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getPort(): number {
    return this.port;
  }
}
