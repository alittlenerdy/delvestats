/**
 * DelveStats Usage Reporting Middleware
 *
 * Drop this file into any project that uses Anthropic or OpenAI SDKs.
 * It wraps the client to automatically report usage to DelveStats.
 *
 * Env vars required:
 *   DELVESTATS_INGEST_URL — e.g., https://delvestats.ai/api/ingest
 *   DELVESTATS_API_KEY    — matches INGEST_API_KEY on the DelveStats server
 */

const DELVESTATS_URL = process.env.DELVESTATS_INGEST_URL;
const DELVESTATS_KEY = process.env.DELVESTATS_API_KEY;

// Per-1M-token pricing
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-20250514": { input: 0.80, output: 4 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-4.1-nano": { input: 0.10, output: 0.40 },
  "o3": { input: 2, output: 8 },
  "o3-mini": { input: 1.10, output: 4.40 },
  "o4-mini": { input: 1.10, output: 4.40 },
};

const calculateCost = (model: string, inputTokens: number, outputTokens: number): number => {
  const pricing = PRICING[model] ?? Object.entries(PRICING).find(([key]) => model.startsWith(key))?.[1];
  if (!pricing) {
    console.warn(`[delvestats] Unknown model "${model}" — reporting with $0 cost. Update PRICING table.`);
    return 0;
  }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
};

const reportUsage = (data: {
  project: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestId: string;
}) => {
  if (!DELVESTATS_URL || !DELVESTATS_KEY) return;

  fetch(DELVESTATS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DELVESTATS_KEY}`,
    },
    body: JSON.stringify(data),
  }).catch((err) => {
    console.warn(`[delvestats] Failed to report usage: ${err.message}`);
  });
};

const generateId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface DelvestatsConfig {
  project: string;
}

/**
 * Wrap an Anthropic client to auto-report usage.
 * Usage: const client = withDelvestatsAnthropic(new Anthropic(), { project: "my-app" });
 */
export const withDelvestatsAnthropic = <T extends { messages: { create: (...args: unknown[]) => Promise<unknown> } }>(
  client: T,
  config: DelvestatsConfig
): T => {
  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = async (...args: unknown[]) => {
    const result = await originalCreate(...args);
    const response = result as {
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (response.usage && response.model) {
      const { input_tokens, output_tokens } = response.usage;
      reportUsage({
        project: config.project,
        provider: "anthropic",
        model: response.model,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: calculateCost(response.model, input_tokens, output_tokens),
        requestId: generateId(),
      });
    }

    return result;
  };

  return client;
};

/**
 * Wrap an OpenAI client to auto-report usage.
 * Usage: const client = withDelvestatsOpenAI(new OpenAI(), { project: "my-app" });
 */
export const withDelvestatsOpenAI = <T extends { chat: { completions: { create: (...args: unknown[]) => Promise<unknown> } } }>(
  client: T,
  config: DelvestatsConfig
): T => {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async (...args: unknown[]) => {
    const result = await originalCreate(...args);
    const response = result as {
      model?: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    if (response.usage && response.model) {
      const { prompt_tokens, completion_tokens } = response.usage;
      reportUsage({
        project: config.project,
        provider: "openai",
        model: response.model,
        inputTokens: prompt_tokens,
        outputTokens: completion_tokens,
        costUsd: calculateCost(response.model, prompt_tokens, completion_tokens),
        requestId: generateId(),
      });
    }

    return result;
  };

  return client;
};
