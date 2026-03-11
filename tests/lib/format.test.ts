import { describe, it, expect } from "vitest";
import { formatCurrency, formatTokens, formatTrend, timeAgo } from "@/lib/format";

describe("formatCurrency", () => {
  it("formats dollars with 2 decimal places", () => {
    expect(formatCurrency(12.4)).toBe("$12.40");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });

  it("formats large numbers with commas", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });
});

describe("formatTokens", () => {
  it("formats thousands with K suffix", () => {
    expect(formatTokens(1500)).toBe("1.5K");
  });

  it("formats millions with M suffix", () => {
    expect(formatTokens(1234567)).toBe("1.2M");
  });

  it("formats small numbers without suffix", () => {
    expect(formatTokens(500)).toBe("500");
  });

  it("formats zero", () => {
    expect(formatTokens(0)).toBe("0");
  });
});

describe("formatTrend", () => {
  it("formats positive trend with + prefix", () => {
    expect(formatTrend(8.5)).toBe("+8.5%");
  });

  it("formats negative trend with - prefix", () => {
    expect(formatTrend(-3.2)).toBe("-3.2%");
  });

  it("formats zero trend", () => {
    expect(formatTrend(0)).toBe("0.0%");
  });
});

describe("timeAgo", () => {
  it("shows minutes for recent times", () => {
    const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(timeAgo(twoMinAgo)).toBe("2m ago");
  });

  it("shows hours for older times", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("shows 'just now' for very recent", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });
});
