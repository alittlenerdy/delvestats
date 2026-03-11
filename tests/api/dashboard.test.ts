import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetKpiSpend = vi.fn().mockResolvedValue({ today: 5.0, week: 30.0, month: 120.0 });
const mockGetDailySpendByProvider = vi.fn().mockResolvedValue([
  { date: "2026-03-10", provider: "anthropic", cost: 3.0 },
  { date: "2026-03-10", provider: "openai", cost: 2.0 },
]);
const mockGetProviderBreakdown = vi.fn().mockResolvedValue([
  { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 1000, outputTokens: 500, cost: 5.0 },
  { provider: "openai", model: "gpt-4o", inputTokens: 800, outputTokens: 300, cost: 3.0 },
]);
const mockGetModelTrends = vi.fn().mockResolvedValue([
  { provider: "anthropic", model: "claude-sonnet-4", trend: 12.5 },
  { provider: "openai", model: "gpt-4o", trend: -5.0 },
]);
const mockGetLatestPollPerProvider = vi.fn().mockResolvedValue([
  { provider: "anthropic", status: "ok", polledAt: "2026-03-10T12:00:00Z" },
  { provider: "openai", status: "ok", polledAt: "2026-03-10T11:30:00Z" },
]);

vi.mock("@/db/dashboard-queries", () => ({
  getKpiSpend: (...args: unknown[]) => mockGetKpiSpend(...args),
  getDailySpendByProvider: (...args: unknown[]) => mockGetDailySpendByProvider(...args),
  getProviderBreakdown: (...args: unknown[]) => mockGetProviderBreakdown(...args),
  getModelTrends: (...args: unknown[]) => mockGetModelTrends(...args),
  getLatestPollPerProvider: (...args: unknown[]) => mockGetLatestPollPerProvider(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

import { GET } from "@/app/api/dashboard/route";

describe("dashboard API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard data with correct shape", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kpi).toEqual({ today: 5.0, week: 30.0, month: 120.0 });
    expect(body.chart).toBeDefined();
    expect(body.chart[0].date).toBe("2026-03-10");
    expect(body.providers).toBeDefined();
    expect(body.providers[0].name).toBe("anthropic");
    expect(body.table).toBeDefined();
    expect(body.lastPolledAt).toBe("2026-03-10T12:00:00Z");
  });

  it("pivots daily spend into chart format", async () => {
    const res = await GET();
    const body = await res.json();

    const chartDay = body.chart[0];
    expect(chartDay.anthropic).toBe(3.0);
    expect(chartDay.openai).toBe(2.0);
  });

  it("groups provider breakdown into nested structure", async () => {
    const res = await GET();
    const body = await res.json();

    const anthropic = body.providers.find((p: { name: string }) => p.name === "anthropic");
    expect(anthropic.totalCost).toBe(5.0);
    expect(anthropic.models).toHaveLength(1);
    expect(anthropic.models[0].model).toBe("claude-sonnet-4");
  });

  it("merges trends into table data", async () => {
    const res = await GET();
    const body = await res.json();

    const sonnet = body.table.find((r: { model: string }) => r.model === "claude-sonnet-4");
    expect(sonnet.trend).toBe(12.5);
  });
});
