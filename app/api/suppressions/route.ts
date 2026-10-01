import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getDb } from "@/server/db";
import { suppressions } from "@/server/db/schema";
import { ilike, or, eq, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const type = searchParams.get("type");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = (page - 1) * limit;

    const db = getDb();
    const conditions = [];

    if (search) {
      const term = `%${search.toLowerCase().trim()}%`;
      conditions.push(or(ilike(suppressions.email, term), ilike(suppressions.domain, term)));
    }
    if (type) {
      conditions.push(eq(suppressions.type, type));
    }

    const rows = await db
      .select()
      .from(suppressions)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined)
      .orderBy(sql`${suppressions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    const countRes = await db
      .select({ count: sql<number>`count(*)` })
      .from(suppressions)
      .where(conditions.length > 0 ? sql`${sql.join(conditions, sql` AND `)}` : undefined);

    const total = Number(countRes[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        suppressions: rows,
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, domain, type = "manual", reason, notes } = body;

    if (!email && !domain) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Either email or domain must be provided" } },
        { status: 400 }
      );
    }

    const db = getDb();
    const id = crypto.randomUUID();

    await db.insert(suppressions).values({
      id,
      email: email ? email.toLowerCase().trim() : null,
      domain: domain ? domain.toLowerCase().trim() : null,
      type,
      reason: reason || "Added by administrator",
      notes,
      source: "manual",
    });

    return NextResponse.json({
      success: true,
      data: { id },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INSERT_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
