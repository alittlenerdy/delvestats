export const env = {
  // Database
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  tursoToken: process.env.TURSO_AUTH_TOKEN,

  // Providers
  anthropicAdminKey: process.env.ANTHROPIC_ADMIN_KEY,
  openaiAdminKey: process.env.OPENAI_ADMIN_KEY,
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
  kimiApiKey: process.env.KIMI_API_KEY,

  // Alerts
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  alertDailyThreshold: Number(process.env.ALERT_DAILY_THRESHOLD) || 0,
  alertWeeklyThreshold: Number(process.env.ALERT_WEEKLY_THRESHOLD) || 0,
  alertMonthlyThreshold: Number(process.env.ALERT_MONTHLY_THRESHOLD) || 0,

  // Cron
  cronSecret: process.env.CRON_SECRET,
} as const;
