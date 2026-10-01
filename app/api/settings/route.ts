import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { settings, auditLogs } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(settings);
    const settingsMap: Record<string, string> = {};
    rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    return NextResponse.json({
      success: true,
      data: {
        settings: settingsMap,
        raw: rows,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const db = getDb();

    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") {
        await db
          .insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({
            target: settings.key,
            set: { value, updatedAt: new Date() },
          });
      }
    }

    // Audit log
    await db.insert(auditLogs).values({
      id: crypto.randomUUID(),
      userEmail: "admin@mailguard.local",
      action: "CHANGE_SETTINGS",
      resource: "settings",
      metadata: body,
    });

    return NextResponse.json({
      success: true,
      data: { message: "Settings updated successfully" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "UPDATE_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
