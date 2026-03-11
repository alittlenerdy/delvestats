import type { UsageProvider, UsageRecord } from "./types";
import { env } from "@/lib/env";

const API_BASE = "https://api.anthropic.com/v1/organizations";

interface UsageBucket {
  bucket_start_time: string;
  bucket_end_time: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

interface CostBucket {
  bucket_start_time: string;
  bucket_end_time: string;
  amount: number; // cents
  description: string;
}

const fetchWithAuth = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      "x-api-key": env.anthropicAdminKey!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
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

export const anthropicProvider: UsageProvider = {
  name: "anthropic",

  isConfigured: () => !!env.anthropicAdminKey,

  async fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const [usageBuckets, costBuckets] = await Promise.all([
      fetchAllPages<UsageBucket>(
        `${API_BASE}/usage_report/messages?starting_at=${start}&ending_at=${end}&bucket_width=1h&group_by[]=model`
      ),
      fetchAllPages<CostBucket>(
        `${API_BASE}/cost_report?starting_at=${start}&ending_at=${end}&bucket_width=1h`
      ),
    ]);

    // Build cost lookup: "model|start" -> cost in USD
    const costMap = new Map<string, number>();
    for (const c of costBuckets) {
      costMap.set(
        `${c.description}|${c.bucket_start_time}`,
        c.amount / 100 // cents to dollars
      );
    }

    return usageBuckets.map((u) => ({
      provider: "anthropic",
      model: u.model,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      costUsd: costMap.get(`${u.model}|${u.bucket_start_time}`) ?? 0,
      periodStart: u.bucket_start_time,
      periodEnd: u.bucket_end_time,
    }));
  },
};
