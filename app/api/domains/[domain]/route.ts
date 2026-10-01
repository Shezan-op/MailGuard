import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { domains, emails } from "@/server/db/schema";
import { eq, sql } from "drizzle-orm";
import { DnsService } from "@/server/verification/dns/dns-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  try {
    const { domain } = await params;
    const decodedDomain = decodeURIComponent(domain).toLowerCase().trim();
    const { searchParams } = new URL(req.url);
    const dkimSelector = searchParams.get("dkimSelector") || undefined;

    const db = getDb();
    const domainRows = await db
      .select()
      .from(domains)
      .where(eq(domains.domain, decodedDomain))
      .limit(1);

    // Associated verified addresses sample
    const sampleEmails = await db
      .select({
        id: emails.id,
        email: emails.normalizedEmail,
        status: emails.finalStatus,
        riskScore: emails.riskScore,
        confidence: emails.confidence,
        lastVerifiedAt: emails.lastVerifiedAt,
      })
      .from(emails)
      .where(eq(emails.domain, decodedDomain))
      .orderBy(sql`${emails.lastVerifiedAt} DESC`)
      .limit(20);

    // Live email auth diagnostics (SPF, DMARC, DKIM)
    const authDiagnostics = await DnsService.checkEmailAuth(decodedDomain, dkimSelector);

    return NextResponse.json({
      success: true,
      data: {
        domain: domainRows[0] || {
          domain: decodedDomain,
          exists: true,
          provider: "Unknown",
          verificationCount: sampleEmails.length,
        },
        sampleEmails,
        authDiagnostics,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
