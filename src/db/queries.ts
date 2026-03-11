import { sql, and, gte, lte, desc, eq } from "drizzle-orm";
import { usageRecords, pollLog, alertRules } from "./schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

export const insertUsageRecords = async (
  db: DB,
  records: (typeof usageRecords.$inferInsert)[]
) => {
  if (records.length === 0) return;
  await db.insert(usageRecords).values(records);
};

export const getSpendByPeriod = async (
  db: DB,
  start: string,
  end: string,
  provider?: string
): Promise<number> => {
  const conditions = [
    gte(usageRecords.periodStart, start),
    lte(usageRecords.periodEnd, end),
  ];
  if (provider) {
    conditions.push(sql`${usageRecords.provider} = ${provider}`);
  }
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
    .from(usageRecords)
    .where(and(...conditions));
  return result[0].total;
};

export const logPoll = async (
  db: DB,
  provider: string,
  status: "ok" | "error",
  errorMsg?: string
) => {
  await db.insert(pollLog).values({
    provider,
    status,
    errorMsg: errorMsg ?? null,
    polledAt: new Date().toISOString(),
  });
};

export const getRecentPollLogs = async (db: DB, limit: number) => {
  return db
    .select()
    .from(pollLog)
    .orderBy(desc(pollLog.polledAt))
    .limit(limit);
};

export const getEnabledAlertRules = async (db: DB) => {
  return db.select().from(alertRules).where(eq(alertRules.enabled, true));
};

export const updateLastTriggered = async (db: DB, ruleId: number, timestamp: string) => {
  await db.update(alertRules).set({ lastTriggered: timestamp }).where(eq(alertRules.id, ruleId));
};

export const seedAlertRulesFromEnv = async (
  db: DB,
  config: { webhookUrl: string; daily: number; weekly: number; monthly: number }
) => {
  const existing = await db.select().from(alertRules);
  if (existing.length > 0) return;

  const rules: (typeof alertRules.$inferInsert)[] = [];
  if (config.daily > 0) {
    rules.push({ thresholdUsd: config.daily, period: "daily", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (config.weekly > 0) {
    rules.push({ thresholdUsd: config.weekly, period: "weekly", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (config.monthly > 0) {
    rules.push({ thresholdUsd: config.monthly, period: "monthly", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (rules.length > 0) {
    await db.insert(alertRules).values(rules);
  }
};
