import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const usageRecords = sqliteTable("usage_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  recordedAt: text("recorded_at").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
});

export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider"),
  thresholdUsd: real("threshold_usd").notNull(),
  period: text("period", { enum: ["daily", "weekly", "monthly"] }).notNull(),
  webhookUrl: text("webhook_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastTriggered: text("last_triggered"),
});

export const pollLog = sqliteTable("poll_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  status: text("status", { enum: ["ok", "error"] }).notNull(),
  errorMsg: text("error_msg"),
  polledAt: text("polled_at").notNull(),
});
