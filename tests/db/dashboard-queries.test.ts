import { describe, it, expect, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/db/schema";
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
} from "@/db/dashboard-queries";

const client = createClient({ url: "file::memory:" });
const testDb = drizzle(client, { schema });

// Helper: insert a usage record
async function insertRecord(overrides: Partial<typeof schema.usageRecords.$inferInsert> = {}) {
  const defaults = {
    provider: "anthropic",
    model: "claude-sonnet-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 1.0,
    recordedAt: new Date().toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  };
  await testDb.insert(schema.usageRecords).values({ ...defaults, ...overrides });
}

describe("dashboard queries", () => {
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

  describe("getKpiSpend", () => {
    it("returns today, week, and month totals", async () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.000Z`;

      // Record from today
      await insertRecord({ costUsd: 5.0, periodStart: todayStart, periodEnd: todayEnd });
      // Record from 3 days ago (within week)
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      await insertRecord({ costUsd: 10.0, periodStart: threeDaysAgo.toISOString(), periodEnd: threeDaysAgo.toISOString() });
      // Record from 2 days ago (within month and week)
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      await insertRecord({ costUsd: 7.0, periodStart: twoDaysAgo.toISOString(), periodEnd: twoDaysAgo.toISOString() });

      const kpi = await getKpiSpend(testDb);
      expect(kpi.today).toBeCloseTo(5.0);
      expect(kpi.week).toBeCloseTo(22.0); // 5 + 10 + 7
      expect(kpi.month).toBeGreaterThanOrEqual(22.0); // at least week's worth
    });
  });

  describe("getDailySpendByProvider", () => {
    it("returns daily spend grouped by provider", async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const todayStart = `${todayStr}T00:00:00Z`;
      const todayEnd = `${todayStr}T23:59:59Z`;

      await insertRecord({ provider: "anthropic", costUsd: 3.0, periodStart: todayStart, periodEnd: todayEnd });
      await insertRecord({ provider: "openai", costUsd: 2.0, periodStart: todayStart, periodEnd: todayEnd });

      const rows = await getDailySpendByProvider(testDb, 30);
      const todayRow = rows.find((r) => r.date === todayStr);
      expect(todayRow).toBeDefined();
      expect(todayRow!.provider).toBeDefined();
    });
  });

  describe("getProviderBreakdown", () => {
    it("returns per-provider per-model aggregation", async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 5.0, inputTokens: 1000, outputTokens: 500, periodStart: monthStart });
      await insertRecord({ provider: "anthropic", model: "claude-opus-4", costUsd: 10.0, inputTokens: 2000, outputTokens: 1000, periodStart: monthStart });
      await insertRecord({ provider: "openai", model: "gpt-4o", costUsd: 3.0, inputTokens: 500, outputTokens: 200, periodStart: monthStart });

      const breakdown = await getProviderBreakdown(testDb);
      expect(breakdown).toHaveLength(3); // 3 rows: one per provider+model combo
      const anthropicSonnet = breakdown.find((r) => r.provider === "anthropic" && r.model === "claude-sonnet-4");
      expect(anthropicSonnet).toBeDefined();
      expect(anthropicSonnet!.cost).toBeCloseTo(5.0);
    });
  });

  describe("getModelTrends", () => {
    it("calculates week-over-week trend", async () => {
      const now = new Date();
      // This week: $10
      const thisWeekDate = new Date(now.getTime() - 2 * 86400000);
      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 10.0, periodStart: thisWeekDate.toISOString() });
      // Last week: $5
      const lastWeekDate = new Date(now.getTime() - 10 * 86400000);
      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 5.0, periodStart: lastWeekDate.toISOString() });

      const trends = await getModelTrends(testDb);
      const sonnetTrend = trends.find((t) => t.model === "claude-sonnet-4");
      expect(sonnetTrend).toBeDefined();
      // $10 this week vs $5 last week = +100%
      expect(sonnetTrend!.trend).toBeCloseTo(100);
    });
  });

  describe("getLatestPollPerProvider", () => {
    it("returns most recent poll per provider", async () => {
      await testDb.insert(schema.pollLog).values([
        { provider: "anthropic", status: "ok", polledAt: "2026-03-10T10:00:00Z" },
        { provider: "anthropic", status: "error", errorMsg: "timeout", polledAt: "2026-03-10T11:00:00Z" },
        { provider: "openai", status: "ok", polledAt: "2026-03-10T10:30:00Z" },
      ]);

      const latest = await getLatestPollPerProvider(testDb);
      expect(latest).toHaveLength(2);
      const anthropic = latest.find((p) => p.provider === "anthropic");
      expect(anthropic!.status).toBe("error"); // most recent
      expect(anthropic!.polledAt).toBe("2026-03-10T11:00:00Z");
    });
  });
});
