import { beforeAll } from "vitest";
import { runMigrations } from "@/server/db/migrate";

(process.env as any).NODE_ENV = "test";
process.env.ALLOW_PRIVATE_IPS = "true";
process.env.SESSION_SECRET = "test-secret-key-for-mailguard-unit-testing-32chars";

beforeAll(async () => {
  try {
    await runMigrations();
  } catch (err) {
    console.warn("Test migration warning:", err);
  }
});
