import fs from "fs";
import path from "path";
import { getDb } from "../../db";
import { disposableDomains } from "../../db/schema";
import { eq } from "drizzle-orm";

export class DisposableDomainService {
  private static domainSet: Set<string> | null = null;
  private static initialized = false;

  /**
   * Initializes the in-memory cache of disposable domains from JSON dataset and database.
   */
  static async init(): Promise<void> {
    if (this.initialized && this.domainSet) {
      return;
    }

    this.domainSet = new Set<string>();

    // 1. Load from vendored JSON file
    try {
      const jsonPath = path.join(process.cwd(), "data", "disposable-domains.json");
      if (fs.existsSync(jsonPath)) {
        const raw = fs.readFileSync(jsonPath, "utf-8");
        const list: string[] = JSON.parse(raw);
        for (const d of list) {
          this.domainSet.add(d.toLowerCase().trim());
        }
      }
    } catch (e) {
      console.warn("[MailGuard] Could not read disposable-domains.json:", e);
    }

    // 2. Load custom additions from DB
    try {
      const db = getDb();
      const records = await db.select({ domain: disposableDomains.domain, active: disposableDomains.active }).from(disposableDomains);
      for (const rec of records) {
        if (rec.active) {
          this.domainSet.add(rec.domain.toLowerCase().trim());
        } else {
          this.domainSet.delete(rec.domain.toLowerCase().trim());
        }
      }
    } catch {}

    this.initialized = true;
  }

  /**
   * Checks if a domain is a known disposable/throwaway mail provider.
   */
  static isDisposable(domain: string): boolean {
    if (!this.domainSet) {
      // Synchronous lazy fallback to JSON if init hasn't completed
      this.domainSet = new Set<string>();
      try {
        const jsonPath = path.join(process.cwd(), "data", "disposable-domains.json");
        if (fs.existsSync(jsonPath)) {
          const list: string[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
          list.forEach((d) => this.domainSet!.add(d.toLowerCase().trim()));
        }
      } catch {}
    }

    const normalized = domain.toLowerCase().trim();
    if (this.domainSet.has(normalized)) {
      return true;
    }

    // Check if domain is a subdomain of a disposable domain (e.g., sub.mailinator.com)
    const parts = normalized.split(".");
    if (parts.length > 2) {
      const rootDomain = parts.slice(-2).join(".");
      if (this.domainSet.has(rootDomain)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Adds a domain to the disposable list (persists to DB).
   */
  static async addDomain(domain: string, source = "manual"): Promise<void> {
    const normalized = domain.toLowerCase().trim();
    if (!this.domainSet) {
      await this.init();
    }
    this.domainSet!.add(normalized);

    const db = getDb();
    await db
      .insert(disposableDomains)
      .values({
        domain: normalized,
        source,
        active: true,
      })
      .onConflictDoUpdate({
        target: disposableDomains.domain,
        set: { active: true },
      });
  }

  /**
   * Removes a domain from the active disposable list.
   */
  static async removeDomain(domain: string): Promise<void> {
    const normalized = domain.toLowerCase().trim();
    if (!this.domainSet) {
      await this.init();
    }
    this.domainSet!.delete(normalized);

    const db = getDb();
    await db
      .update(disposableDomains)
      .set({ active: false })
      .where(eq(disposableDomains.domain, normalized));
  }
}
