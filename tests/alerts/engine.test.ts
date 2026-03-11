import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkAndFireAlerts, formatSlackPayload } from "@/alerts/engine";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("alert engine", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("formats Slack payload correctly", () => {
    const payload = formatSlackPayload({
      provider: "anthropic",
      period: "daily",
      currentSpend: 15.5,
      threshold: 10,
    });
    expect(payload.text).toContain("anthropic");
    expect(payload.text).toContain("$15.50");
    expect(payload.text).toContain("$10.00");
  });

  it("formats Slack payload for all-provider alert", () => {
    const payload = formatSlackPayload({
      provider: null,
      period: "monthly",
      currentSpend: 200,
      threshold: 150,
    });
    expect(payload.text).toContain("All providers");
    expect(payload.text).toContain("monthly");
  });

  it("fires webhook when threshold exceeded and not recently triggered", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const rule = {
      id: 1,
      provider: null,
      thresholdUsd: 10,
      period: "daily" as const,
      webhookUrl: "https://hooks.example.com/test",
      enabled: true,
      lastTriggered: null,
    };

    const result = await checkAndFireAlerts({
      rule,
      currentSpend: 15,
      now: new Date("2026-03-10T12:00:00Z"),
    });

    expect(result.fired).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.example.com/test",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });

  it("does not fire when under threshold", async () => {
    const rule = {
      id: 1,
      provider: null,
      thresholdUsd: 10,
      period: "daily" as const,
      webhookUrl: "https://hooks.example.com/test",
      enabled: true,
      lastTriggered: null,
    };

    const result = await checkAndFireAlerts({
      rule,
      currentSpend: 5,
      now: new Date("2026-03-10T12:00:00Z"),
    });

    expect(result.fired).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not fire when already triggered in current period", async () => {
    const rule = {
      id: 1,
      provider: null,
      thresholdUsd: 10,
      period: "daily" as const,
      webhookUrl: "https://hooks.example.com/test",
      enabled: true,
      lastTriggered: "2026-03-10T08:00:00Z",
    };

    const result = await checkAndFireAlerts({
      rule,
      currentSpend: 15,
      now: new Date("2026-03-10T12:00:00Z"),
    });

    expect(result.fired).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires again in a new period after previous trigger", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });

    const rule = {
      id: 1,
      provider: null,
      thresholdUsd: 10,
      period: "daily" as const,
      webhookUrl: "https://hooks.example.com/test",
      enabled: true,
      lastTriggered: "2026-03-09T08:00:00Z",
    };

    const result = await checkAndFireAlerts({
      rule,
      currentSpend: 15,
      now: new Date("2026-03-10T12:00:00Z"),
    });

    expect(result.fired).toBe(true);
  });
});
