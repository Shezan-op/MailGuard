import fs from "fs";
import path from "path";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

export async function restoreDatabase(backupFilePath?: string): Promise<{ success: boolean; restoredTables: Record<string, number> }> {
  console.log("[MailGuard Disaster Recovery] Initiating database restore routine...");

  let targetFile = backupFilePath;

  if (!targetFile) {
    const backupDir = path.join(process.cwd(), "storage", "backups");
    if (!fs.existsSync(backupDir)) {
      throw new Error(`Backup directory not found at: ${backupDir}`);
    }

    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.startsWith("mailguard_backup_") && f.endsWith(".json"))
      .sort()
      .reverse();

    if (files.length === 0) {
      throw new Error(`No backup files found in: ${backupDir}`);
    }

    targetFile = path.join(backupDir, files[0]);
  }

  if (!fs.existsSync(targetFile)) {
    throw new Error(`Specified backup file does not exist: ${targetFile}`);
  }

  console.log(`[MailGuard Disaster Recovery] Reading backup from: ${targetFile}`);
  const rawData = fs.readFileSync(targetFile, "utf-8");
  const dump = JSON.parse(rawData);

  const db = getDb();
  const restoredTables: Record<string, number> = {};

  // Tables in dependency order
  const tables = [
    "data_versions",
    "settings",
    "disposable_domains",
    "suppressions",
    "domains",
    "verification_jobs",
    "emails",
    "verification_runs",
    "smtp_events",
    "delivery_events",
    "audit_logs",
  ];

  for (const table of tables) {
    const rows: any[] = dump[table] || [];

    // Clear existing table data
    await db.execute(sql.raw(`DELETE FROM ${table};`));

    if (rows.length > 0) {
      for (const row of rows) {
        const columns = Object.keys(row);
        const colList = columns.map((c) => `"${c}"`).join(", ");
        const valPlaceholders = columns
          .map((c) => {
            const v = row[c];
            if (v === null || v === undefined) return "NULL";
            if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
            if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
            if (typeof v === "number") return v;
            return `'${String(v).replace(/'/g, "''")}'`;
          })
          .join(", ");

        await db.execute(sql.raw(`INSERT INTO "${table}" (${colList}) VALUES (${valPlaceholders});`));
      }
    }

    restoredTables[table] = rows.length;
    console.log(`[MailGuard Disaster Recovery] Restored ${rows.length} rows into '${table}'`);
  }

  console.log("[MailGuard Disaster Recovery] Database restore completed successfully.");
  return { success: true, restoredTables };
}

// Allow direct execution
if (process.argv[1]?.endsWith("db-restore.ts")) {
  const argFile = process.argv[2];
  restoreDatabase(argFile)
    .then(() => {
      console.log("[MailGuard Disaster Recovery] Exit 0");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[MailGuard Disaster Recovery] Fatal restore error:", err);
      process.exit(1);
    });
}
