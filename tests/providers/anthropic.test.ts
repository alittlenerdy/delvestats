import { describe, it, expect, vi, beforeEach } from "vitest";
import { anthropicProvider } from "@/providers/anthropic";

vi.mock("@/lib/env", () => ({
  env: { anthropicAdminKey: "sk-ant-admin-test-key" },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("anthropic provider", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("isConfigured returns true when key is set", () => {
    expect(anthropicProvider.isConfigured()).toBe(true);
  });

  it("fetches and normalizes usage data", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              bucket_start_time: "2026-03-10T00:00:00Z",
              bucket_end_time: "2026-03-10T01:00:00Z",
              input_tokens: 5000,
              output_tokens: 1000,
              model: "claude-sonnet-4",
            },
          ],
          has_more: false,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              bucket_start_time: "2026-03-10T00:00:00Z",
              bucket_end_time: "2026-03-10T01:00:00Z",
              amount: 450,
              description: "claude-sonnet-4",
            },
          ],
          has_more: false,
        }),
      });

    const start = new Date("2026-03-10T00:00:00Z");
    const end = new Date("2026-03-10T01:00:00Z");
    const records = await anthropicProvider.fetchUsage(start, end);

    expect(records).toHaveLength(1);
    expect(records[0].provider).toBe("anthropic");
    expect(records[0].model).toBe("claude-sonnet-4");
    expect(records[0].inputTokens).toBe(5000);
    expect(records[0].outputTokens).toBe(1000);
    expect(records[0].costUsd).toBe(4.5);
  });

  it("handles API errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    });

    const start = new Date("2026-03-10T00:00:00Z");
    const end = new Date("2026-03-10T01:00:00Z");

    await expect(anthropicProvider.fetchUsage(start, end)).rejects.toThrow(
      "Anthropic API error: 401 Unauthorized"
    );
  });
});
