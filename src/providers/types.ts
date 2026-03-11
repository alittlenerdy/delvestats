export interface UsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  periodStart: string;
  periodEnd: string;
}

export interface UsageProvider {
  name: string;
  fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]>;
  isConfigured(): boolean;
}
