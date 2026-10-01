import { getDb } from "../../db";
import { suppressions, deliveryEvents, domains } from "../../db/schema";
import { eq, or } from "drizzle-orm";

export interface AddressReputation {
  isSuppressed: boolean;
  suppressionType?: string;
  suppressionReason?: string;
  hasHistoricalHardBounce: boolean;
  historicalDeliveries: number;
  historicalBounces: number;
  domainDeliverabilityRate?: number;
  domainBounceRate?: number;
}

export class ReputationService {
  /**
   * Looks up suppression and campaign delivery history for an email and domain.
   */
  static async checkReputation(email: string, domain: string): Promise<AddressReputation> {
    const normalizedEmail = email.toLowerCase().trim();
    const normalizedDomain = domain.toLowerCase().trim();

    const db = getDb();

    // 1. Check Suppressions
    let isSuppressed = false;
    let suppressionType: string | undefined;
    let suppressionReason: string | undefined;

    try {
      const suppressionMatches = await db
        .select()
        .from(suppressions)
        .where(
          or(
            eq(suppressions.email, normalizedEmail),
            eq(suppressions.domain, normalizedDomain)
          )
        )
        .limit(1);

      if (suppressionMatches.length > 0) {
        isSuppressed = true;
        suppressionType = suppressionMatches[0].type;
        suppressionReason = suppressionMatches[0].reason || `Suppressed by ${suppressionMatches[0].type} rule`;
      }
    } catch {}

    // 2. Check Delivery Events (Hard bounces / successful deliveries)
    let hasHistoricalHardBounce = false;
    let historicalDeliveries = 0;
    let historicalBounces = 0;

    try {
      const pastEvents = await db
        .select()
        .from(deliveryEvents)
        .where(eq(deliveryEvents.email, normalizedEmail));

      for (const ev of pastEvents) {
        if (ev.eventType === "hard_bounce") {
          hasHistoricalHardBounce = true;
          historicalBounces++;
        } else if (ev.eventType === "delivered") {
          historicalDeliveries++;
        } else if (ev.eventType === "soft_bounce" || ev.eventType === "blocked") {
          historicalBounces++;
        }
      }
    } catch {}

    // 3. Check Domain Intelligence Metrics
    let domainDeliverabilityRate: number | undefined;
    let domainBounceRate: number | undefined;

    try {
      const domainRow = await db
        .select()
        .from(domains)
        .where(eq(domains.domain, normalizedDomain))
        .limit(1);

      if (domainRow.length > 0) {
        domainDeliverabilityRate = domainRow[0].historicalDeliverabilityRate;
        domainBounceRate = domainRow[0].historicalBounceRate;
      }
    } catch {}

    return {
      isSuppressed,
      suppressionType,
      suppressionReason,
      hasHistoricalHardBounce,
      historicalDeliveries,
      historicalBounces,
      domainDeliverabilityRate,
      domainBounceRate,
    };
  }
}
