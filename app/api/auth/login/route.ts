import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AuthService } from "@/server/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "Email and password are required" } },
        { status: 400 }
      );
    }

    const validation = AuthService.validateCredentials(email, password);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: { code: "UNAUTHORIZED", message: validation.reason || "Invalid credentials" } },
        { status: 401 }
      );
    }

    const token = AuthService.createToken(email);
    const cookieConfig = AuthService.getCookieConfig();

    const cookieStore = await cookies();
    cookieStore.set(cookieConfig.name, token, {
      maxAge: cookieConfig.maxAge,
      httpOnly: cookieConfig.httpOnly,
      path: cookieConfig.path,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });

    return NextResponse.json({
      success: true,
      data: { email: email.toLowerCase().trim() },
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: err.message || "Login failed" } },
      { status: 500 }
    );
  }
}
