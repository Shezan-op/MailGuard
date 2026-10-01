import net from "net";

export class SsrfGuard {
  /**
   * Checks whether an IP address is private, loopback, link-local, multicast, or reserved.
   */
  static isPrivateOrReserved(ip: string): boolean {
    if (!net.isIP(ip)) {
      return true; // Not a valid IP address, reject
    }

    if (net.isIPv4(ip)) {
      const parts = ip.split(".").map((p) => parseInt(p, 10));
      if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
        return true;
      }

      const [b0, b1] = parts;

      // 0.0.0.0/8 (Current network)
      if (b0 === 0) return true;

      // 127.0.0.0/8 (Loopback)
      if (b0 === 127) return true;

      // 10.0.0.0/8 (RFC 1918 Private)
      if (b0 === 10) return true;

      // 172.16.0.0/12 (RFC 1918 Private)
      if (b0 === 172 && b1 >= 16 && b1 <= 31) return true;

      // 192.168.0.0/16 (RFC 1918 Private)
      if (b0 === 192 && b1 === 168) return true;

      // 169.254.0.0/16 (Link-Local)
      if (b0 === 169 && b1 === 254) return true;

      // 100.64.0.0/10 (Carrier-grade NAT)
      if (b0 === 100 && b1 >= 64 && b1 <= 127) return true;

      // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24 (TEST-NET)
      if (b0 === 192 && b1 === 0 && parts[2] === 2) return true;
      if (b0 === 198 && b1 === 51 && parts[2] === 100) return true;
      if (b0 === 203 && b1 === 0 && parts[2] === 113) return true;

      // 224.0.0.0/4 (Multicast)
      if (b0 >= 224 && b0 <= 239) return true;

      // 240.0.0.0/4 (Reserved)
      if (b0 >= 240) return true;

      return false;
    }

    if (net.isIPv6(ip)) {
      const lower = ip.toLowerCase();

      // ::1 (Loopback)
      if (lower === "::1") return true;

      // :: (Unspecified)
      if (lower === "::" || lower === "0:0:0:0:0:0:0:0") return true;

      // fe80::/10 (Link-Local unicast)
      if (lower.startsWith("fe8") || lower.startsWith("fe9") || lower.startsWith("fea") || lower.startsWith("feb")) {
        return true;
      }

      // fc00::/7 (Unique Local Address, IPv6 private)
      if (lower.startsWith("fc") || lower.startsWith("fd")) {
        return true;
      }

      // ff00::/8 (Multicast)
      if (lower.startsWith("ff")) {
        return true;
      }

      // IPv4-mapped IPv6 (::ffff:127.0.0.1)
      if (lower.startsWith("::ffff:")) {
        const v4Part = lower.slice(7);
        if (net.isIPv4(v4Part)) {
          return this.isPrivateOrReserved(v4Part);
        }
      }

      return false;
    }

    return true;
  }

  /**
   * Validates if a target IP can be connected to based on SSRF rules.
   */
  static isAllowedTarget(ip: string, allowPrivate = false): boolean {
    if (allowPrivate) {
      return true;
    }
    return !this.isPrivateOrReserved(ip);
  }
}
