import { sql, desc } from "drizzle-orm";
import { usageRecords, pollLog } from "./schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

export async function getKpiSpend(db: DB) {
  const now = new Date();
  const todayStart = now.toISOString().split("T")[0] + "T00:00:00.000Z";
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const [todayResult, weekResult, monthResult] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${todayStart}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${weekStart}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${monthStart}`),
  ]);

  return {
    today: todayResult[0].total,
    week: weekResult[0].total,
    month: monthResult[0].total,
  };
}

export async function getDailySpendByProvider(db: DB, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = await db
    .select({
      date: sql<string>`DATE(${usageRecords.periodStart})`.as("date"),
      provider: usageRecords.provider,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
    .from(usageRecords)
    .where(sql`${usageRecords.periodStart} >= ${since}`)
    .groupBy(sql`DATE(${usageRecords.periodStart})`, usageRecords.provider)
    .orderBy(sql`DATE(${usageRecords.periodStart})`);

  return rows;
}

export async function getProviderBreakdown(db: DB) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  return db
    .select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      inputTokens: sql<number>`SUM(${usageRecords.inputTokens})`.as("input_tokens"),
      outputTokens: sql<number>`SUM(${usageRecords.outputTokens})`.as("output_tokens"),
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
    .from(usageRecords)
    .where(sql`${usageRecords.periodStart} >= ${monthStart}`)
    .groupBy(usageRecords.provider, usageRecords.model)
    .orderBy(usageRecords.provider, usageRecords.model);
}

export async function getModelTrends(db: DB) {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const lastWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [thisWeek, lastWeek] = await Promise.all([
    db.select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${thisWeekStart}`)
      .groupBy(usageRecords.provider, usageRecords.model),
    db.select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${lastWeekStart} AND ${usageRecords.periodStart} < ${thisWeekStart}`)
      .groupBy(usageRecords.provider, usageRecords.model),
  ]);

  const thisWeekMap = new Map(thisWeek.map((r) => [`${r.provider}|${r.model}`, r.cost]));
  const lastWeekMap = new Map(lastWeek.map((r) => [`${r.provider}|${r.model}`, r.cost]));

  // Merge all model keys from both weeks
  const allKeys = new Set([...thisWeekMap.keys(), ...lastWeekMap.keys()]);

  return Array.from(allKeys).map((key) => {
    const [provider, model] = key.split("|");
    const current = thisWeekMap.get(key) ?? 0;
    const prev = lastWeekMap.get(key) ?? 0;
    const trend = prev === 0 ? (current > 0 ? 100 : 0) : ((current - prev) / prev) * 100;
    return { provider, model, trend };
  });
}

export async function getLatestPollPerProvider(db: DB) {
  // SQLite doesn't have DISTINCT ON, so we use a subquery for max polled_at per provider
  const rows = await db
    .select({
      provider: pollLog.provider,
      status: pollLog.status,
      polledAt: pollLog.polledAt,
    })
    .from(pollLog)
    .where(
      sql`${pollLog.id} IN (
        SELECT id FROM poll_log AS p2
        WHERE p2.polled_at = (
          SELECT MAX(p3.polled_at) FROM poll_log AS p3 WHERE p3.provider = p2.provider
        )
      )`
    )
    .orderBy(desc(pollLog.polledAt));

  // Deduplicate in case of ties
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.provider)) return false;
    seen.add(r.provider);
    return true;
  });
}
