import type { UsageProvider } from "./types";
import { env } from "@/lib/env";

export const anthropicProvider: UsageProvider = {
  name: "anthropic",
  isConfigured: () => !!env.anthropicAdminKey,
  async fetchUsage() {
    throw new Error("Not implemented");
  },
};
