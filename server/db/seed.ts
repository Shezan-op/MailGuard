import { getDb } from "./index";
import { settings, disposableDomains, dataVersions } from "./schema";
import { runMigrations } from "./migrate";
import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";

export async function seedDatabase(options?: { seedDemoData?: boolean }): Promise<void> {
  await runMigrations();
  const db = getDb();
  console.log("[MailGuard] Seeding initial configuration and intelligence datasets...");

  // 1. Seed Settings
  const defaultSettings = [
    { key: "HELO_DOMAIN", value: "mailguard.local", description: "FQDN used in SMTP EHLO/HELO greeting" },
    { key: "VERIFICATION_FROM_ADDRESS", value: "verify@mailguard.local", description: "Sender address used in SMTP MAIL FROM" },
    { key: "MAX_GLOBAL_CONCURRENCY", value: "10", description: "Maximum concurrent verification tasks across all workers" },
    { key: "MAX_DOMAIN_CONCURRENCY", value: "2", description: "Maximum concurrent SMTP connections per target domain" },
    { key: "SMTP_TIMEOUT_MS", value: "10000", description: "Timeout in milliseconds for SMTP socket operations" },
    { key: "DNS_TIMEOUT_MS", value: "5000", description: "Timeout in milliseconds for DNS lookups" },
    { key: "MAX_RETRIES", value: "3", description: "Maximum retries for temporary SMTP failures and greylisting" },
    { key: "RETRY_DELAY_MS", value: "5000", description: "Initial retry delay in milliseconds" },
    { key: "RETRY_BACKOFF_MULTIPLIER", value: "2", description: "Exponential backoff multiplier for retries" },
    { key: "CATCH_ALL_ENABLED", value: "true", description: "Whether to run synthetic catch-all mailbox probing" },
    { key: "TYPO_DETECTION_ENABLED", value: "true", description: "Whether to detect typos and suggest popular domain fixes" },
    { key: "DISPOSABLE_CHECK_ENABLED", value: "true", description: "Whether to flag known disposable/throwaway mail services" },
    { key: "ROLE_CHECK_ENABLED", value: "true", description: "Whether to flag role-based addresses (admin, sales, etc.)" },
    { key: "CACHE_TTL_HOURS", value: "24", description: "Cache TTL in hours for individual email verification results" },
    { key: "DOMAIN_CACHE_TTL_HOURS", value: "24", description: "Cache TTL in hours for domain intelligence and catch-all" },
    { key: "CONSERVATIVE_MODE", value: "true", description: "Enforces safer rate-limiting and stricter retry evaluations" },
    { key: "ALLOW_PRIVATE_IPS", value: process.env.ALLOW_PRIVATE_IPS || "false", description: "Allow connection to RFC1918 / loopback IPs (test mode only)" },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(settings)
      .values(s)
      .onConflictDoUpdate({
        target: settings.key,
        set: { description: s.description },
      });
  }

  // 2. Seed Disposable Domains
  const disposablePath = path.join(process.cwd(), "data", "disposable-domains.json");
  if (fs.existsSync(disposablePath)) {
    const raw = fs.readFileSync(disposablePath, "utf-8");
    const domainList: string[] = JSON.parse(raw);
    console.log(`[MailGuard] Seeding ${domainList.length} vendored disposable domains...`);

    // Insert in batches of 500
    const batchSize = 500;
    for (let i = 0; i < domainList.length; i += batchSize) {
      const batch = domainList.slice(i, i + batchSize).map((d) => ({
        domain: d.toLowerCase().trim(),
        source: "seed-2026",
        active: true,
      }));

      await db
        .insert(disposableDomains)
        .values(batch)
        .onConflictDoNothing();
    }

    await db
      .insert(dataVersions)
      .values({
        dataset: "disposable-domains",
        version: "2026.1",
        source: "Vendored Open-Source Disposable Dataset",
        recordCount: domainList.length,
      })
      .onConflictDoUpdate({
        target: dataVersions.dataset,
        set: {
          version: "2026.1",
          recordCount: domainList.length,
        },
      });
  }

  // 3. Demo seed data if requested
  if (options?.seedDemoData) {
    console.log("[MailGuard] Seeding sample demonstration data...");
    // Will insert sample addresses for testing UI and classification
  }

  console.log("[MailGuard] Database seeding complete.");
}

// Allow direct execution
if (process.argv[1]?.endsWith("seed.ts")) {
  seedDatabase()
    .then(() => {
      console.log("[MailGuard] Seed script finished.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[MailGuard] Seed script failed:", err);
      process.exit(1);
    });
}
