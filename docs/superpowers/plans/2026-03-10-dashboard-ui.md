# Dashboard UI Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a neon-accented dark theme dashboard UI for DelveStats with KPI cards, spend chart, provider cards, and usage table.

**Architecture:** Client-rendered dashboard fetching from a single `/api/dashboard` API route. API route queries Turso DB via Drizzle ORM aggregation functions. shadcn/ui components styled with custom CSS variables for neon color palette. Recharts for bar chart visualization.

**Tech Stack:** Next.js 16, shadcn/ui, Recharts, Tailwind CSS v4, Drizzle ORM, Vitest

---

## File Structure

### New Files
| File | Responsibility |
|------|----------------|
| `src/app/api/dashboard/route.ts` | API route returning all dashboard data |
| `src/db/dashboard-queries.ts` | Dashboard-specific DB aggregation queries |
| `src/components/top-bar.tsx` | Logo, last-polled timestamp, refresh button |
| `src/components/kpi-cards.tsx` | Today/week/month spend cards |
| `src/components/spend-chart.tsx` | 30-day stacked bar chart |
| `src/components/provider-card.tsx` | Single provider model breakdown |
| `src/components/provider-grid.tsx` | 2-col grid of provider cards |
| `src/components/usage-table.tsx` | Sortable/filterable data table |
| `src/components/dashboard-shell.tsx` | Layout orchestrator + data fetching |
| `src/lib/format.ts` | Number/currency formatting utilities |
| `tests/db/dashboard-queries.test.ts` | Tests for dashboard aggregation queries |
| `tests/api/dashboard.test.ts` | Tests for dashboard API route |
| `tests/lib/format.test.ts` | Tests for formatting utilities |

### Modified Files
| File | Change |
|------|--------|
| `src/app/globals.css` | Add neon color CSS variables |
| `src/app/layout.tsx` | Update metadata, force dark theme |
| `src/app/page.tsx` | Replace scaffold with DashboardShell |
| `package.json` | Add recharts dependency |

### shadcn/ui Components (installed via CLI)
- `card` — KPI cards, provider cards
- `table` — usage table
- `button` — refresh button
- `badge` — status dots
- `skeleton` — loading states

---

## Chunk 1: Foundation

### Task 1: Install Dependencies & Configure Theme

**Files:**
- Modify: `package.json`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Install recharts**

```bash
npm install recharts lucide-react
```

- [ ] **Step 2: Initialize shadcn/ui**

```bash
npx shadcn@latest init --defaults --force
```

When prompted, accept defaults. This creates `components.json` and updates `globals.css` and `tailwind.config.ts` (or `@theme` in `globals.css` for Tailwind v4).

- [ ] **Step 3: Install shadcn/ui components**

```bash
npx shadcn@latest add card table button badge skeleton
```

- [ ] **Step 4: Replace globals.css with neon theme**

Replace the entire contents of `src/app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-foreground: #fafafa;
  --popover: #18181b;
  --popover-foreground: #fafafa;
  --primary: #39ff14;
  --primary-foreground: #09090b;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafafa;
  --destructive: #ff2d55;
  --destructive-foreground: #fafafa;
  --border: #3f3f46;
  --input: #3f3f46;
  --ring: #39ff14;
  --radius: 0.5rem;

  /* Neon accents */
  --neon-green: #39ff14;
  --neon-purple: #bf5af2;
  --neon-pink: #ff2d55;
  --neon-yellow: #ffd60a;

  /* Provider brand colors */
  --provider-anthropic: #d97757;
  --provider-openai: #10a37f;
  --provider-google: #4285f4;
  --provider-kimi: #ffd60a;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --radius: var(--radius);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans), system-ui, sans-serif;
}
```

Note: shadcn/ui init may modify this file. After init completes, verify the CSS variables above are present. If shadcn created its own variables, merge the neon accent and provider color variables into whatever structure shadcn generated. The key requirement is that `--neon-green`, `--neon-purple`, `--neon-pink`, `--neon-yellow`, and `--provider-*` variables are defined.

- [ ] **Step 5: Update layout.tsx metadata and force dark theme**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DelveStats",
  description: "AI API cost monitoring dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: install shadcn/ui, recharts, and configure neon dark theme"
```

---

### Task 2: Formatting Utilities (TDD)

**Files:**
- Create: `src/lib/format.ts`
- Create: `tests/lib/format.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/lib/format.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/lib/format.test.ts
```

Expected: FAIL — module `@/lib/format` not found.

- [ ] **Step 3: Implement formatting utilities**

Create `src/lib/format.ts`:

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatTokens(count: number): string {
  if (count === 0) return "0";
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toString();
}

export function formatTrend(percent: number): string {
  const sign = percent > 0 ? "+" : "";
  return `${sign}${percent.toFixed(1)}%`;
}

export function timeAgo(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/lib/format.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format.ts tests/lib/format.test.ts
git commit -m "feat: add currency, token, trend, and time formatting utilities"
```

---

### Task 3: Dashboard DB Queries (TDD)

**Files:**
- Create: `src/db/dashboard-queries.ts`
- Create: `tests/db/dashboard-queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/db/dashboard-queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/db/schema";
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
} from "@/db/dashboard-queries";

const client = createClient({ url: "file::memory:" });
const testDb = drizzle(client, { schema });

// Helper: insert a usage record
async function insertRecord(overrides: Partial<typeof schema.usageRecords.$inferInsert> = {}) {
  const defaults = {
    provider: "anthropic",
    model: "claude-sonnet-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 1.0,
    recordedAt: new Date().toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  };
  await testDb.insert(schema.usageRecords).values({ ...defaults, ...overrides });
}

describe("dashboard queries", () => {
  beforeEach(async () => {
    await client.execute("DROP TABLE IF EXISTS usage_records");
    await client.execute("DROP TABLE IF EXISTS poll_log");
    await client.execute(`CREATE TABLE usage_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost_usd REAL NOT NULL,
      recorded_at TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL
    )`);
    await client.execute(`CREATE TABLE poll_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      error_msg TEXT,
      polled_at TEXT NOT NULL
    )`);
  });

  describe("getKpiSpend", () => {
    it("returns today, week, and month totals", async () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const todayStart = `${todayStr}T00:00:00.000Z`;
      const todayEnd = `${todayStr}T23:59:59.000Z`;

      // Record from today
      await insertRecord({ costUsd: 5.0, periodStart: todayStart, periodEnd: todayEnd });
      // Record from 3 days ago (within week)
      const threeDaysAgo = new Date(now.getTime() - 3 * 86400000);
      await insertRecord({ costUsd: 10.0, periodStart: threeDaysAgo.toISOString(), periodEnd: threeDaysAgo.toISOString() });
      // Record from 2 days ago (within month and week)
      const twoDaysAgo = new Date(now.getTime() - 2 * 86400000);
      await insertRecord({ costUsd: 7.0, periodStart: twoDaysAgo.toISOString(), periodEnd: twoDaysAgo.toISOString() });

      const kpi = await getKpiSpend(testDb);
      expect(kpi.today).toBeCloseTo(5.0);
      expect(kpi.week).toBeCloseTo(22.0); // 5 + 10 + 7
      expect(kpi.month).toBeGreaterThanOrEqual(22.0); // at least week's worth
    });
  });

  describe("getDailySpendByProvider", () => {
    it("returns daily spend grouped by provider", async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const todayStart = `${todayStr}T00:00:00Z`;
      const todayEnd = `${todayStr}T23:59:59Z`;

      await insertRecord({ provider: "anthropic", costUsd: 3.0, periodStart: todayStart, periodEnd: todayEnd });
      await insertRecord({ provider: "openai", costUsd: 2.0, periodStart: todayStart, periodEnd: todayEnd });

      const rows = await getDailySpendByProvider(testDb, 30);
      const todayRow = rows.find((r) => r.date === todayStr);
      expect(todayRow).toBeDefined();
      expect(todayRow!.provider).toBeDefined();
    });
  });

  describe("getProviderBreakdown", () => {
    it("returns per-provider per-model aggregation", async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 5.0, inputTokens: 1000, outputTokens: 500, periodStart: monthStart });
      await insertRecord({ provider: "anthropic", model: "claude-opus-4", costUsd: 10.0, inputTokens: 2000, outputTokens: 1000, periodStart: monthStart });
      await insertRecord({ provider: "openai", model: "gpt-4o", costUsd: 3.0, inputTokens: 500, outputTokens: 200, periodStart: monthStart });

      const breakdown = await getProviderBreakdown(testDb);
      expect(breakdown).toHaveLength(3); // 3 rows: one per provider+model combo
      const anthropicSonnet = breakdown.find((r) => r.provider === "anthropic" && r.model === "claude-sonnet-4");
      expect(anthropicSonnet).toBeDefined();
      expect(anthropicSonnet!.cost).toBeCloseTo(5.0);
    });
  });

  describe("getModelTrends", () => {
    it("calculates week-over-week trend", async () => {
      const now = new Date();
      // This week: $10
      const thisWeekDate = new Date(now.getTime() - 2 * 86400000);
      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 10.0, periodStart: thisWeekDate.toISOString() });
      // Last week: $5
      const lastWeekDate = new Date(now.getTime() - 10 * 86400000);
      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 5.0, periodStart: lastWeekDate.toISOString() });

      const trends = await getModelTrends(testDb);
      const sonnetTrend = trends.find((t) => t.model === "claude-sonnet-4");
      expect(sonnetTrend).toBeDefined();
      // $10 this week vs $5 last week = +100%
      expect(sonnetTrend!.trend).toBeCloseTo(100);
    });
  });

  describe("getLatestPollPerProvider", () => {
    it("returns most recent poll per provider", async () => {
      await testDb.insert(schema.pollLog).values([
        { provider: "anthropic", status: "ok", polledAt: "2026-03-10T10:00:00Z" },
        { provider: "anthropic", status: "error", errorMsg: "timeout", polledAt: "2026-03-10T11:00:00Z" },
        { provider: "openai", status: "ok", polledAt: "2026-03-10T10:30:00Z" },
      ]);

      const latest = await getLatestPollPerProvider(testDb);
      expect(latest).toHaveLength(2);
      const anthropic = latest.find((p) => p.provider === "anthropic");
      expect(anthropic!.status).toBe("error"); // most recent
      expect(anthropic!.polledAt).toBe("2026-03-10T11:00:00Z");
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/db/dashboard-queries.test.ts
```

Expected: FAIL — module `@/db/dashboard-queries` not found.

- [ ] **Step 3: Implement dashboard queries**

Create `src/db/dashboard-queries.ts`:

```typescript
import { sql, desc } from "drizzle-orm";
import { usageRecords, pollLog } from "./schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

export async function getKpiSpend(db: DB) {
  const now = new Date();
  const todayStart = now.toISOString().split("T")[0] + "T00:00:00.000Z";
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const nowStr = now.toISOString();

  const [todayResult, weekResult, monthResult] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${todayStart}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${weekStart}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${monthStart}`),
  ]);

  return {
    today: todayResult[0].total,
    week: weekResult[0].total,
    month: monthResult[0].total,
  };
}

export async function getDailySpendByProvider(db: DB, days: number) {
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const rows = await db
    .select({
      date: sql<string>`DATE(${usageRecords.periodStart})`.as("date"),
      provider: usageRecords.provider,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
    .from(usageRecords)
    .where(sql`${usageRecords.periodStart} >= ${since}`)
    .groupBy(sql`DATE(${usageRecords.periodStart})`, usageRecords.provider)
    .orderBy(sql`DATE(${usageRecords.periodStart})`);

  return rows;
}

export async function getProviderBreakdown(db: DB) {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  return db
    .select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      inputTokens: sql<number>`SUM(${usageRecords.inputTokens})`.as("input_tokens"),
      outputTokens: sql<number>`SUM(${usageRecords.outputTokens})`.as("output_tokens"),
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
    .from(usageRecords)
    .where(sql`${usageRecords.periodStart} >= ${monthStart}`)
    .groupBy(usageRecords.provider, usageRecords.model)
    .orderBy(usageRecords.provider, usageRecords.model);
}

export async function getModelTrends(db: DB) {
  const now = new Date();
  const thisWeekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const lastWeekStart = new Date(now.getTime() - 14 * 86400000).toISOString();

  const [thisWeek, lastWeek] = await Promise.all([
    db.select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${thisWeekStart}`)
      .groupBy(usageRecords.provider, usageRecords.model),
    db.select({
      provider: usageRecords.provider,
      model: usageRecords.model,
      cost: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)`.as("cost"),
    })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${lastWeekStart} AND ${usageRecords.periodStart} < ${thisWeekStart}`)
      .groupBy(usageRecords.provider, usageRecords.model),
  ]);

  const thisWeekMap = new Map(thisWeek.map((r) => [`${r.provider}|${r.model}`, r.cost]));
  const lastWeekMap = new Map(lastWeek.map((r) => [`${r.provider}|${r.model}`, r.cost]));

  // Merge all model keys from both weeks
  const allKeys = new Set([...thisWeekMap.keys(), ...lastWeekMap.keys()]);

  return Array.from(allKeys).map((key) => {
    const [provider, model] = key.split("|");
    const current = thisWeekMap.get(key) ?? 0;
    const prev = lastWeekMap.get(key) ?? 0;
    const trend = prev === 0 ? (current > 0 ? 100 : 0) : ((current - prev) / prev) * 100;
    return { provider, model, trend };
  });
}

export async function getLatestPollPerProvider(db: DB) {
  // SQLite doesn't have DISTINCT ON, so we use a subquery for max polled_at per provider
  const rows = await db
    .select({
      provider: pollLog.provider,
      status: pollLog.status,
      polledAt: pollLog.polledAt,
    })
    .from(pollLog)
    .where(
      sql`${pollLog.id} IN (
        SELECT id FROM poll_log AS p2
        WHERE p2.polled_at = (
          SELECT MAX(p3.polled_at) FROM poll_log AS p3 WHERE p3.provider = p2.provider
        )
      )`
    )
    .orderBy(desc(pollLog.polledAt));

  // Deduplicate in case of ties
  const seen = new Set<string>();
  return rows.filter((r) => {
    if (seen.has(r.provider)) return false;
    seen.add(r.provider);
    return true;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/db/dashboard-queries.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/db/dashboard-queries.ts tests/db/dashboard-queries.test.ts
git commit -m "feat: add dashboard aggregation queries with tests"
```

---

### Task 4: Dashboard API Route (TDD)

**Files:**
- Create: `src/app/api/dashboard/route.ts`
- Create: `tests/api/dashboard.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/api/dashboard.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetKpiSpend = vi.fn().mockResolvedValue({ today: 5.0, week: 30.0, month: 120.0 });
const mockGetDailySpendByProvider = vi.fn().mockResolvedValue([
  { date: "2026-03-10", provider: "anthropic", cost: 3.0 },
  { date: "2026-03-10", provider: "openai", cost: 2.0 },
]);
const mockGetProviderBreakdown = vi.fn().mockResolvedValue([
  { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 1000, outputTokens: 500, cost: 5.0 },
  { provider: "openai", model: "gpt-4o", inputTokens: 800, outputTokens: 300, cost: 3.0 },
]);
const mockGetModelTrends = vi.fn().mockResolvedValue([
  { provider: "anthropic", model: "claude-sonnet-4", trend: 12.5 },
  { provider: "openai", model: "gpt-4o", trend: -5.0 },
]);
const mockGetLatestPollPerProvider = vi.fn().mockResolvedValue([
  { provider: "anthropic", status: "ok", polledAt: "2026-03-10T12:00:00Z" },
  { provider: "openai", status: "ok", polledAt: "2026-03-10T11:30:00Z" },
]);

vi.mock("@/db/dashboard-queries", () => ({
  getKpiSpend: (...args: unknown[]) => mockGetKpiSpend(...args),
  getDailySpendByProvider: (...args: unknown[]) => mockGetDailySpendByProvider(...args),
  getProviderBreakdown: (...args: unknown[]) => mockGetProviderBreakdown(...args),
  getModelTrends: (...args: unknown[]) => mockGetModelTrends(...args),
  getLatestPollPerProvider: (...args: unknown[]) => mockGetLatestPollPerProvider(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

import { GET } from "@/app/api/dashboard/route";

describe("dashboard API route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dashboard data with correct shape", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.kpi).toEqual({ today: 5.0, week: 30.0, month: 120.0 });
    expect(body.chart).toBeDefined();
    expect(body.chart[0].date).toBe("2026-03-10");
    expect(body.providers).toBeDefined();
    expect(body.providers[0].name).toBe("anthropic");
    expect(body.table).toBeDefined();
    expect(body.lastPolledAt).toBe("2026-03-10T12:00:00Z");
  });

  it("pivots daily spend into chart format", async () => {
    const res = await GET();
    const body = await res.json();

    const chartDay = body.chart[0];
    expect(chartDay.anthropic).toBe(3.0);
    expect(chartDay.openai).toBe(2.0);
  });

  it("groups provider breakdown into nested structure", async () => {
    const res = await GET();
    const body = await res.json();

    const anthropic = body.providers.find((p: { name: string }) => p.name === "anthropic");
    expect(anthropic.totalCost).toBe(5.0);
    expect(anthropic.models).toHaveLength(1);
    expect(anthropic.models[0].model).toBe("claude-sonnet-4");
  });

  it("merges trends into table data", async () => {
    const res = await GET();
    const body = await res.json();

    const sonnet = body.table.find((r: { model: string }) => r.model === "claude-sonnet-4");
    expect(sonnet.trend).toBe(12.5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run tests/api/dashboard.test.ts
```

Expected: FAIL — module `@/app/api/dashboard/route` not found.

- [ ] **Step 3: Implement the API route**

Create `src/app/api/dashboard/route.ts`:

```typescript
import { db } from "@/db/client";
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
} from "@/db/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
  const [kpi, dailySpend, breakdown, trends, polls] = await Promise.all([
    getKpiSpend(db),
    getDailySpendByProvider(db, 30),
    getProviderBreakdown(db),
    getModelTrends(db),
    getLatestPollPerProvider(db),
  ]);

  // Pivot daily spend rows into chart format: { date, anthropic: X, openai: Y, ... }
  const chartMap = new Map<string, Record<string, string | number>>();
  for (const row of dailySpend) {
    if (!chartMap.has(row.date)) {
      chartMap.set(row.date, { date: row.date });
    }
    const entry = chartMap.get(row.date)!;
    entry[row.provider] = row.cost;
  }
  const chart = Array.from(chartMap.values());

  // Group breakdown into provider -> models structure
  const providerMap = new Map<string, {
    name: string;
    totalCost: number;
    models: Array<{ model: string; inputTokens: number; outputTokens: number; cost: number }>;
    lastPollStatus: "ok" | "error";
    lastPollAt: string;
  }>();

  for (const row of breakdown) {
    if (!providerMap.has(row.provider)) {
      const poll = polls.find((p) => p.provider === row.provider);
      providerMap.set(row.provider, {
        name: row.provider,
        totalCost: 0,
        models: [],
        lastPollStatus: (poll?.status as "ok" | "error") ?? "ok",
        lastPollAt: poll?.polledAt ?? "",
      });
    }
    const provider = providerMap.get(row.provider)!;
    provider.totalCost += row.cost;
    provider.models.push({
      model: row.model,
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      cost: row.cost,
    });
  }
  const providers = Array.from(providerMap.values());

  // Merge trends into table rows
  const trendMap = new Map(trends.map((t) => [`${t.provider}|${t.model}`, t.trend]));
  const table = breakdown.map((row) => ({
    provider: row.provider,
    model: row.model,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    cost: row.cost,
    trend: trendMap.get(`${row.provider}|${row.model}`) ?? 0,
  }));

  // Most recent poll timestamp across all providers
  const lastPolledAt = polls.length > 0 ? polls[0].polledAt : "";

  return Response.json({ kpi, chart, providers, table, lastPolledAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run tests/api/dashboard.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Run all tests to ensure nothing broke**

```bash
npm test
```

Expected: All tests pass (19 existing + 10 format + 5 dashboard queries + 4 API route = 38 total).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dashboard/route.ts tests/api/dashboard.test.ts
git commit -m "feat: add dashboard API route with test coverage"
```

---

## Chunk 2: UI Components

### Task 5: TopBar Component

**Files:**
- Create: `src/components/top-bar.tsx`

- [ ] **Step 1: Create TopBar component**

Create `src/components/top-bar.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { RefreshCw } from "lucide-react";

interface TopBarProps {
  lastPolledAt: string;
  onRefresh: () => void;
  isLoading: boolean;
}

export function TopBar({ lastPolledAt, onRefresh, isLoading }: TopBarProps) {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-[var(--neon-green)]">Delve</span>Stats
        </span>
      </div>
      <div className="flex items-center gap-4">
        {lastPolledAt && (
          <span className="text-sm text-muted-foreground font-mono">
            Last polled: {timeAgo(lastPolledAt)}
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={onRefresh}
          disabled={isLoading}
          className="hover:text-[var(--neon-yellow)] hover:shadow-[0_0_12px_rgba(255,214,10,0.3)] transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds. If `lucide-react` is not installed, install it:

```bash
npm install lucide-react
```

Note: shadcn/ui typically installs `lucide-react` during init. If it's already installed, skip this step.

- [ ] **Step 3: Commit**

```bash
git add src/components/top-bar.tsx
git commit -m "feat: add TopBar component with refresh button and neon accents"
```

---

### Task 6: KPI Cards Component

**Files:**
- Create: `src/components/kpi-cards.tsx`

- [ ] **Step 1: Create KpiCards component**

Create `src/components/kpi-cards.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

interface KpiCardsProps {
  today: number;
  week: number;
  month: number;
}

const kpiItems = [
  { key: "today" as const, label: "Today" },
  { key: "week" as const, label: "This Week" },
  { key: "month" as const, label: "This Month" },
];

export function KpiCards({ today, week, month }: KpiCardsProps) {
  const values = { today, week, month };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpiItems.map((item) => (
        <Card
          key={item.key}
          className="bg-[var(--card)] border-[var(--border)] shadow-[0_0_20px_rgba(57,255,20,0.15)]"
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-mono font-bold text-[var(--neon-green)]">
              {formatCurrency(values[item.key])}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function KpiCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="bg-[var(--card)] border-[var(--border)]">
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-20 bg-zinc-800" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-32 bg-zinc-800" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/kpi-cards.tsx
git commit -m "feat: add KPI cards with neon green glow and skeleton loading"
```

---

### Task 7: Spend Chart Component

**Files:**
- Create: `src/components/spend-chart.tsx`

- [ ] **Step 1: Create SpendChart component**

Create `src/components/spend-chart.tsx`:

```tsx
"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "var(--provider-anthropic)",
  openai: "var(--provider-openai)",
  google: "var(--provider-google)",
  kimi: "var(--provider-kimi)",
};

interface ChartDataPoint {
  date: string;
  [provider: string]: string | number;
}

interface SpendChartProps {
  data: ChartDataPoint[];
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg">
      <p className="mb-2 text-sm font-medium text-muted-foreground">{label}</p>
      {payload.map((entry) => (
        <div key={entry.dataKey} className="flex items-center justify-between gap-4">
          <span className="text-sm" style={{ color: entry.color }}>
            {entry.dataKey}
          </span>
          <span className="text-sm font-mono">{formatCurrency(entry.value as number)}</span>
        </div>
      ))}
    </div>
  );
}

export function SpendChart({ data }: SpendChartProps) {
  // Extract provider names from data (all keys except "date")
  const providers = data.length > 0
    ? Object.keys(data[0]).filter((k) => k !== "date")
    : [];

  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          30-Day Spend
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickFormatter={(v: string) => v.slice(5)} // "03-10"
            />
            <YAxis
              tick={{ fill: "#a1a1aa", fontSize: 12 }}
              tickFormatter={(v: number) => `$${v}`}
            />
            <Tooltip content={<CustomTooltip />} />
            {providers.map((provider) => (
              <Bar
                key={provider}
                dataKey={provider}
                stackId="spend"
                fill={PROVIDER_COLORS[provider] ?? "var(--neon-purple)"}
                radius={provider === providers[providers.length - 1] ? [2, 2, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function SpendChartSkeleton() {
  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <Skeleton className="h-4 w-28 bg-zinc-800" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full bg-zinc-800" />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/spend-chart.tsx
git commit -m "feat: add 30-day stacked bar chart with provider colors"
```

---

### Task 8: Provider Card & Grid Components

**Files:**
- Create: `src/components/provider-card.tsx`
- Create: `src/components/provider-grid.tsx`

- [ ] **Step 1: Create ProviderCard component**

Create `src/components/provider-card.tsx`:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatTokens } from "@/lib/format";

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: "var(--provider-anthropic)",
  openai: "var(--provider-openai)",
  google: "var(--provider-google)",
  kimi: "var(--provider-kimi)",
};

interface ProviderCardProps {
  name: string;
  totalCost: number;
  models: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
  lastPollStatus: "ok" | "error";
  lastPollAt: string;
}

export function ProviderCard({ name, totalCost, models, lastPollStatus }: ProviderCardProps) {
  const borderColor = PROVIDER_COLORS[name] ?? "var(--neon-purple)";

  return (
    <Card
      className="bg-[var(--card)] border-[var(--border)]"
      style={{ borderLeftWidth: "4px", borderLeftColor: borderColor }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold capitalize">{name}</span>
          <Badge
            variant="outline"
            className={`h-5 text-xs ${
              lastPollStatus === "ok"
                ? "border-[var(--neon-green)] text-[var(--neon-green)]"
                : "border-[var(--neon-pink)] text-[var(--neon-pink)]"
            }`}
          >
            {lastPollStatus === "ok" ? "healthy" : "error"}
          </Badge>
        </div>
        <span className="text-lg font-mono font-bold text-[var(--neon-green)]">
          {formatCurrency(totalCost)}
        </span>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <p className="text-sm text-zinc-500">No data yet</p>
        ) : (
          <div className="space-y-2">
            {models.map((m) => (
              <div key={m.model} className="flex items-center justify-between text-sm">
                <span className="font-mono text-muted-foreground truncate max-w-[180px]">
                  {m.model}
                </span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[var(--neon-purple)]">
                    {formatTokens(m.inputTokens)} / {formatTokens(m.outputTokens)}
                  </span>
                  <span className="font-mono text-[var(--neon-green)]">
                    {formatCurrency(m.cost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create ProviderGrid component**

Create `src/components/provider-grid.tsx`:

```tsx
import { ProviderCard } from "./provider-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

interface ProviderData {
  name: string;
  totalCost: number;
  models: Array<{
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
  }>;
  lastPollStatus: "ok" | "error";
  lastPollAt: string;
}

interface ProviderGridProps {
  providers: ProviderData[];
}

export function ProviderGrid({ providers }: ProviderGridProps) {
  if (providers.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {providers.map((provider) => (
        <ProviderCard key={provider.name} {...provider} />
      ))}
    </div>
  );
}

export function ProviderGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {[1, 2].map((i) => (
        <Card key={i} className="bg-[var(--card)] border-[var(--border)] p-6">
          <Skeleton className="h-6 w-24 bg-zinc-800 mb-4" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-full bg-zinc-800" />
            <Skeleton className="h-4 w-3/4 bg-zinc-800" />
          </div>
        </Card>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/provider-card.tsx src/components/provider-grid.tsx
git commit -m "feat: add provider card and grid with brand colors and status badges"
```

---

### Task 9: Usage Table Component

**Files:**
- Create: `src/components/usage-table.tsx`

- [ ] **Step 1: Create UsageTable component**

Create `src/components/usage-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatTokens, formatTrend } from "@/lib/format";
import { ArrowUpRight, ArrowDownRight, ArrowUpDown } from "lucide-react";

interface UsageRow {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  trend: number;
}

type SortKey = "provider" | "model" | "inputTokens" | "outputTokens" | "cost" | "trend";
type SortDir = "asc" | "desc";

interface UsageTableProps {
  data: UsageRow[];
}

export function UsageTable({ data }: UsageTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("cost");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [providerFilter, setProviderFilter] = useState<string>("all");

  const providers = Array.from(new Set(data.map((r) => r.provider)));

  const filtered = providerFilter === "all"
    ? data
    : data.filter((r) => r.provider === providerFilter);

  const sorted = [...filtered].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const cmp = typeof aVal === "string" ? aVal.localeCompare(bVal as string) : (aVal as number) - (bVal as number);
    return sortDir === "asc" ? cmp : -cmp;
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const columns: { key: SortKey; label: string; align?: string }[] = [
    { key: "provider", label: "Provider" },
    { key: "model", label: "Model" },
    { key: "inputTokens", label: "In Tokens", align: "right" },
    { key: "outputTokens", label: "Out Tokens", align: "right" },
    { key: "cost", label: "Cost", align: "right" },
    { key: "trend", label: "Trend", align: "right" },
  ];

  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Usage Breakdown
        </CardTitle>
        <select
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
          className="rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-foreground"
        >
          <option value="all">All Providers</option>
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--border)] hover:bg-transparent">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={`cursor-pointer select-none ${col.align === "right" ? "text-right" : ""}`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key && (
                      <ArrowUpDown className="h-3 w-3 text-[var(--neon-yellow)]" />
                    )}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, i) => (
              <TableRow
                key={`${row.provider}-${row.model}`}
                className={`border-[var(--border)] ${i % 2 === 0 ? "bg-[var(--background)]" : "bg-[var(--card)]"}`}
              >
                <TableCell className="capitalize">{row.provider}</TableCell>
                <TableCell className="font-mono text-muted-foreground">{row.model}</TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-purple)]">
                  {formatTokens(row.inputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-purple)]">
                  {formatTokens(row.outputTokens)}
                </TableCell>
                <TableCell className="text-right font-mono text-[var(--neon-green)]">
                  {formatCurrency(row.cost)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={`inline-flex items-center gap-1 ${
                    row.trend > 0 ? "text-[var(--neon-pink)]" : row.trend < 0 ? "text-[var(--neon-green)]" : "text-muted-foreground"
                  }`}>
                    {row.trend > 0 && <ArrowUpRight className="h-3 w-3" />}
                    {row.trend < 0 && <ArrowDownRight className="h-3 w-3" />}
                    {formatTrend(row.trend)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No usage data available
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function UsageTableSkeleton() {
  return (
    <Card className="bg-[var(--card)] border-[var(--border)]">
      <CardHeader>
        <Skeleton className="h-4 w-32 bg-zinc-800" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-8 w-full bg-zinc-800" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```


- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/usage-table.tsx
git commit -m "feat: add sortable/filterable usage table with neon trend indicators"
```

---

## Chunk 3: Assembly & Integration

### Task 10: DashboardShell Component

**Files:**
- Create: `src/components/dashboard-shell.tsx`

- [ ] **Step 1: Create DashboardShell component**

Create `src/components/dashboard-shell.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "./top-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { SpendChart, SpendChartSkeleton } from "./spend-chart";
import { ProviderGrid, ProviderGridSkeleton } from "./provider-grid";
import { UsageTable, UsageTableSkeleton } from "./usage-table";

interface DashboardData {
  kpi: { today: number; week: number; month: number };
  chart: Array<Record<string, string | number>>;
  providers: Array<{
    name: string;
    totalCost: number;
    models: Array<{
      model: string;
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>;
    lastPollStatus: "ok" | "error";
    lastPollAt: string;
  }>;
  table: Array<{
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cost: number;
    trend: number;
  }>;
  lastPolledAt: string;
}

export function DashboardShell() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const hasData = data && (data.providers.length > 0 || data.kpi.month > 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopBar
        lastPolledAt={data?.lastPolledAt ?? ""}
        onRefresh={fetchData}
        isLoading={isLoading}
      />

      <main className="mx-auto max-w-7xl space-y-6 p-6">
        {error && (
          <div className="rounded-lg border border-[var(--neon-pink)] bg-[var(--card)] p-4 text-sm">
            <span className="text-[var(--neon-pink)]">Failed to load data.</span>{" "}
            <button
              onClick={fetchData}
              className="underline text-[var(--neon-yellow)] hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {!hasData && !isLoading && !error && (
          <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-12 text-center">
            <p className="text-lg text-muted-foreground">
              No usage data yet. Configure your provider API keys and wait for the first poll.
            </p>
          </div>
        )}

        {isLoading && !data ? (
          <>
            <KpiCardsSkeleton />
            <SpendChartSkeleton />
            <ProviderGridSkeleton />
            <UsageTableSkeleton />
          </>
        ) : data ? (
          <>
            <KpiCards today={data.kpi.today} week={data.kpi.week} month={data.kpi.month} />
            <SpendChart data={data.chart} />
            <ProviderGrid providers={data.providers} />
            <UsageTable data={data.table} />
          </>
        ) : null}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard-shell.tsx
git commit -m "feat: add DashboardShell orchestrator with loading, error, and empty states"
```

---

### Task 11: Wire Up page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with dashboard**

Replace the entire contents of `src/app/page.tsx`:

```tsx
import { DashboardShell } from "@/components/dashboard-shell";

export default function Home() {
  return <DashboardShell />;
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire dashboard shell into main page"
```

---

### Task 12: Visual Smoke Test & Cleanup

**Files:**
- Possibly modify: any component files for visual polish

- [ ] **Step 1: Start dev server and visually inspect**

```bash
npm run dev
```

Open `http://localhost:3000` in the browser. Verify:
- Dark background with zinc-950 base
- TopBar shows "DelveStats" with green accent, refresh button
- Empty state message shows if no data (KPI cards only render when data exists)
- Chart renders (empty if no data)
- Empty state message shows if no data
- No console errors

- [ ] **Step 2: Clean up any unused scaffold files**

Delete the Next.js scaffold SVG files if they still exist:

```bash
rm -f public/next.svg public/vercel.svg public/file.svg public/globe.svg public/window.svg
```

- [ ] **Step 3: Run final build and test**

```bash
npm run build && npm test
```

Expected: Build clean, all tests pass.

- [ ] **Step 4: Commit cleanup**

```bash
git add -u
git commit -m "chore: remove scaffold files and verify dashboard builds clean"
```

- [ ] **Step 5: Push to remote**

```bash
git push origin main
```
