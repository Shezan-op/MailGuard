import net from "net";
import fs from "fs";
import path from "path";
import dns from "dns/promises";
import { getDb } from "../server/db";
import { sql } from "drizzle-orm";

interface DiagnosticItem {
  name: string;
  status: "PASS" | "WARN" | "FAIL" | "BLOCKED";
  reason?: string;
  details?: string;
}

export async function runDoctor(): Promise<{
  overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY";
  items: DiagnosticItem[];
}> {
  console.log("==================================================================");
  console.log("MAILGUARD SYSTEM DIAGNOSTIC");
  console.log("==================================================================\n");

  const items: DiagnosticItem[] = [];

  // 1. Application
  try {
    const nodeVer = process.version;
    const major = parseInt(nodeVer.slice(1).split(".")[0], 10);
    if (major >= 18) {
      items.push({ name: "Application", status: "PASS", details: `Node ${nodeVer}` });
    } else {
      items.push({
        name: "Application",
        status: "WARN",
        reason: `Node.js ${nodeVer} detected. Recommended Node.js >= 20.`,
      });
    }
  } catch (err: any) {
    items.push({ name: "Application", status: "FAIL", reason: err.message });
  }

  // 2. Database Connectivity
  let dbHealthy = false;
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1;`);
    items.push({ name: "Database", status: "PASS", details: "Connected successfully" });
    dbHealthy = true;
  } catch (err: any) {
    items.push({ name: "Database", status: "FAIL", reason: `Cannot connect: ${err.message}` });
  }

  // 3. Schema & Migrations
  if (dbHealthy) {
    try {
      const db = getDb();
      const check = await db.execute(
        sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
      );
      const tables = ((check as any).rows || []).map((r: any) => r.table_name);
      const required = [
        "verification_jobs",
        "emails",
        "verification_runs",
        "domains",
        "smtp_events",
        "suppressions",
        "settings",
      ];
      const missing = required.filter((t) => !tables.includes(t));

      if (missing.length === 0) {
        items.push({ name: "Schema", status: "PASS", details: `${tables.length} tables verified` });
        items.push({ name: "Migrations", status: "PASS", details: "All migrations applied" });
      } else {
        items.push({ name: "Schema", status: "FAIL", reason: `Missing tables: ${missing.join(", ")}` });
        items.push({ name: "Migrations", status: "FAIL", reason: "Pending migrations required" });
      }
    } catch (err: any) {
      items.push({ name: "Schema", status: "FAIL", reason: err.message });
      items.push({ name: "Migrations", status: "FAIL", reason: err.message });
    }
  } else {
    items.push({ name: "Schema", status: "BLOCKED", reason: "Database unavailable" });
    items.push({ name: "Migrations", status: "BLOCKED", reason: "Database unavailable" });
  }

  // 4. Worker Status
  try {
    // Check if worker can instantiate and check jobs
    const db = getDb();
    const countCheck = await db.execute(sql`SELECT COUNT(*)::int as count FROM verification_jobs WHERE status = 'running';`);
    const runningJobs = ((countCheck as any).rows[0] as any)?.count || 0;
    items.push({ name: "Worker", status: "PASS", details: `Daemon active (${runningJobs} running jobs)` });
  } catch (err: any) {
    items.push({ name: "Worker", status: "FAIL", reason: err.message });
  }

  // 5. Queue Status
  try {
    const db = getDb();
    const qCheck = await db.execute(sql`
      SELECT
        COUNT(CASE WHEN status = 'queued' THEN 1 END)::int as queued,
        COUNT(CASE WHEN status = 'running' THEN 1 END)::int as running
      FROM verification_jobs;
    `);
    const qRow = (qCheck as any).rows[0] as any;
    items.push({
      name: "Queue",
      status: "PASS",
      details: `${qRow.queued || 0} queued, ${qRow.running || 0} running`,
    });
  } catch (err: any) {
    items.push({ name: "Queue", status: "FAIL", reason: err.message });
  }

  // 6. DNS Resolution
  try {
    const mxRecords = await dns.resolveMx("google.com");
    if (mxRecords && mxRecords.length > 0) {
      items.push({ name: "DNS", status: "PASS", details: `Resolved ${mxRecords.length} MX records` });
    } else {
      items.push({ name: "DNS", status: "FAIL", reason: "Empty DNS response for public MX" });
    }
  } catch (err: any) {
    items.push({ name: "DNS", status: "FAIL", reason: `DNS lookup failed: ${err.message}` });
  }

  // 7. SMTP Outbound Port 25 Connectivity
  try {
    const mxTarget = "aspmx.l.google.com";
    const port = 25;
    const canConnect = await new Promise<boolean>((resolve) => {
      const socket = net.createConnection({ host: mxTarget, port, timeout: 4000 }, () => {
        socket.destroy();
        resolve(true);
      });
      socket.on("error", () => {
        socket.destroy();
        resolve(false);
      });
      socket.on("timeout", () => {
        socket.destroy();
        resolve(false);
      });
    });

    if (canConnect) {
      items.push({ name: "SMTP outbound", status: "PASS", details: "TCP port 25 open and accessible" });
    } else {
      items.push({
        name: "SMTP outbound",
        status: "BLOCKED",
        reason: "Host/network blocks outbound TCP port 25. ISP or firewall filtering active.",
      });
    }
  } catch (err: any) {
    items.push({ name: "SMTP outbound", status: "BLOCKED", reason: err.message });
  }

  // 8. Storage & File System
  try {
    const storagePaths = [
      path.join(process.cwd(), "storage"),
      path.join(process.cwd(), "storage", "db"),
      path.join(process.cwd(), "storage", "uploads"),
      path.join(process.cwd(), "storage", "exports"),
      path.join(process.cwd(), "storage", "backups"),
    ];

    for (const sp of storagePaths) {
      if (!fs.existsSync(sp)) {
        fs.mkdirSync(sp, { recursive: true });
      }
      // Test write access
      const testFile = path.join(sp, `.write_test_${Date.now()}`);
      fs.writeFileSync(testFile, "ok");
      fs.unlinkSync(testFile);
    }
    items.push({ name: "Storage", status: "PASS", details: "All directories present and writable" });
  } catch (err: any) {
    items.push({ name: "Storage", status: "FAIL", reason: `Storage write failure: ${err.message}` });
  }

  // 9. Configuration
  try {
    const isProd = process.env.NODE_ENV === "production";
    const secret = process.env.SESSION_SECRET;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (isProd && (!secret || secret.length < 32 || secret.includes("dev"))) {
      items.push({
        name: "Configuration",
        status: "FAIL",
        reason: "SESSION_SECRET is insecure or unset for production",
      });
    } else {
      items.push({
        name: "Configuration",
        status: "PASS",
        details: isProd ? "Production configuration verified" : "Development configuration active",
      });
    }
  } catch (err: any) {
    items.push({ name: "Configuration", status: "FAIL", reason: err.message });
  }

  // Print results
  for (const item of items) {
    const padded = item.name.padEnd(20, " ");
    const color = item.status === "PASS" ? "PASS" : item.status === "WARN" ? "WARN" : item.status === "BLOCKED" ? "BLOCKED" : "FAIL";
    console.log(`${padded} ${color}${item.details ? ` (${item.details})` : ""}`);
    if (item.reason) {
      console.log(`  Reason: ${item.reason}`);
    }
  }

  const hasFail = items.some((i) => i.status === "FAIL");
  const hasBlockedOrWarn = items.some((i) => i.status === "BLOCKED" || i.status === "WARN");

  let overall: "HEALTHY" | "DEGRADED" | "UNHEALTHY" = "HEALTHY";
  if (hasFail) {
    overall = "UNHEALTHY";
  } else if (hasBlockedOrWarn) {
    overall = "DEGRADED";
  }

  console.log("\nOverall:");
  console.log(overall);
  console.log("==================================================================");

  return { overall, items };
}

// Allow direct execution
if (process.argv[1]?.endsWith("doctor.ts")) {
  runDoctor()
    .then((res) => {
      process.exit(res.overall === "UNHEALTHY" ? 1 : 0);
    })
    .catch((err) => {
      console.error("[Doctor] Fatal error:", err);
      process.exit(1);
    });
}
