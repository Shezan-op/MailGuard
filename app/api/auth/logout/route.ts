import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/server/auth/session";

export async function POST() {
  const cookieStore = await cookies();
  const config = AuthService.getCookieConfig();
  cookieStore.delete(config.name);

  return NextResponse.json({
    success: true,
    data: { message: "Logged out successfully" },
  });
}
