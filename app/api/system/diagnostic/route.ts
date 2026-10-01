import { NextRequest, NextResponse } from "next/server";
import net from "net";
import dns from "dns/promises";
import { SsrfGuard } from "@/server/verification/dns/ssrf-guard";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetDomain = (body.domain || "gmail.com").toLowerCase().trim();

    // 1. Resolve MX
    let mxHost = "";
    let mxIp = "";
    const dnsStart = Date.now();

    try {
      const mxRecords = await dns.resolveMx(targetDomain);
      if (mxRecords.length === 0) {
        return NextResponse.json({
          success: true,
          data: {
            domain: targetDomain,
            dns: "FAIL (No MX records found)",
            port25Status: "UNKNOWN",
          },
        });
      }
      mxRecords.sort((a, b) => a.priority - b.priority);
      mxHost = mxRecords[0].exchange;

      const ips = await dns.resolve4(mxHost);
      mxIp = ips[0];
    } catch (err: any) {
      return NextResponse.json({
        success: true,
        data: {
          domain: targetDomain,
          dns: `ERROR (${err.message})`,
          port25Status: "UNKNOWN",
          error: "DNS resolution failed",
        },
      });
    }

    const dnsLatency = Date.now() - dnsStart;

    // SSRF Check
    const allowPrivate = process.env.ALLOW_PRIVATE_IPS === "true";
    if (!SsrfGuard.isAllowedTarget(mxIp, allowPrivate)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "SSRF_BLOCKED", message: `Target IP ${mxIp} is in a restricted/private network range.` },
        },
        { status: 400 }
      );
    }

    // 2. Test TCP connect on Port 25
    const port25Start = Date.now();
    let port25Status = "AVAILABLE";
    let banner = "";
    let latencyMs = 0;
    let errorDetail: string | undefined;

    await new Promise<void>((resolve) => {
      const socket = net.createConnection({ host: mxIp, port: 25 }, () => {
        latencyMs = Date.now() - port25Start;
      });

      socket.setTimeout(6000);

      socket.on("data", (chunk) => {
        banner = chunk.toString("utf-8").trim().slice(0, 500);
        socket.write("QUIT\r\n");
        socket.end();
        resolve();
      });

      socket.on("timeout", () => {
        port25Status = "BLOCKED / TIMEOUT";
        errorDetail = "Connection timed out. Outbound TCP port 25 is likely blocked by your hosting provider or ISP.";
        socket.destroy();
        resolve();
      });

      socket.on("error", (err) => {
        port25Status = "BLOCKED / ERROR";
        errorDetail = `Socket error: ${err.message}. Port 25 outbound may be blocked.`;
        socket.destroy();
        resolve();
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: targetDomain,
        mxHost,
        mxIp,
        dnsLatencyMs: dnsLatency,
        port25Status,
        banner: banner || undefined,
        latencyMs: latencyMs || undefined,
        errorDetail,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "DIAGNOSTIC_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
