import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { getConfiguredProviders } from "@/providers/registry";
import {
  insertUsageRecords,
  logPoll,
  getSpendByPeriod,
  getEnabledAlertRules,
  updateLastTriggered,
  seedAlertRulesFromEnv,
} from "@/db/queries";
import { checkAndFireAlerts } from "@/alerts/engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const providers = getConfiguredProviders();
  const results: Array<{ provider: string; status: string; error?: string }> = [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // 1 hour ago

  for (const provider of providers) {
    try {
      const records = await provider.fetchUsage(startDate, endDate);
      if (records.length > 0) {
        await insertUsageRecords(
          db,
          records.map((r) => ({
            ...r,
            recordedAt: new Date().toISOString(),
          }))
        );
      }
      await logPoll(db, provider.name, "ok");
      results.push({ provider: provider.name, status: "ok" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await logPoll(db, provider.name, "error", msg);
      results.push({ provider: provider.name, status: "error", error: msg });
    }
  }

  // Seed alert rules from env on first run
  if (env.alertWebhookUrl) {
    await seedAlertRulesFromEnv(db, {
      webhookUrl: env.alertWebhookUrl,
      daily: env.alertDailyThreshold,
      weekly: env.alertWeeklyThreshold,
      monthly: env.alertMonthlyThreshold,
    });
  }

  // Check alerts from alert_rules table
  const now = new Date();
  const rules = await getEnabledAlertRules(db);

  for (const rule of rules) {
    const periodStart = rule.period === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      : rule.period === "weekly"
      ? new Date(now.getTime() - 7 * 86400000).toISOString()
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const spend = await getSpendByPeriod(db, periodStart, now.toISOString(), rule.provider ?? undefined);

    const { fired } = await checkAndFireAlerts({
      rule: rule as Parameters<typeof checkAndFireAlerts>[0]["rule"],
      currentSpend: spend,
      now,
    });

    if (fired) {
      await updateLastTriggered(db, rule.id, now.toISOString());
    }
  }

  return Response.json({ results });
}
