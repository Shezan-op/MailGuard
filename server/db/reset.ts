import { getDb } from "./index";
import { sql } from "drizzle-orm";
import { runMigrations } from "./migrate";
import { seedDatabase } from "./seed";

export async function resetDatabase(): Promise<void> {
  const db = getDb();
  console.log("[MailGuard] WARNING: Resetting database...");

  const dropQueries = [
    "DROP TABLE IF EXISTS verification_runs CASCADE;",
    "DROP TABLE IF EXISTS smtp_events CASCADE;",
    "DROP TABLE IF EXISTS delivery_events CASCADE;",
    "DROP TABLE IF EXISTS suppressions CASCADE;",
    "DROP TABLE IF EXISTS emails CASCADE;",
    "DROP TABLE IF EXISTS domains CASCADE;",
    "DROP TABLE IF EXISTS verification_jobs CASCADE;",
    "DROP TABLE IF EXISTS disposable_domains CASCADE;",
    "DROP TABLE IF EXISTS settings CASCADE;",
    "DROP TABLE IF EXISTS audit_logs CASCADE;",
    "DROP TABLE IF EXISTS data_versions CASCADE;",
  ];

  for (const q of dropQueries) {
    await db.execute(sql.raw(q));
  }

  console.log("[MailGuard] Tables dropped. Re-migrating and seeding...");
  await runMigrations();
  await seedDatabase();
  console.log("[MailGuard] Database reset completed.");
}

if (process.argv[1]?.endsWith("reset.ts")) {
  resetDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
