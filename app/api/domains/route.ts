import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { domains } from "@/server/db/schema";
import { ilike, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = (page - 1) * limit;

    const db = getDb();
    const whereClause = search ? ilike(domains.domain, `%${search.toLowerCase().trim()}%`) : undefined;

    const rows = await db
      .select()
      .from(domains)
      .where(whereClause)
      .orderBy(sql`${domains.verificationCount} DESC`)
      .limit(limit)
      .offset(offset);

    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(domains)
      .where(whereClause);

    const total = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        domains: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
