import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { emails } from "@/server/db/schema";
import { and, eq, ilike, inArray, gte, lte, sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const offset = (page - 1) * limit;

    const search = searchParams.get("search");
    const status = searchParams.get("status");
    const provider = searchParams.get("provider");
    const isCatchAll = searchParams.get("isCatchAll");
    const isDisposable = searchParams.get("isDisposable");
    const isRoleBased = searchParams.get("isRoleBased");
    const minRisk = searchParams.get("minRisk");
    const maxRisk = searchParams.get("maxRisk");
    const sortBy = searchParams.get("sortBy") || "lastVerifiedAt";
    const sortOrder = searchParams.get("sortOrder") || "desc";

    const conditions = [];

    if (search) {
      conditions.push(ilike(emails.normalizedEmail, `%${search.toLowerCase().trim()}%`));
    }
    if (status) {
      const statuses = status.split(",").map((s) => s.trim().toUpperCase());
      conditions.push(inArray(emails.finalStatus, statuses));
    }
    if (provider) {
      conditions.push(eq(emails.providerName, provider));
    }
    if (isCatchAll !== null && isCatchAll !== undefined && isCatchAll !== "") {
      conditions.push(eq(emails.catchAllStatus, isCatchAll === "true"));
    }
    if (isDisposable !== null && isDisposable !== undefined && isDisposable !== "") {
      conditions.push(eq(emails.disposableStatus, isDisposable === "true"));
    }
    if (isRoleBased !== null && isRoleBased !== undefined && isRoleBased !== "") {
      conditions.push(eq(emails.roleBasedStatus, isRoleBased === "true"));
    }
    if (minRisk) {
      conditions.push(gte(emails.riskScore, parseInt(minRisk, 10)));
    }
    if (maxRisk) {
      conditions.push(lte(emails.riskScore, parseInt(maxRisk, 10)));
    }

    const db = getDb();
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Order By
    let orderSql = sql`${emails.lastVerifiedAt} DESC`;
    if (sortBy === "riskScore") {
      orderSql = sortOrder === "asc" ? sql`${emails.riskScore} ASC` : sql`${emails.riskScore} DESC`;
    } else if (sortBy === "email") {
      orderSql = sortOrder === "asc" ? sql`${emails.normalizedEmail} ASC` : sql`${emails.normalizedEmail} DESC`;
    } else if (sortBy === "finalStatus") {
      orderSql = sortOrder === "asc" ? sql`${emails.finalStatus} ASC` : sql`${emails.finalStatus} DESC`;
    }

    const rows = await db
      .select()
      .from(emails)
      .where(whereClause)
      .orderBy(orderSql)
      .limit(limit)
      .offset(offset);

    // Total count for pagination
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(emails)
      .where(whereClause);

    const total = Number(totalResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      data: {
        emails: rows,
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
