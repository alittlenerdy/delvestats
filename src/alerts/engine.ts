interface AlertRule {
  id: number;
  provider: string | null;
  thresholdUsd: number;
  period: "daily" | "weekly" | "monthly";
  webhookUrl: string;
  enabled: boolean;
  lastTriggered: string | null;
}

interface SlackPayload {
  text: string;
}

export const formatSlackPayload = (params: {
  provider: string | null;
  period: string;
  currentSpend: number;
  threshold: number;
}): SlackPayload => {
  const providerLabel = params.provider ?? "All providers";
  return {
    text: `🚨 *DelveStats Alert*\n*${providerLabel}* ${params.period} spend: *$${params.currentSpend.toFixed(2)}* exceeded threshold of *$${params.threshold.toFixed(2)}*`,
  };
};

const getPeriodStart = (now: Date, period: "daily" | "weekly" | "monthly"): Date => {
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "weekly":
      return new Date(now.getTime() - 7 * 86400000);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
};

const wasTriggeredInCurrentPeriod = (
  lastTriggered: string | null,
  now: Date,
  period: "daily" | "weekly" | "monthly"
): boolean => {
  if (!lastTriggered) return false;
  const triggerDate = new Date(lastTriggered);
  const periodStart = getPeriodStart(now, period);
  return triggerDate >= periodStart;
};

export const checkAndFireAlerts = async (params: {
  rule: AlertRule;
  currentSpend: number;
  now: Date;
}): Promise<{ fired: boolean }> => {
  const { rule, currentSpend, now } = params;

  if (currentSpend <= rule.thresholdUsd) return { fired: false };
  if (wasTriggeredInCurrentPeriod(rule.lastTriggered, now, rule.period)) return { fired: false };

  const payload = formatSlackPayload({
    provider: rule.provider,
    period: rule.period,
    currentSpend,
    threshold: rule.thresholdUsd,
  });

  await fetch(rule.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { fired: true };
};
