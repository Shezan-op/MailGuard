import dns from "dns/promises";
import { DnsResult, MxRecord } from "../types";
import { SsrfGuard } from "./ssrf-guard";

interface CacheEntry {
  result: DnsResult;
  expiresAt: number;
}

export class DnsService {
  private static cache = new Map<string, CacheEntry>();

  /**
   * Clears in-memory DNS cache
   */
  static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Helper to execute a promise with a timeout
   */
  private static async withTimeout<T>(promise: Promise<T>, timeoutMs: number, operationName: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`DNS ${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timer!);
      return result;
    } catch (err) {
      clearTimeout(timer!);
      throw err;
    }
  }

  /**
   * Resolves MX and A/AAAA records for a given domain with timeout, caching, and SSRF checks.
   */
  static async resolveDomain(
    domain: string,
    options?: { timeoutMs?: number; allowPrivateIps?: boolean; bypassCache?: boolean; cacheTtlHours?: number }
  ): Promise<DnsResult> {
    const normalizedDomain = domain.toLowerCase().trim();
    const timeoutMs = options?.timeoutMs ?? 5000;
    const allowPrivate = options?.allowPrivateIps ?? (process.env.ALLOW_PRIVATE_IPS === "true");
    const cacheTtl = (options?.cacheTtlHours ?? 24) * 3600 * 1000;

    // Check cache
    if (!options?.bypassCache) {
      const cached = this.cache.get(normalizedDomain);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    try {
      // Step 1: Look up MX records
      let mxRecords: MxRecord[] = [];
      try {
        const rawMx = await this.withTimeout(dns.resolveMx(normalizedDomain), timeoutMs, "resolveMx");
        mxRecords = rawMx
          .map((r) => ({ exchange: r.exchange.toLowerCase().trim(), priority: r.priority }))
          .sort((a, b) => a.priority - b.priority);
      } catch (err: any) {
        // ENODATA or ENOTFOUND means no MX record exists
        if (err.code !== "ENODATA" && err.code !== "ENOTFOUND" && err.code !== "NOTFOUND") {
          // Check for timeout or hard DNS failure
          if (err.message?.includes("timed out")) {
            const timeoutResult: DnsResult = {
              status: "TIMEOUT",
              domainExists: false,
              mxRecords: [],
              reason: `DNS MX lookup timed out for ${normalizedDomain}`,
            };
            return timeoutResult;
          }
          if (err.code === "SERVFAIL" || err.code === "REFUSED") {
            const failResult: DnsResult = {
              status: "ERROR",
              domainExists: false,
              mxRecords: [],
              reason: `DNS server returned ${err.code} for ${normalizedDomain}`,
            };
            return failResult;
          }
        }
      }

      // Step 2: Handle RFC 7505 "Null MX" (exchange: "." or priority: 0 with empty/dot exchange)
      if (mxRecords.length === 1 && (mxRecords[0].exchange === "." || mxRecords[0].exchange === "")) {
        const nullMxResult: DnsResult = {
          status: "NULL_MX",
          domainExists: true,
          mxRecords: [],
          reason: "Domain publishes an RFC 7505 Null MX record explicitly declining email",
        };
        this.cache.set(normalizedDomain, { result: nullMxResult, expiresAt: Date.now() + cacheTtl });
        return nullMxResult;
      }

      // Step 3: If usable MX records found, resolve primary MX to IP (IPv4 or IPv6)
      if (mxRecords.length > 0) {
        for (const mx of mxRecords) {
          try {
            // Resolve IPv4 A record or IPv6 AAAA record of MX host
            let addresses: string[] = [];
            try {
              addresses = await this.withTimeout(dns.resolve4(mx.exchange), timeoutMs, `resolve4(${mx.exchange})`);
            } catch {
              try {
                addresses = await this.withTimeout(dns.resolve6(mx.exchange), timeoutMs, `resolve6(${mx.exchange})`);
              } catch {}
            }

            if (addresses && addresses.length > 0) {
              const primaryIp = addresses[0];

              // SSRF check
              if (!SsrfGuard.isAllowedTarget(primaryIp, allowPrivate)) {
                const ssrfResult: DnsResult = {
                  status: "ERROR",
                  domainExists: true,
                  mxRecords,
                  primaryMx: mx.exchange,
                  reason: `MX host ${mx.exchange} resolved to restricted/private IP ${primaryIp}`,
                };
                return ssrfResult;
              }

              const successResult: DnsResult = {
                status: "PASS",
                domainExists: true,
                mxRecords,
                primaryMx: mx.exchange,
                primaryMxIp: primaryIp,
              };

              this.cache.set(normalizedDomain, { result: successResult, expiresAt: Date.now() + cacheTtl });
              return successResult;
            }
          } catch {
            // Try next MX host in priority order
            continue;
          }
        }

        // MX records exist but none could be resolved to IP
        const noResolvedMxResult: DnsResult = {
          status: "ERROR",
          domainExists: true,
          mxRecords,
          reason: "MX hosts could not be resolved to IP addresses",
        };
        return noResolvedMxResult;
      }

      // Step 4: RFC 5321 Fallback - If no MX records exist, check A/AAAA record of domain
      let aRecords: string[] = [];
      let isNxdomain = false;

      try {
        aRecords = await this.withTimeout(dns.resolve4(normalizedDomain), timeoutMs, `resolve4(${normalizedDomain})`);
      } catch (err4: any) {
        if (err4.code === "ENOTFOUND" || err4.code === "NOTFOUND" || err4.code === "ENODATA") {
          isNxdomain = true;
        }
        try {
          aRecords = await this.withTimeout(dns.resolve6(normalizedDomain), timeoutMs, `resolve6(${normalizedDomain})`);
          isNxdomain = false;
        } catch (err6: any) {
          if (err6.code === "ENOTFOUND" || err6.code === "NOTFOUND" || err6.code === "ENODATA") {
            isNxdomain = true;
          }
        }
      }

      if (aRecords && aRecords.length > 0) {
        const fallbackIp = aRecords[0];

        if (!SsrfGuard.isAllowedTarget(fallbackIp, allowPrivate)) {
          return {
            status: "ERROR",
            domainExists: true,
            mxRecords: [],
            reason: `Fallback host ${normalizedDomain} resolved to restricted IP ${fallbackIp}`,
          };
        }

        const fallbackResult: DnsResult = {
          status: "NO_MX",
          domainExists: true,
          mxRecords: [{ exchange: normalizedDomain, priority: 0 }],
          primaryMx: normalizedDomain,
          primaryMxIp: fallbackIp,
          reason: "No MX record found; fallback to domain A/AAAA record per RFC 5321",
        };

        this.cache.set(normalizedDomain, { result: fallbackResult, expiresAt: Date.now() + cacheTtl });
        return fallbackResult;
      }

      if (isNxdomain) {
        const noDomainResult: DnsResult = {
          status: "FAIL",
          domainExists: false,
          mxRecords: [],
          reason: `Domain ${normalizedDomain} does not exist (NXDOMAIN)`,
        };
        this.cache.set(normalizedDomain, { result: noDomainResult, expiresAt: Date.now() + cacheTtl });
        return noDomainResult;
      }

      const noMxResult: DnsResult = {
        status: "NO_MX",
        domainExists: false,
        mxRecords: [],
        reason: `Domain ${normalizedDomain} has neither MX nor A records`,
      };
      this.cache.set(normalizedDomain, { result: noMxResult, expiresAt: Date.now() + cacheTtl });
      return noMxResult;
    } catch (err: any) {
      return {
        status: "ERROR",
        domainExists: false,
        mxRecords: [],
        reason: err.message || "DNS lookup failed",
      };
    }
  }

  /**
   * Diagnostic lookup for SPF, DMARC, and DKIM
   */
  static async checkEmailAuth(domain: string, dkimSelector?: string): Promise<{
    spf: { present: boolean; record?: string };
    dmarc: { present: boolean; record?: string };
    dkim: { checked: boolean; present: boolean; record?: string };
  }> {
    const normalizedDomain = domain.toLowerCase().trim();
    let spfRecord: string | undefined;
    let dmarcRecord: string | undefined;
    let dkimRecord: string | undefined;

    // Check SPF
    try {
      const txtRecords = await dns.resolveTxt(normalizedDomain);
      const flattened = txtRecords.map((chunk) => chunk.join(""));
      const spf = flattened.find((r) => r.startsWith("v=spf1"));
      if (spf) {
        spfRecord = spf;
      }
    } catch {}

    // Check DMARC
    try {
      const dmarcTxt = await dns.resolveTxt(`_dmarc.${normalizedDomain}`);
      const flattened = dmarcTxt.map((chunk) => chunk.join(""));
      const dmarc = flattened.find((r) => r.startsWith("v=DMARC1"));
      if (dmarc) {
        dmarcRecord = dmarc;
      }
    } catch {}

    // Check DKIM if selector is provided
    let dkimChecked = false;
    if (dkimSelector) {
      dkimChecked = true;
      try {
        const dkimTxt = await dns.resolveTxt(`${dkimSelector}._domainkey.${normalizedDomain}`);
        const flattened = dkimTxt.map((chunk) => chunk.join(""));
        const dkim = flattened.find((r) => r.includes("v=DKIM1") || r.includes("p="));
        if (dkim) {
          dkimRecord = dkim;
        }
      } catch {}
    }

    return {
      spf: { present: !!spfRecord, record: spfRecord },
      dmarc: { present: !!dmarcRecord, record: dmarcRecord },
      dkim: { checked: dkimChecked, present: !!dkimRecord, record: dkimRecord },
    };
  }
}
