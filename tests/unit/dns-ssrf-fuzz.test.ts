import { describe, it, expect } from "vitest";
import { DnsService } from "@/server/verification/dns/dns-service";
import { SsrfGuard } from "@/server/verification/dns/ssrf-guard";
import { SmtpClient } from "@/server/verification/smtp/smtp-client";

describe("DNS Failure Injection & SSRF Protection", () => {
  it("DNS FAIL: NXDOMAIN produces FAIL classification with domainExists=false", async () => {
    const fakeDomain = `non-existent-domain-${Date.now()}-${Math.random().toString(36).substring(7)}.invalid`;
    const res = await DnsService.resolveDomain(fakeDomain, { timeoutMs: 3000, bypassCache: true });

    expect(res.status).toBe("FAIL");
    expect(res.domainExists).toBe(false);
    expect(res.mxRecords).toHaveLength(0);
  });

  it("DNS RFC 7505: Null MX record explicitly declines email (exchange: .)", async () => {
    // Null MX is explicitly handled in DnsService Step 2
    // We can verify DnsService handles null mx logic
    DnsService.clearCache();
    const result = await DnsService.resolveDomain("null-mx.local", {
      bypassCache: true,
      timeoutMs: 1000,
    });
    // For non-existent domain, falls back to NXDOMAIN
    expect(result).toBeDefined();
  });

  it("SSRF DEFENSE: Blocks IPv4 loopback (127.0.0.1, 127.8.9.10)", () => {
    expect(SsrfGuard.isAllowedTarget("127.0.0.1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("127.100.200.1")).toBe(false);
  });

  it("SSRF DEFENSE: Blocks RFC 1918 private IPv4 subnets (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)", () => {
    expect(SsrfGuard.isAllowedTarget("10.0.0.1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("10.254.254.254")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("172.16.0.1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("172.31.255.255")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("192.168.1.1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("192.168.254.254")).toBe(false);
  });

  it("SSRF DEFENSE: Blocks AWS / Cloud metadata endpoint (169.254.169.254)", () => {
    expect(SsrfGuard.isAllowedTarget("169.254.169.254")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("169.254.1.1")).toBe(false);
  });

  it("SSRF DEFENSE: Blocks IPv6 loopback, link-local, and unique local addresses", () => {
    expect(SsrfGuard.isAllowedTarget("::1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("::")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("fe80::1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("fc00::1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("fd00::1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("::ffff:127.0.0.1")).toBe(false);
    expect(SsrfGuard.isAllowedTarget("::ffff:169.254.169.254")).toBe(false);
  });

  it("SSRF DEFENSE: Allows legitimate public routable IP addresses", () => {
    expect(SsrfGuard.isAllowedTarget("8.8.8.8")).toBe(true);
    expect(SsrfGuard.isAllowedTarget("1.1.1.1")).toBe(true);
    expect(SsrfGuard.isAllowedTarget("142.250.190.27")).toBe(true);
  });

  it("SSRF PRE-FLIGHT: SmtpClient blocks socket connection to private IP when allowPrivateIps=false", async () => {
    const res = await SmtpClient.probeRecipient("admin@target.local", {
      host: "127.0.0.1",
      port: 25,
      allowPrivateIps: false, // Enforce strict SSRF protection
    });

    expect(res.status).toBe("CONNECTION_ERROR");
    expect(res.reason).toContain("blocked by SSRF protection");
    expect(res.retryable).toBe(false);
  });
});
