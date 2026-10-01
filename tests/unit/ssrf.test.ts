import { describe, it, expect } from "vitest";
import { SsrfGuard } from "@/server/verification/dns/ssrf-guard";

describe("SSRF Guard", () => {
  describe("isPrivateOrReserved", () => {
    it("should identify IPv4 loopback", () => {
      expect(SsrfGuard.isPrivateOrReserved("127.0.0.1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("127.1.2.3")).toBe(true);
    });

    it("should identify RFC 1918 private ranges", () => {
      // 10.0.0.0/8
      expect(SsrfGuard.isPrivateOrReserved("10.0.0.1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("10.254.254.254")).toBe(true);

      // 172.16.0.0/12
      expect(SsrfGuard.isPrivateOrReserved("172.16.0.1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("172.31.255.255")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("172.32.0.1")).toBe(false); // public

      // 192.168.0.0/16
      expect(SsrfGuard.isPrivateOrReserved("192.168.1.1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("192.168.254.1")).toBe(true);
    });

    it("should identify link-local (cloud metadata) and carrier-grade NAT", () => {
      expect(SsrfGuard.isPrivateOrReserved("169.254.169.254")).toBe(true); // AWS/GCP metadata
      expect(SsrfGuard.isPrivateOrReserved("100.64.0.1")).toBe(true); // CGNAT
    });

    it("should identify 0.0.0.0 and broadcast", () => {
      expect(SsrfGuard.isPrivateOrReserved("0.0.0.0")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("255.255.255.255")).toBe(true);
    });

    it("should identify IPv6 loopback, link-local, and unique-local", () => {
      expect(SsrfGuard.isPrivateOrReserved("::1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("fe80::1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("fc00::1")).toBe(true);
      expect(SsrfGuard.isPrivateOrReserved("fd12:3456:789a::1")).toBe(true);
    });

    it("should allow valid public IP addresses", () => {
      expect(SsrfGuard.isPrivateOrReserved("8.8.8.8")).toBe(false);
      expect(SsrfGuard.isPrivateOrReserved("1.1.1.1")).toBe(false);
      expect(SsrfGuard.isPrivateOrReserved("142.250.190.46")).toBe(false);
    });
  });

  describe("isAllowedTarget", () => {
    it("should disallow private IP when allowPrivate=false", () => {
      expect(SsrfGuard.isAllowedTarget("127.0.0.1", false)).toBe(false);
      expect(SsrfGuard.isAllowedTarget("10.1.2.3", false)).toBe(false);
    });

    it("should allow private IP when allowPrivate=true (for testing)", () => {
      expect(SsrfGuard.isAllowedTarget("127.0.0.1", true)).toBe(true);
    });

    it("should allow public IP regardless of allowPrivate setting", () => {
      expect(SsrfGuard.isAllowedTarget("8.8.8.8", false)).toBe(true);
      expect(SsrfGuard.isAllowedTarget("8.8.8.8", true)).toBe(true);
    });
  });
});
