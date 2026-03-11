import type { UsageProvider } from "./types";
import { env } from "@/lib/env";

export const openaiProvider: UsageProvider = {
  name: "openai",
  isConfigured: () => !!env.openaiAdminKey,
  async fetchUsage() {
    throw new Error("Not implemented");
  },
};
