import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1;`);

    return NextResponse.json({
      status: "ok",
      database: "ok",
      queue: "ok",
      worker: "ok",
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", database: "unreachable", error: err.message },
      { status: 503 }
    );
  }
}
