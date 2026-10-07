import { sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

// Mirrors the indexes declared in schema.ts. The production DB was created
// before they existed and has no migration runner, so apply them idempotently
// once per server instance. Without them every spend query is a full scan.
const STATEMENTS = [
  "CREATE INDEX IF NOT EXISTS poll_log_provider_polled_at_idx ON poll_log (provider, polled_at)",
  "CREATE INDEX IF NOT EXISTS usage_records_period_start_idx ON usage_records (period_start)",
  "CREATE INDEX IF NOT EXISTS usage_records_provider_period_start_idx ON usage_records (provider, period_start)",
];

let done: Promise<void> | null = null;

export const ensureIndexes = (db: LibSQLDatabase<typeof schema>): Promise<void> => {
  if (!done) {
    done = (async () => {
      for (const stmt of STATEMENTS) await db.run(sql.raw(stmt));
    })().catch((err) => {
      done = null; // retry on the next request
      console.error("ensureIndexes failed", err);
    });
  }
  return done;
};
