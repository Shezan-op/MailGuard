import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { emails, domains, verificationJobs, suppressions, deliveryEvents } from "@/server/db/schema";
import { sql } from "drizzle-orm";
import dns from "dns/promises";

export async function GET() {
  try {
    const db = getDb();

    // Database counts
    const emailCountRes = await db.select({ count: sql<number>`count(*)` }).from(emails);
    const domainCountRes = await db.select({ count: sql<number>`count(*)` }).from(domains);
    const jobCountRes = await db.select({ count: sql<number>`count(*)` }).from(verificationJobs);
    const suppressionCountRes = await db.select({ count: sql<number>`count(*)` }).from(suppressions);
    const deliveryEventCountRes = await db.select({ count: sql<number>`count(*)` }).from(deliveryEvents);

    // Pending jobs count
    const pendingJobsRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(verificationJobs)
      .where(sql`status IN ('queued', 'running')`);

    // DNS check
    let dnsOperational = false;
    let dnsLatencyMs = 0;
    try {
      const start = Date.now();
      await dns.resolve4("google.com");
      dnsLatencyMs = Date.now() - start;
      dnsOperational = true;
    } catch {}

    const memoryUsage = process.memoryUsage();

    return NextResponse.json({
      success: true,
      data: {
        application: {
          name: "MailGuard",
          version: "1.0.0",
          nodeVersion: process.version,
          uptimeSeconds: Math.floor(process.uptime()),
          platform: process.platform,
        },
        database: {
          status: "healthy",
          totalEmails: Number(emailCountRes[0]?.count || 0),
          totalDomains: Number(domainCountRes[0]?.count || 0),
          totalJobs: Number(jobCountRes[0]?.count || 0),
          totalSuppressions: Number(suppressionCountRes[0]?.count || 0),
          totalDeliveryEvents: Number(deliveryEventCountRes[0]?.count || 0),
        },
        queue: {
          status: "healthy",
          pendingJobs: Number(pendingJobsRes[0]?.count || 0),
        },
        dns: {
          status: dnsOperational ? "operational" : "degraded",
          latencyMs: dnsLatencyMs,
        },
        memory: {
          rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
          heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
          heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "HEALTH_CHECK_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
