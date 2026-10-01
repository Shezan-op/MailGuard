import fs from "fs";
import path from "path";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

async function backupDatabase(): Promise<void> {
  console.log("[MailGuard] Initiating database backup routine...");

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "storage", "backups");

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backupFile = path.join(backupDir, `mailguard_backup_${timestamp}.json`);

  const db = getDb();

  const tables = [
    "verification_jobs",
    "emails",
    "verification_runs",
    "domains",
    "smtp_events",
    "suppressions",
    "delivery_events",
    "disposable_domains",
    "settings",
    "audit_logs",
    "data_versions",
  ];

  const dump: Record<string, any[]> = {};

  for (const table of tables) {
    try {
      const result = await db.execute(sql.raw(`SELECT * FROM ${table};`));
      dump[table] = (result as any).rows || [];
      console.log(`[MailGuard] Dumped ${dump[table].length} records from table '${table}'`);
    } catch (err: any) {
      console.warn(`[MailGuard] Warning dumping '${table}':`, err.message);
      dump[table] = [];
    }
  }

  fs.writeFileSync(backupFile, JSON.stringify(dump, null, 2), "utf-8");
  const stats = fs.statSync(backupFile);

  console.log(`[MailGuard] Backup completed successfully!`);
  console.log(`[MailGuard] Backup file saved to: ${backupFile} (${(stats.size / 1024).toFixed(2)} KB)`);
}

backupDatabase()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[MailGuard] Backup fatal error:", err);
    process.exit(1);
  });
