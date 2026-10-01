import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_COOKIE_NAME = "mailguard_session";
const SESSION_EXPIRY_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Login rate limiting map
const loginAttempts = new Map<string, { attempts: number; lockedUntil: number }>();

export class AuthService {
  private static getSecret(): string {
    const secret = process.env.SESSION_SECRET;
    if (process.env.NODE_ENV === "production") {
      if (!secret || secret.length < 32 || secret.includes("change-this") || secret.includes("default")) {
        throw new Error("[MailGuard Security] In production, SESSION_SECRET must be set to a secure string of at least 32 characters.");
      }
      return secret;
    }
    return secret || "mailguard_dev_session_secret_local_only_32_bytes";
  }

  /**
   * Hashes a password using SHA-256 with salt.
   */
  static hashPassword(password: string, salt = "mg_salt_"): string {
    return crypto.createHmac("sha256", salt).update(password).digest("hex");
  }

  /**
   * Validates admin login credentials against environment variables with timing-safe comparison.
   */
  static validateCredentials(emailInput: string, passwordInput: string): { valid: boolean; reason?: string } {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

    if (process.env.NODE_ENV === "production") {
      if (!adminEmail || !adminPasswordHash) {
        console.error("[MailGuard Security Alert] ADMIN_EMAIL or ADMIN_PASSWORD_HASH is not configured in production environment.");
        return { valid: false, reason: "Server authentication is misconfigured. Configure ADMIN_EMAIL and ADMIN_PASSWORD_HASH in environment." };
      }

      // Strictly reject known default dev passwords in production
      if (passwordInput === "MailguardDev2026!" || passwordInput === "admin" || passwordInput === "password") {
        return { valid: false, reason: "Default development passwords are strictly prohibited in production." };
      }
    }

    const effectiveAdminEmail = (adminEmail || "admin@mailguard.local").toLowerCase().trim();
    const normalizedInput = emailInput.toLowerCase().trim();

    // Check rate limit lock
    const now = Date.now();
    const rateInfo = loginAttempts.get(normalizedInput);
    if (rateInfo && rateInfo.lockedUntil > now) {
      const waitSeconds = Math.ceil((rateInfo.lockedUntil - now) / 1000);
      return { valid: false, reason: `Too many failed attempts. Locked for ${waitSeconds} seconds.` };
    }

    if (normalizedInput !== effectiveAdminEmail) {
      this.recordFailedAttempt(normalizedInput);
      return { valid: false, reason: "Invalid administrator credentials" };
    }

    // In production, ADMIN_PASSWORD_HASH is strictly required. No plaintext passwords allowed.
    let isMatch = false;
    if (adminPasswordHash) {
      const computedHash = this.hashPassword(passwordInput);
      const bufComputed = Buffer.from(computedHash, "hex");
      const bufAdmin = Buffer.from(adminPasswordHash, "hex");

      isMatch = bufComputed.length === bufAdmin.length && crypto.timingSafeEqual(bufComputed, bufAdmin);
    } else if (process.env.NODE_ENV !== "production") {
      // Dev/Test only fallback
      const devPassword = process.env.ADMIN_PASSWORD || "MailguardDev2026!";
      isMatch = passwordInput === devPassword;
    } else {
      return { valid: false, reason: "ADMIN_PASSWORD_HASH is required in production." };
    }

    if (!isMatch) {
      this.recordFailedAttempt(normalizedInput);
      return { valid: false, reason: "Invalid administrator credentials" };
    }

    // Clear failed attempts on success
    loginAttempts.delete(normalizedInput);
    return { valid: true };
  }

  private static recordFailedAttempt(identifier: string): void {
    const now = Date.now();
    const current = loginAttempts.get(identifier) || { attempts: 0, lockedUntil: 0 };
    current.attempts++;

    if (current.attempts >= 5) {
      current.lockedUntil = now + 60 * 1000; // 1 minute lockout after 5 fails
      current.attempts = 0;
    }

    loginAttempts.set(identifier, current);
  }

  /**
   * Resets rate limiting state (for testing)
   */
  static resetRateLimits(): void {
    loginAttempts.clear();
  }

  /**
   * Creates a cryptographically signed session token.
   */
  static createToken(userEmail: string): string {
    const payload = {
      email: userEmail,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS,
    };

    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto.createHmac("sha256", this.getSecret()).update(payloadB64).digest("base64url");
    return `${payloadB64}.${signature}`;
  }

  /**
   * Verifies a session token with timing-safe signature comparison and secret rotation support.
   */
  static verifyToken(token: string): { valid: boolean; email?: string } {
    if (!token || !token.includes(".")) {
      return { valid: false };
    }

    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) {
      return { valid: false };
    }

    // Support secret rotation (primary secret + optional fallback secret)
    const secrets = [this.getSecret()];
    if (process.env.SESSION_SECRET_FALLBACK) {
      secrets.push(process.env.SESSION_SECRET_FALLBACK);
    }

    let validSig = false;
    for (const sec of secrets) {
      const expectedSignature = crypto.createHmac("sha256", sec).update(payloadB64).digest("base64url");
      const bufSig = Buffer.from(signature);
      const bufExp = Buffer.from(expectedSignature);

      if (bufSig.length === bufExp.length && crypto.timingSafeEqual(bufSig, bufExp)) {
        validSig = true;
        break;
      }
    }

    if (!validSig) {
      return { valid: false };
    }

    try {
      const payloadJson = Buffer.from(payloadB64, "base64url").toString("utf-8");
      const payload = JSON.parse(payloadJson);

      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        return { valid: false }; // expired
      }

      return { valid: true, email: payload.email };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Gets current logged in admin session from request cookies.
   */
  static async getSession(): Promise<{ authenticated: boolean; email?: string }> {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

    if (!sessionCookie || !sessionCookie.value) {
      return { authenticated: false };
    }

    const verify = this.verifyToken(sessionCookie.value);
    if (!verify.valid || !verify.email) {
      return { authenticated: false };
    }

    return { authenticated: true, email: verify.email };
  }

  static getCookieConfig() {
    return {
      name: SESSION_COOKIE_NAME,
      maxAge: SESSION_EXPIRY_SECONDS,
      httpOnly: true,
      path: "/",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
  }
}
