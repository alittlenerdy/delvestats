import { db } from "@/db/client";
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
} from "@/db/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const [kpi, dailySpend, breakdown, trends, polls] = await Promise.all([
    getKpiSpend(db),
    getDailySpendByProvider(db, 30),
    getProviderBreakdown(db),
    getModelTrends(db),
    getLatestPollPerProvider(db),
  ]);

  // Pivot daily spend rows into chart format: { date, anthropic: X, openai: Y, ... }
  const chartMap = new Map<string, Record<string, string | number>>();
  for (const row of dailySpend) {
    if (!chartMap.has(row.date)) {
      chartMap.set(row.date, { date: row.date });
    }
    const entry = chartMap.get(row.date)!;
    entry[row.provider] = row.cost;
  }
  const chart = Array.from(chartMap.values());

  // Group breakdown into provider -> models structure
  const providerMap = new Map<string, {
    name: string;
    totalCost: number;
    models: Array<{ model: string; inputTokens: number; outputTokens: number; cost: number }>;
    lastPollStatus: "ok" | "error";
    lastPollAt: string;
  }>();

  for (const row of breakdown) {
    if (!providerMap.has(row.provider)) {
      const poll = polls.find((p) => p.provider === row.provider);
      providerMap.set(row.provider, {
        name: row.provider,
        totalCost: 0,
        models: [],
        lastPollStatus: (poll?.status as "ok" | "error") ?? "ok",
        lastPollAt: poll?.polledAt ?? "",
      });
    }
    const provider = providerMap.get(row.provider)!;
    provider.totalCost += row.cost;
    provider.models.push({
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cost: row.cost,
    });
  }
  const providers = Array.from(providerMap.values());

  // Merge trends into table rows
  const trendMap = new Map(trends.map((t) => [`${t.provider}|${t.model}`, t.trend]));
  const table = breakdown.map((row) => ({
    provider: row.provider,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cost: row.cost,
    trend: trendMap.get(`${row.provider}|${row.model}`) ?? 0,
  }));

  // Most recent poll timestamp across all providers
  const lastPolledAt = polls.length > 0 ? polls[0].polledAt : "";

  return Response.json({ kpi, chart, providers, table, lastPolledAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
