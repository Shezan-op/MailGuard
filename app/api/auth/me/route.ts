import { NextResponse } from "next/server";
import { AuthService } from "@/server/auth/session";

export async function GET() {
  const session = await AuthService.getSession();
  return NextResponse.json({
    success: true,
    data: session,
  });
}
