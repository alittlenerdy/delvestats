import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    cronSecret: "test-secret",
    alertWebhookUrl: null,
    alertDailyThreshold: 0,
    alertWeeklyThreshold: 0,
    alertMonthlyThreshold: 0,
  },
}));

const mockInsertUsageRecords = vi.fn();
const mockLogPoll = vi.fn();
const mockGetSpendByPeriod = vi.fn().mockResolvedValue(0);
const mockGetEnabledAlertRules = vi.fn().mockResolvedValue([]);
const mockUpdateLastTriggered = vi.fn();
const mockSeedAlertRulesFromEnv = vi.fn();

vi.mock("@/db/queries", () => ({
  insertUsageRecords: (...args: unknown[]) => mockInsertUsageRecords(...args),
  logPoll: (...args: unknown[]) => mockLogPoll(...args),
  getSpendByPeriod: (...args: unknown[]) => mockGetSpendByPeriod(...args),
  getEnabledAlertRules: (...args: unknown[]) => mockGetEnabledAlertRules(...args),
  updateLastTriggered: (...args: unknown[]) => mockUpdateLastTriggered(...args),
  seedAlertRulesFromEnv: (...args: unknown[]) => mockSeedAlertRulesFromEnv(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

const mockProvider = {
  name: "anthropic",
  isConfigured: () => true,
  fetchUsage: vi.fn().mockResolvedValue([{
    provider: "anthropic",
    model: "claude-sonnet-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.01,
    periodStart: "2026-03-10T00:00:00Z",
    periodEnd: "2026-03-10T01:00:00Z",
  }]),
};

vi.mock("@/providers/registry", () => ({
  getConfiguredProviders: () => [mockProvider],
}));

vi.mock("@/alerts/engine", () => ({
  checkAndFireAlerts: vi.fn().mockResolvedValue({ fired: false }),
}));

import { GET } from "@/app/api/cron/poll/route";
import { NextRequest } from "next/server";

describe("cron poll endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized requests", async () => {
    const req = new NextRequest("http://localhost/api/cron/poll", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("polls providers and inserts records", async () => {
    const req = new NextRequest("http://localhost/api/cron/poll", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].provider).toBe("anthropic");
    expect(body.results[0].status).toBe("ok");

    expect(mockInsertUsageRecords).toHaveBeenCalled();
    expect(mockLogPoll).toHaveBeenCalledWith(expect.anything(), "anthropic", "ok");
  });
});
