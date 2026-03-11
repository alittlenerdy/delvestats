import { describe, it, expect, vi } from "vitest";
import { getConfiguredProviders } from "@/providers/registry";

vi.mock("@/providers/anthropic", () => ({
  anthropicProvider: {
    name: "anthropic",
    isConfigured: () => false,
    fetchUsage: vi.fn(),
  },
}));

vi.mock("@/providers/openai", () => ({
  openaiProvider: {
    name: "openai",
    isConfigured: () => false,
    fetchUsage: vi.fn(),
  },
}));

vi.mock("@/providers/google", () => ({
  googleProvider: {
    name: "google",
    isConfigured: () => false,
    fetchUsage: vi.fn(),
  },
}));

vi.mock("@/providers/kimi", () => ({
  kimiProvider: {
    name: "kimi",
    isConfigured: () => false,
    fetchUsage: vi.fn(),
  },
}));

describe("provider registry", () => {
  it("returns empty when no providers are configured", () => {
    const providers = getConfiguredProviders();
    expect(providers).toEqual([]);
  });

  it("returns only configured providers", async () => {
    const { anthropicProvider } = await import("@/providers/anthropic");
    vi.spyOn(anthropicProvider, "isConfigured").mockReturnValue(true);

    const providers = getConfiguredProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("anthropic");
  });
});
