import type { UsageProvider } from "./types";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { googleProvider } from "./google";
import { kimiProvider } from "./kimi";

const allProviders: UsageProvider[] = [
  anthropicProvider,
  openaiProvider,
  googleProvider,
  kimiProvider,
];

export const getConfiguredProviders = (): UsageProvider[] => {
  return allProviders.filter((p) => p.isConfigured());
};
