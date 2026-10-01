import { NextResponse } from "next/server";
import { getDb } from "@/server/db";
import { sql } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`SELECT 1;`);
    return NextResponse.json({ ready: true });
  } catch (err: any) {
    return NextResponse.json({ ready: false, error: err.message }, { status: 503 });
  }
}
