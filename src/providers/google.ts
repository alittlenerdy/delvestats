import type { UsageProvider } from "./types";

// Google AI Studio does not provide a programmatic usage API.
// Future: implement via BigQuery export for Vertex AI users.
export const googleProvider: UsageProvider = {
  name: "google",
  isConfigured: () => false,
  async fetchUsage() {
    return [];
  },
};
