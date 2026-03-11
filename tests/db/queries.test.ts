import { describe, it, expect, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/db/schema";
import { insertUsageRecords, getSpendByPeriod, getRecentPollLogs, logPoll } from "@/db/queries";

const client = createClient({ url: "file::memory:" });
const testDb = drizzle(client, { schema });

describe("database queries", () => {
  beforeEach(async () => {
    await client.execute("DROP TABLE IF EXISTS usage_records");
    await client.execute("DROP TABLE IF EXISTS poll_log");
    await client.execute(`CREATE TABLE usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE poll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_msg TEXT,
      polled_at TEXT NOT NULL
    )`);
  });

  it("inserts usage records", async () => {
    const records = [{
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.015,
      recordedAt: "2026-03-10T00:00:00Z",
      periodStart: "2026-03-10T00:00:00Z",
      periodEnd: "2026-03-10T01:00:00Z",
    }];
    await insertUsageRecords(testDb, records);
    const rows = await testDb.select().from(schema.usageRecords);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("anthropic");
  });

  it("calculates spend for a time period", async () => {
    await testDb.insert(schema.usageRecords).values([
      { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 1000, outputTokens: 500, costUsd: 0.01, recordedAt: "2026-03-10T12:00:00Z", periodStart: "2026-03-10T00:00:00Z", periodEnd: "2026-03-10T01:00:00Z" },
      { provider: "openai", model: "gpt-4o", inputTokens: 2000, outputTokens: 800, costUsd: 0.02, recordedAt: "2026-03-10T12:00:00Z", periodStart: "2026-03-10T00:00:00Z", periodEnd: "2026-03-10T01:00:00Z" },
    ]);
    const spend = await getSpendByPeriod(testDb, "2026-03-10T00:00:00Z", "2026-03-11T00:00:00Z");
    expect(spend).toBeCloseTo(0.03);
  });

  it("logs poll results", async () => {
    await logPoll(testDb, "anthropic", "ok");
    const logs = await getRecentPollLogs(testDb, 10);
    expect(logs).toHaveLength(1);
    expect(logs[0].provider).toBe("anthropic");
    expect(logs[0].status).toBe("ok");
  });
});
