import { describe, it, expect, beforeEach } from "vitest";
import { AuthService } from "@/server/auth/session";

describe("Security & Authentication Hardening", () => {
  beforeEach(() => {
    AuthService.resetRateLimits();
  });

  it("RATE LIMITING: Locks out after 5 consecutive failed login attempts", () => {
    const wrongEmail = "admin@mailguard.local";
    const wrongPassword = "WrongPassword123!";

    // First 4 attempts fail normally
    for (let i = 0; i < 4; i++) {
      const res = AuthService.validateCredentials(wrongEmail, wrongPassword);
      expect(res.valid).toBe(false);
      expect(res.reason).toBe("Invalid administrator credentials");
    }

    // 5th failed attempt triggers lockout
    const res5 = AuthService.validateCredentials(wrongEmail, wrongPassword);
    expect(res5.valid).toBe(false);

    // Subsequent attempt is blocked by lockout timer
    const lockedRes = AuthService.validateCredentials(wrongEmail, wrongPassword);
    expect(lockedRes.valid).toBe(false);
    expect(lockedRes.reason).toContain("Locked for");
  });

  it("SECRET ROTATION: Successfully verifies tokens signed with fallback secret", () => {
    const primarySecret = "primary_secret_32_characters_long_key_1";
    const oldSecret = "fallback_secret_32_characters_long_key_2";

    // Create token signed with oldSecret
    process.env.SESSION_SECRET = oldSecret;
    delete process.env.SESSION_SECRET_FALLBACK;
    const oldToken = AuthService.createToken("admin@mailguard.local");

    // Rotate primary secret and set fallback
    process.env.SESSION_SECRET = primarySecret;
    process.env.SESSION_SECRET_FALLBACK = oldSecret;

    // Token created with oldSecret should still verify successfully
    const verified = AuthService.verifyToken(oldToken);
    expect(verified.valid).toBe(true);
    expect(verified.email).toBe("admin@mailguard.local");

    // Clean up
    delete process.env.SESSION_SECRET_FALLBACK;
  });

  it("TAMPERED SESSION: Rejects token with modified payload or forged signature", () => {
    const validToken = AuthService.createToken("admin@mailguard.local");
    const [payload, sig] = validToken.split(".");

    // Tampered payload
    const tamperedPayload = Buffer.from(JSON.stringify({ email: "attacker@evil.com", exp: 9999999999 })).toString("base64url");
    const forgedToken = `${tamperedPayload}.${sig}`;

    const res = AuthService.verifyToken(forgedToken);
    expect(res.valid).toBe(false);

    // Tampered signature
    const corruptSigToken = `${payload}.invalid_signature_12345`;
    const res2 = AuthService.verifyToken(corruptSigToken);
    expect(res2.valid).toBe(false);
  });
});
