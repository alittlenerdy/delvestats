import { describe, it, expect, vi, beforeEach } from "vitest";
import { openaiProvider } from "@/providers/openai";

vi.mock("@/lib/env", () => ({
  env: { openaiAdminKey: "sk-admin-test-key" },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("openai provider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("isConfigured returns true when key is set", () => {
    expect(openaiProvider.isConfigured()).toBe(true);
  });

  it("fetches and normalizes usage data", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            start_time: 1741564800,
            end_time: 1741568400,
            results: [
              {
                input_tokens: 3000,
                output_tokens: 800,
                model: "gpt-4o",
                num_model_requests: 10,
              },
            ],
          },
        ],
        has_more: false,
      }),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            start_time: 1741564800,
            end_time: 1741568400,
            results: [
              {
                amount: { value: 0.025, currency: "usd" },
                line_item: "gpt-4o",
              },
            ],
          },
        ],
        has_more: false,
      }),
    });

    const start = new Date("2026-03-10T00:00:00Z");
    const end = new Date("2026-03-10T01:00:00Z");
    const records = await openaiProvider.fetchUsage(start, end);

    expect(records).toHaveLength(1);
    expect(records[0].provider).toBe("openai");
    expect(records[0].model).toBe("gpt-4o");
    expect(records[0].inputTokens).toBe(3000);
    expect(records[0].outputTokens).toBe(800);
    expect(records[0].costUsd).toBe(0.025);
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    const start = new Date("2026-03-10T00:00:00Z");
    const end = new Date("2026-03-10T01:00:00Z");

    await expect(openaiProvider.fetchUsage(start, end)).rejects.toThrow(
      "OpenAI API error: 403 Forbidden"
    );
  });
});
