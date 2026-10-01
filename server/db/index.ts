import pg from "pg";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const { Pool } = pg;

// Global singleton for connection pooling
type DrizzleDb = ReturnType<typeof drizzlePg<typeof schema>> | ReturnType<typeof drizzlePglite<typeof schema>>;

let globalDb: DrizzleDb | null = null;
let globalPool: pg.Pool | null = null;
let globalPglite: PGlite | null = null;

export function getDb(): DrizzleDb {
  if (globalDb) {
    return globalDb;
  }

  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl && (databaseUrl.startsWith("postgres://") || databaseUrl.startsWith("postgresql://"))) {
    globalPool = new Pool({
      connectionString: databaseUrl,
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    globalDb = drizzlePg(globalPool, { schema });
    return globalDb;
  }

  // Fallback to embedded PGlite for self-contained local dev / testing
  const dbDir = process.env.PGLITE_DIR || path.join(process.cwd(), "storage", "db");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  } else {
    // Automatically recover from stale lock files left by previous crashes or SIGKILL
    for (const staleFile of ["postmaster.pid", ".s.PGSQL.5432.lock.out", ".s.PGSQL.5432.lock"]) {
      const lockPath = path.join(dbDir, staleFile);
      if (fs.existsSync(lockPath)) {
        try {
          fs.unlinkSync(lockPath);
        } catch {}
      }
    }
  }

  globalPglite = new PGlite(process.env.NODE_ENV === "test" ? undefined : dbDir);
  globalDb = drizzlePglite(globalPglite, { schema });
  return globalDb;
}

// Export a lazy Proxy so importing db doesn't eagerly initialize during build-time module resolution
export const db = new Proxy({} as DrizzleDb, {
  get(_target, prop) {
    const instance = getDb();
    const value = (instance as any)[prop];
    if (typeof value === "function") {
      return value.bind(instance);
    }
    return value;
  },
});
export { schema };

export async function closeDb(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
  }
  if (globalPglite) {
    await globalPglite.close();
    globalPglite = null;
  }
  globalDb = null;
}
