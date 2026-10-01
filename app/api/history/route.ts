import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { deliveryEvents } from "@/server/db/schema";
import { ilike, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const eventType = searchParams.get("eventType");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions = [];

    if (search) {
      conditions.push(ilike(deliveryEvents.email, `%${search.toLowerCase().trim()}%`));
    }
    if (eventType) {
      conditions.push(eq(deliveryEvents.eventType, eventType));
    }

    const rows = await db
      .select()
      .from(deliveryEvents)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
      .orderBy(sql`${deliveryEvents.eventDate} DESC`)
      .limit(limit)
      .offset(offset);

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(deliveryEvents)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

    const total = Number(countRes[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        events: rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
