import crypto from "crypto";
import { CatchAllResult } from "../types";
import { SmtpClient, SmtpProbeOptions } from "../smtp/smtp-client";

interface DomainCatchAllCache {
  result: CatchAllResult;
  expiresAt: number;
}

export class CatchAllDetector {
  private static cache = new Map<string, DomainCatchAllCache>();
  private static inFlightProbes = new Map<string, Promise<CatchAllResult>>();

  /**
   * Generates a secure, cryptographically random non-existent mailbox name.
   */
  static generateRandomAddress(domain: string): string {
    const randomHex = crypto.randomBytes(16).toString("hex");
    return `__mg_catchall_${randomHex}@${domain.toLowerCase().trim()}`;
  }

  /**
   * Clears catch-all cache and in-flight tracking
   */
  static clearCache(): void {
    this.cache.clear();
    this.inFlightProbes.clear();
  }

  /**
   * Probes the domain for catch-all behavior by testing a cryptographically random address.
   * Uses in-flight coalescing to eliminate duplicate simultaneous probes.
   */
  static async checkCatchAll(
    domain: string,
    probeOptions: SmtpProbeOptions,
    options?: { bypassCache?: boolean; cacheTtlHours?: number }
  ): Promise<CatchAllResult> {
    const normalizedDomain = domain.toLowerCase().trim();
    const cacheTtl = (options?.cacheTtlHours ?? 24) * 3600 * 1000;

    // 1. Check in-memory cache
    if (!options?.bypassCache) {
      const cached = this.cache.get(normalizedDomain);
      if (cached && cached.expiresAt > Date.now()) {
        return cached.result;
      }
    }

    // 2. Coalesce concurrent in-flight probes to the same domain
    const existingProbe = this.inFlightProbes.get(normalizedDomain);
    if (existingProbe) {
      return existingProbe;
    }

    // 3. Initiate single probe
    const probePromise = (async (): Promise<CatchAllResult> => {
      const testAddress = this.generateRandomAddress(normalizedDomain);

      try {
        const probe = await SmtpClient.probeRecipient(testAddress, probeOptions);

        let result: CatchAllResult;

        if (probe.status === "ACCEPTED" && probe.code === 250) {
          result = {
            isCatchAll: true,
            confidence: "HIGH",
            testedAddress: testAddress,
            code: probe.code,
            response: probe.response,
          };
        } else if (probe.status === "REJECTED" && probe.code && probe.code >= 500) {
          result = {
            isCatchAll: false,
            confidence: "HIGH",
            testedAddress: testAddress,
            code: probe.code,
            response: probe.response,
          };
        } else {
          result = {
            isCatchAll: false,
            confidence: "LOW",
            testedAddress: testAddress,
            code: probe.code,
            response: probe.response,
          };
        }

        this.cache.set(normalizedDomain, { result, expiresAt: Date.now() + cacheTtl });
        return result;
      } catch {
        const fallbackResult: CatchAllResult = {
          isCatchAll: false,
          confidence: "LOW",
          testedAddress: testAddress,
        };
        return fallbackResult;
      }
    })();

    this.inFlightProbes.set(normalizedDomain, probePromise);

    try {
      return await probePromise;
    } finally {
      this.inFlightProbes.delete(normalizedDomain);
    }
  }
}
