import type { UsageProvider } from "./types";

// Moonshot/Kimi only provides a balance endpoint, not historical usage.
// Future: implement if they add a usage reporting API.
export const kimiProvider: UsageProvider = {
  name: "kimi",
  isConfigured: () => false,
  async fetchUsage() {
    return [];
  },
};
