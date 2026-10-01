export class DomainRateLimiter {
  private static activeByDomain = new Map<string, number>();
  private static domainCooldownUntil = new Map<string, number>();
  private static globalActiveCount = 0;

  /**
   * Tries to acquire a slot for a domain within global and domain concurrency limits.
   */
  static async acquireSlot(
    domain: string,
    options?: { maxGlobalConcurrency?: number; maxDomainConcurrency?: number; maxWaitMs?: number }
  ): Promise<boolean> {
    const normalized = domain.toLowerCase().trim();
    const maxGlobal = options?.maxGlobalConcurrency ?? 10;
    const maxDomain = options?.maxDomainConcurrency ?? 2;
    const maxWaitMs = options?.maxWaitMs ?? 15000;

    const start = Date.now();

    while (Date.now() - start < maxWaitMs) {
      const cooldownUntil = this.domainCooldownUntil.get(normalized) || 0;
      if (Date.now() < cooldownUntil) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }

      const currentDomainActive = this.activeByDomain.get(normalized) || 0;

      if (this.globalActiveCount < maxGlobal && currentDomainActive < maxDomain) {
        this.globalActiveCount++;
        this.activeByDomain.set(normalized, currentDomainActive + 1);
        return true;
      }

      // Wait 100ms before retrying slot acquisition
      await new Promise((r) => setTimeout(r, 100));
    }

    return false;
  }

  /**
   * Releases the active slot for a domain.
   */
  static releaseSlot(domain: string): void {
    const normalized = domain.toLowerCase().trim();
    this.globalActiveCount = Math.max(0, this.globalActiveCount - 1);

    const current = this.activeByDomain.get(normalized) || 0;
    if (current <= 1) {
      this.activeByDomain.delete(normalized);
    } else {
      this.activeByDomain.set(normalized, current - 1);
    }
  }

  /**
   * Applies cooldown delay to a domain after a 4xx temporary failure or rate-limit.
   */
  static setDomainCooldown(domain: string, cooldownMs = 5000): void {
    const normalized = domain.toLowerCase().trim();
    this.domainCooldownUntil.set(normalized, Date.now() + cooldownMs);
  }

  static getActiveCounts(): { global: number; domains: Record<string, number> } {
    const obj: Record<string, number> = {};
    this.activeByDomain.forEach((val, key) => {
      obj[key] = val;
    });
    return {
      global: this.globalActiveCount,
      domains: obj,
    };
  }
}
