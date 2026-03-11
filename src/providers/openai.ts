import type { UsageProvider, UsageRecord } from "./types";
import { env } from "@/lib/env";

const API_BASE = "https://api.openai.com/v1/organization";

interface UsageBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    input_tokens: number;
    output_tokens: number;
    model: string | null;
    num_model_requests: number;
  }>;
}

interface CostBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    amount: { value: number; currency: string };
    line_item: string | null;
  }>;
}

const fetchWithAuth = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.openaiAdminKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
};

const fetchAllPages = async <T>(baseUrl: string): Promise<T[]> => {
  const results: T[] = [];
  let url = baseUrl;
  while (true) {
    const data = await fetchWithAuth(url);
    results.push(...data.data);
    if (!data.has_more) break;
    url = `${baseUrl}&page=${data.next_page}`;
  }
  return results;
};

export const openaiProvider: UsageProvider = {
  name: "openai",

  isConfigured: () => !!env.openaiAdminKey,

  async fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);

    const [usageBuckets, costBuckets] = await Promise.all([
      fetchAllPages<UsageBucket>(
        `${API_BASE}/usage/completions?start_time=${startUnix}&end_time=${endUnix}&bucket_width=1h&group_by[]=model`
      ),
      fetchAllPages<CostBucket>(
        `${API_BASE}/costs?start_time=${startUnix}&end_time=${endUnix}&bucket_width=1d&group_by[]=line_item`
      ),
    ]);

    // Build cost lookup: "model|day_start" -> cost
    const costMap = new Map<string, number>();
    for (const b of costBuckets) {
      for (const r of b.results) {
        if (r.line_item) {
          costMap.set(`${r.line_item}|${b.start_time}`, r.amount.value);
        }
      }
    }

    // Count total tokens per model per day for proportional cost distribution
    // (OpenAI costs API only supports daily granularity)
    const modelDayTokens = new Map<string, number>();
    for (const bucket of usageBuckets) {
      for (const r of bucket.results) {
        if (!r.model) continue;
        const dayStart = Math.floor(bucket.start_time / 86400) * 86400;
        const key = `${r.model}|${dayStart}`;
        modelDayTokens.set(key, (modelDayTokens.get(key) ?? 0) + r.input_tokens + r.output_tokens);
      }
    }

    const records: UsageRecord[] = [];
    for (const bucket of usageBuckets) {
      for (const r of bucket.results) {
        if (!r.model) continue;
        const dayStart = Math.floor(bucket.start_time / 86400) * 86400;
        const dayCost = costMap.get(`${r.model}|${dayStart}`) ?? 0;
        const dayTokens = modelDayTokens.get(`${r.model}|${dayStart}`) ?? 1;
        const bucketTokens = r.input_tokens + r.output_tokens;
        // Distribute daily cost proportionally by token count
        const proportionalCost = dayCost * (bucketTokens / dayTokens);

        records.push({
          provider: "openai",
          model: r.model,
          inputTokens: r.input_tokens,
          outputTokens: r.output_tokens,
          costUsd: proportionalCost,
          periodStart: new Date(bucket.start_time * 1000).toISOString(),
          periodEnd: new Date(bucket.end_time * 1000).toISOString(),
        });
      }
    }
    return records;
  },
};
