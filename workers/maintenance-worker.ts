import fs from "fs";
import path from "path";
import { getDb } from "../server/db";
import { verificationJobs } from "../server/db/schema";
import { sql } from "drizzle-orm";

export async function runMaintenanceTasks(): Promise<{
  cleanedUploads: number;
  cleanedExports: number;
  recoveredJobs: number;
}> {
  console.log("[MaintenanceWorker] Running periodic maintenance tasks...");
  let cleanedUploads = 0;
  let cleanedExports = 0;
  let recoveredJobs = 0;

  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * ONE_DAY;
  const THIRTY_DAYS = 30 * ONE_DAY;

  // 1. Clean old uploads (> 30 days)
  const uploadsDir = path.join(process.cwd(), "storage", "uploads");
  if (fs.existsSync(uploadsDir)) {
    const files = fs.readdirSync(uploadsDir);
    for (const f of files) {
      const filePath = path.join(uploadsDir, f);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > THIRTY_DAYS) {
          fs.unlinkSync(filePath);
          cleanedUploads++;
        }
      } catch {}
    }
  }

  // 2. Clean old exports (> 7 days)
  const exportsDir = path.join(process.cwd(), "storage", "exports");
  if (fs.existsSync(exportsDir)) {
    const files = fs.readdirSync(exportsDir);
    for (const f of files) {
      const filePath = path.join(exportsDir, f);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > SEVEN_DAYS) {
          fs.unlinkSync(filePath);
          cleanedExports++;
        }
      } catch {}
    }
  }

  // 3. Clean temporary files (> 24 hours)
  const tempDir = path.join(process.cwd(), "storage", "temp");
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    for (const f of files) {
      const filePath = path.join(tempDir, f);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > ONE_DAY) {
          fs.unlinkSync(filePath);
        }
      } catch {}
    }
  }

  // 4. Recover stuck jobs (running for more than 2 hours without updates)
  try {
    const db = getDb();
    const result = await db.execute(sql`
      UPDATE verification_jobs
      SET status = 'failed', updated_at = CURRENT_TIMESTAMP
      WHERE status = 'running' AND updated_at < CURRENT_TIMESTAMP - INTERVAL '2 hours'
      RETURNING id;
    `);

    if (result.rows) {
      recoveredJobs = result.rows.length;
    }
  } catch (err) {
    console.error("[MaintenanceWorker] Error checking stuck jobs:", err);
  }

  console.log(`[MaintenanceWorker] Maintenance finished: ${cleanedUploads} uploads cleaned, ${cleanedExports} exports cleaned, ${recoveredJobs} stuck jobs recovered.`);
  return { cleanedUploads, cleanedExports, recoveredJobs };
}

if (process.argv[1]?.endsWith("maintenance-worker.ts")) {
  runMaintenanceTasks()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[MaintenanceWorker] Fatal error:", err);
      process.exit(1);
    });
}
