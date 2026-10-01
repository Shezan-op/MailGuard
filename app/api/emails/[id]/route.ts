import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { emails, verificationRuns, smtpEvents, deliveryEvents, domains, suppressions } from "@/server/db/schema";
import { eq, or, sql } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const decoded = decodeURIComponent(id).toLowerCase().trim();

    const db = getDb();

    // Match by ID or normalized_email
    const rows = await db
      .select()
      .from(emails)
      .where(or(eq(emails.id, decoded), eq(emails.normalizedEmail, decoded)))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NOT_FOUND", message: "Email record not found" } },
        { status: 404 }
      );
    }

    const emailRecord = rows[0];

    // Verification runs history
    const runs = await db
      .select()
      .from(verificationRuns)
      .where(eq(verificationRuns.emailId, emailRecord.normalizedEmail))
      .orderBy(sql`${verificationRuns.createdAt} DESC`)
      .limit(20);

    // Raw SMTP Events
    const events = await db
      .select()
      .from(smtpEvents)
      .where(eq(smtpEvents.emailId, emailRecord.normalizedEmail))
      .orderBy(sql`${smtpEvents.createdAt} DESC`)
      .limit(30);

    // Delivery / Campaign History
    const campaignEvents = await db
      .select()
      .from(deliveryEvents)
      .where(eq(deliveryEvents.email, emailRecord.normalizedEmail))
      .orderBy(sql`${deliveryEvents.eventDate} DESC`)
      .limit(20);

    // Domain Intelligence
    const domainData = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, emailRecord.domain))
      .limit(1);

    // Suppression status
    const suppressionRecord = await db
      .select()
      .from(suppressions)
      .where(or(eq(suppressions.email, emailRecord.normalizedEmail), eq(suppressions.domain, emailRecord.domain)))
      .limit(1);

    return NextResponse.json({
      success: true,
      data: {
        email: emailRecord,
        runs,
        smtpEvents: events,
        campaignEvents,
        domain: domainData[0] || null,
        suppression: suppressionRecord[0] || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
