import crypto from "crypto";
import Papa from "papaparse";
import { getDb } from "../db";
import { deliveryEvents, domains } from "../db/schema";
import { eq, sql } from "drizzle-orm";

export interface BounceImportMapping {
  emailColumn: string;
  eventTypeColumn?: string;
  campaignColumn?: string;
  smtpCodeColumn?: string;
  smtpResponseColumn?: string;
  dateColumn?: string;
}

export interface BounceImportSummary {
  totalProcessed: number;
  delivered: number;
  hardBounce: number;
  softBounce: number;
  blocked: number;
  complaint: number;
  unknown: number;
}

export class BounceImporter {
  /**
   * Normalizes various raw bounce/delivery terms into standard MailGuard event types.
   */
  static normalizeEventType(rawType: string, code?: number): string {
    const lower = (rawType || "").toLowerCase().trim();

    if (lower === "delivered" || lower === "delivery" || lower === "sent" || lower === "success") {
      return "delivered";
    }

    if (
      lower === "hard_bounce" ||
      lower === "hardbounce" ||
      lower === "bounce" ||
      lower === "bounced" ||
      lower === "permanent_bounce" ||
      lower === "failed"
    ) {
      return "hard_bounce";
    }

    if (
      lower === "soft_bounce" ||
      lower === "softbounce" ||
      lower === "temporary_bounce" ||
      lower === "transient"
    ) {
      return "soft_bounce";
    }

    if (lower === "blocked" || lower === "dropped" || lower === "rejected") {
      return "blocked";
    }

    if (lower === "complaint" || lower === "spam" || lower === "spamreport") {
      return "complaint";
    }

    if (lower === "unsubscribe" || lower === "unsub") {
      return "unsubscribe";
    }

    // Fallback: If 5xx SMTP code, classify as hard bounce; if 4xx, soft bounce
    if (code) {
      if (code >= 500 && code < 600) return "hard_bounce";
      if (code >= 400 && code < 500) return "soft_bounce";
    }

    return "unknown";
  }

  /**
   * Imports campaign delivery & bounce records from CSV content.
   */
  static async importCsv(
    csvContent: string,
    mapping: BounceImportMapping
  ): Promise<BounceImportSummary> {
    const parsed = Papa.parse<Record<string, any>>(csvContent.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: "greedy",
    });

    const rows = parsed.data || [];
    const db = getDb();

    const summary: BounceImportSummary = {
      totalProcessed: 0,
      delivered: 0,
      hardBounce: 0,
      softBounce: 0,
      blocked: 0,
      complaint: 0,
      unknown: 0,
    };

    const touchedDomains = new Set<string>();

    for (const row of rows) {
      const rawEmail = row[mapping.emailColumn];
      if (!rawEmail || typeof rawEmail !== "string") continue;

      const email = rawEmail.trim().toLowerCase();
      if (!email.includes("@")) continue;

      const domain = email.split("@")[1];
      if (domain) {
        touchedDomains.add(domain);
      }

      const rawCode = mapping.smtpCodeColumn ? parseInt(row[mapping.smtpCodeColumn], 10) : undefined;
      const code = isNaN(rawCode!) ? undefined : rawCode;

      const rawType = mapping.eventTypeColumn ? row[mapping.eventTypeColumn] : "hard_bounce";
      const eventType = this.normalizeEventType(rawType, code);

      const response = mapping.smtpResponseColumn ? String(row[mapping.smtpResponseColumn]).slice(0, 2000) : null;
      const campaignName = mapping.campaignColumn ? String(row[mapping.campaignColumn]).slice(0, 255) : "Campaign Import";

      let eventDate = new Date();
      if (mapping.dateColumn && row[mapping.dateColumn]) {
        const parsedDate = new Date(row[mapping.dateColumn]);
        if (!isNaN(parsedDate.getTime())) {
          eventDate = parsedDate;
        }
      }

      await db.insert(deliveryEvents).values({
        id: crypto.randomUUID(),
        email,
        eventType,
        campaignName,
        smtpCode: code,
        smtpResponse: response,
        eventDate,
      });

      summary.totalProcessed++;
      if (eventType === "delivered") summary.delivered++;
      else if (eventType === "hard_bounce") summary.hardBounce++;
      else if (eventType === "soft_bounce") summary.softBounce++;
      else if (eventType === "blocked") summary.blocked++;
      else if (eventType === "complaint") summary.complaint++;
      else summary.unknown++;
    }

    // Recompute domain statistics for touched domains
    for (const d of touchedDomains) {
      await this.recalculateDomainStats(d);
    }

    return summary;
  }

  /**
   * Recalculates first-party deliverability and bounce rates for a domain based on delivery events.
   */
  static async recalculateDomainStats(domain: string): Promise<void> {
    const db = getDb();
    const normalizedDomain = domain.toLowerCase().trim();

    const stats = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE event_type = 'delivered') as delivered,
        COUNT(*) FILTER (WHERE event_type = 'hard_bounce') as hard_bounces,
        COUNT(*) FILTER (WHERE event_type = 'soft_bounce') as soft_bounces
      FROM delivery_events
      WHERE email LIKE ${"%" + "@" + normalizedDomain};
    `);

    const row = stats.rows?.[0] as any;
    if (!row) return;

    const total = parseInt(row.total, 10) || 0;
    const delivered = parseInt(row.delivered, 10) || 0;
    const hardBounces = parseInt(row.hard_bounces, 10) || 0;

    if (total > 0) {
      const bounceRateBasisPoints = Math.round((hardBounces / total) * 10000);
      const deliverabilityBasisPoints = Math.round((delivered / total) * 10000);

      await db
        .update(domains)
        .set({
          historicalBounceRate: bounceRateBasisPoints,
          historicalDeliverabilityRate: deliverabilityBasisPoints,
          updatedAt: new Date(),
        })
        .where(eq(domains.domain, normalizedDomain));
    }
  }
}
