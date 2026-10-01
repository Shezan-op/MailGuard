import { NextRequest, NextResponse } from "next/server";
import { VerificationOrchestrator } from "@/server/verification/orchestrator";
import { getDb } from "@/server/db";
import { settings } from "@/server/db/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, forceReverify, conservativeMode } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email is required" } },
        { status: 400 }
      );
    }

    // Load configured settings from database
    const db = getDb();
    const dbSettings = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    dbSettings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    const result = await VerificationOrchestrator.verify(email, {
      heloDomain: settingsMap.HELO_DOMAIN,
      verificationFromAddress: settingsMap.VERIFICATION_FROM_ADDRESS,
      smtpTimeoutMs: parseInt(settingsMap.SMTP_TIMEOUT_MS || "10000", 10),
      dnsTimeoutMs: parseInt(settingsMap.DNS_TIMEOUT_MS || "5000", 10),
      maxRetries: parseInt(settingsMap.MAX_RETRIES || "2", 10),
      catchAllEnabled: settingsMap.CATCH_ALL_ENABLED !== "false",
      allowPrivateIps: settingsMap.ALLOW_PRIVATE_IPS === "true" || process.env.ALLOW_PRIVATE_IPS === "true",
      forceReverify: !!forceReverify,
      conservativeMode: conservativeMode ?? (settingsMap.CONSERVATIVE_MODE === "true"),
      persist: true,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "VERIFICATION_ERROR", message: err.message || "Verification failed" } },
      { status: 500 }
    );
  }
}
