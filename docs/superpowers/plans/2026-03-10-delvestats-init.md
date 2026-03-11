# DelveStats Project Initialization Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize the DelveStats project with Next.js, Turso/Drizzle database, provider adapter interface, and first two provider implementations (Anthropic, OpenAI).

**Architecture:** Next.js App Router with Turso (libSQL) via Drizzle ORM. Provider adapter pattern where each AI provider implements a `UsageProvider` interface. Vercel Cron polls providers hourly, normalizes data into `usage_records`. Alert engine checks spend thresholds and POSTs to webhooks.

**Tech Stack:** Next.js 15, TypeScript, Drizzle ORM, @libsql/client (Turso), Tailwind CSS, Vitest

**Reference:** Design spec at `docs/design-spec.md`

**Spec deviations (justified):**
- Env vars use `ANTHROPIC_ADMIN_KEY` / `OPENAI_ADMIN_KEY` instead of spec's `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` because both providers require admin-level keys for usage/billing APIs
- Database uses Turso (libSQL) instead of plain SQLite for Vercel serverless compatibility; falls back to `file:local.db` for local dev
- Google AI and Kimi are stub-only in v1 — Google has no programmatic usage API (only BigQuery export), Kimi only has a balance endpoint with no historical usage data
- OpenAI cost data is daily granularity only (API limitation) — cost is distributed proportionally across hourly usage buckets for the same model

---

## File Structure

```
delvestats/
├── CLAUDE.md                          # Project conventions for AI agents
├── LICENSE                            # MIT license
├── README.md                         # Project overview, deploy button, setup
├── .env.example                      # All env vars documented
├── .gitignore
├── next.config.ts
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── vercel.json                       # Cron job config
├── drizzle.config.ts                 # Drizzle migration config
├── drizzle/                          # Generated migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Dashboard (placeholder for now)
│   │   └── api/
│   │       └── cron/
│   │           └── poll/
│   │               └── route.ts      # Cron endpoint: poll providers
│   ├── db/
│   │   ├── schema.ts                 # Drizzle table definitions
│   │   ├── client.ts                 # Drizzle + Turso client singleton
│   │   └── queries.ts               # Reusable query functions
│   ├── providers/
│   │   ├── types.ts                  # UsageProvider interface + UsageRecord type
│   │   ├── registry.ts              # Auto-discovers configured providers
│   │   ├── anthropic.ts             # Anthropic usage API adapter
│   │   ├── openai.ts                # OpenAI usage API adapter
│   │   ├── google.ts                # Google AI stub (no API available)
│   │   └── kimi.ts                  # Kimi/Moonshot stub (balance only)
│   ├── alerts/
│   │   └── engine.ts                # Threshold checks + webhook dispatch
│   └── lib/
│       └── env.ts                   # Typed env var access
├── tests/
│   ├── providers/
│   │   ├── anthropic.test.ts
│   │   ├── openai.test.ts
│   │   └── registry.test.ts
│   ├── alerts/
│   │   └── engine.test.ts
│   ├── cron/
│   │   └── poll.test.ts
│   └── db/
│       └── queries.test.ts
└── vitest.config.ts
```

---

## Chunk 1: Project Scaffolding & Database

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`

- [ ] **Step 1: Create Next.js app**

Run:
```bash
cd /Volumes/just_a_little_nerd/delvestats
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Expected: Project scaffolded with App Router, TypeScript, Tailwind.

- [ ] **Step 2: Install dependencies**

```bash
npm install drizzle-orm @libsql/client
npm install -D drizzle-kit vitest @types/node
```

- [ ] **Step 3: Verify it runs**

```bash
npm run dev &
sleep 3
curl -s http://localhost:3000 | head -20
kill %1
```

Expected: HTML response from Next.js dev server.

- [ ] **Step 4: Commit**

```bash
git init
git add -A
git commit -m "chore: initialize Next.js project with dependencies"
```

---

### Task 2: Create CLAUDE.md

**Files:**
- Create: `CLAUDE.md`

- [ ] **Step 1: Write CLAUDE.md**

```markdown
# DelveStats

AI API cost monitoring dashboard. Self-hosted, open-source.

## Stack
- Next.js 15 (App Router), TypeScript, Tailwind CSS
- Turso (libSQL) via Drizzle ORM
- Deploy target: Vercel

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm test` — run tests (vitest)
- `npx drizzle-kit push` — apply schema changes (dev)
- `npx drizzle-kit generate` — generate migration files (prod)

## Conventions
- Provider adapters live in `src/providers/` and implement `UsageProvider` from `src/providers/types.ts`
- Database schema in `src/db/schema.ts`, client in `src/db/client.ts`
- API routes under `src/app/api/`
- Tests mirror source structure under `tests/`
- All config via environment variables (see `.env.example`)
- Use named exports, not default exports
- Prefer `const` arrow functions for components and handlers
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add CLAUDE.md with project conventions"
```

---

### Task 3: Create Environment Config

**Files:**
- Create: `.env.example`, `src/lib/env.ts`

- [ ] **Step 1: Write .env.example**

```env
# Database (Turso)
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your-auth-token

# Provider API Keys (admin/read-only keys required)
ANTHROPIC_ADMIN_KEY=sk-ant-admin-...
OPENAI_ADMIN_KEY=sk-admin-...
GOOGLE_AI_API_KEY=
KIMI_API_KEY=

# Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/services/...
ALERT_DAILY_THRESHOLD=10
ALERT_WEEKLY_THRESHOLD=50
ALERT_MONTHLY_THRESHOLD=150

# Cron Authentication
CRON_SECRET=generate-a-random-string-here
```

- [ ] **Step 2: Write src/lib/env.ts**

```typescript
export const env = {
  // Database
  tursoUrl: process.env.TURSO_DATABASE_URL ?? "file:local.db",
  tursoToken: process.env.TURSO_AUTH_TOKEN,

  // Providers
  anthropicAdminKey: process.env.ANTHROPIC_ADMIN_KEY,
  openaiAdminKey: process.env.OPENAI_ADMIN_KEY,
  googleAiApiKey: process.env.GOOGLE_AI_API_KEY,
  kimiApiKey: process.env.KIMI_API_KEY,

  // Alerts
  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
  alertDailyThreshold: Number(process.env.ALERT_DAILY_THRESHOLD) || 0,
  alertWeeklyThreshold: Number(process.env.ALERT_WEEKLY_THRESHOLD) || 0,
  alertMonthlyThreshold: Number(process.env.ALERT_MONTHLY_THRESHOLD) || 0,

  // Cron
  cronSecret: process.env.CRON_SECRET,
} as const;
```

- [ ] **Step 3: Add .env.local to .gitignore**

Verify `.gitignore` already contains `.env*.local`. If not, append it.

- [ ] **Step 4: Commit**

```bash
git add .env.example src/lib/env.ts
git commit -m "feat: add environment configuration and .env.example"
```

---

### Task 4: Database Schema

**Files:**
- Create: `src/db/schema.ts`, `src/db/client.ts`, `drizzle.config.ts`

- [ ] **Step 1: Write the Drizzle schema**

Create `src/db/schema.ts`:

```typescript
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const usageRecords = sqliteTable("usage_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  recordedAt: text("recorded_at").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
});

export const alertRules = sqliteTable("alert_rules", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider"),
  thresholdUsd: real("threshold_usd").notNull(),
  period: text("period", { enum: ["daily", "weekly", "monthly"] }).notNull(),
  webhookUrl: text("webhook_url").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  lastTriggered: text("last_triggered"),
});

export const pollLog = sqliteTable("poll_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  status: text("status", { enum: ["ok", "error"] }).notNull(),
  errorMsg: text("error_msg"),
  polledAt: text("polled_at").notNull(),
});
```

- [ ] **Step 2: Write the database client**

Create `src/db/client.ts`:

```typescript
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { env } from "@/lib/env";
import * as schema from "./schema";

const client = createClient({
  url: env.tursoUrl,
  authToken: env.tursoToken,
});

export const db = drizzle(client, { schema });
```

- [ ] **Step 3: Write drizzle.config.ts**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

- [ ] **Step 4: Push schema to local dev DB**

```bash
npx drizzle-kit push
```

Expected: Tables `usage_records`, `alert_rules`, `poll_log` created.

- [ ] **Step 5: Commit**

```bash
git add src/db/ drizzle.config.ts
git commit -m "feat: add database schema and Drizzle client for Turso"
```

---

### Task 5: Database Query Functions

**Files:**
- Create: `src/db/queries.ts`, `tests/db/queries.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/db/queries.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "@/db/schema";
import { insertUsageRecords, getSpendByPeriod, getRecentPollLogs, logPoll } from "@/db/queries";

const client = createClient({ url: "file::memory:" });
const testDb = drizzle(client, { schema });

describe("database queries", () => {
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

  it("inserts usage records", async () => {
    const records = [{
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 1000,
      outputTokens: 500,
      costUsd: 0.015,
      recordedAt: "2026-03-10T00:00:00Z",
      periodStart: "2026-03-10T00:00:00Z",
      periodEnd: "2026-03-10T01:00:00Z",
    }];
    await insertUsageRecords(testDb, records);
    const rows = await testDb.select().from(schema.usageRecords);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider).toBe("anthropic");
  });

  it("calculates spend for a time period", async () => {
    await testDb.insert(schema.usageRecords).values([
      { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 1000, outputTokens: 500, costUsd: 0.01, recordedAt: "2026-03-10T12:00:00Z", periodStart: "2026-03-10T00:00:00Z", periodEnd: "2026-03-10T01:00:00Z" },
      { provider: "openai", model: "gpt-4o", inputTokens: 2000, outputTokens: 800, costUsd: 0.02, recordedAt: "2026-03-10T12:00:00Z", periodStart: "2026-03-10T00:00:00Z", periodEnd: "2026-03-10T01:00:00Z" },
    ]);
    const spend = await getSpendByPeriod(testDb, "2026-03-10T00:00:00Z", "2026-03-11T00:00:00Z");
    expect(spend).toBeCloseTo(0.03);
  });

  it("logs poll results", async () => {
    await logPoll(testDb, "anthropic", "ok");
    const logs = await getRecentPollLogs(testDb, 10);
    expect(logs).toHaveLength(1);
    expect(logs[0].provider).toBe("anthropic");
    expect(logs[0].status).toBe("ok");
  });
});
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Add `"test": "vitest run"` to the `"scripts"` object in `package.json` (alongside existing `"dev"`, `"build"`, `"start"`, `"lint"` entries).

- [ ] **Step 3: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `queries` module doesn't exist yet.

- [ ] **Step 4: Implement query functions**

Create `src/db/queries.ts`:

```typescript
import { sql, and, gte, lte, desc } from "drizzle-orm";
import { usageRecords, pollLog } from "./schema";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "./schema";

type DB = LibSQLDatabase<typeof schema>;

export const insertUsageRecords = async (
  db: DB,
  records: (typeof usageRecords.$inferInsert)[]
) => {
  if (records.length === 0) return;
  await db.insert(usageRecords).values(records);
};

export const getSpendByPeriod = async (
  db: DB,
  start: string,
  end: string,
  provider?: string
): Promise<number> => {
  const conditions = [
    gte(usageRecords.periodStart, start),
    lte(usageRecords.periodEnd, end),
  ];
  if (provider) {
    conditions.push(sql`${usageRecords.provider} = ${provider}`);
  }
  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
    .from(usageRecords)
    .where(and(...conditions));
  return result[0].total;
};

export const logPoll = async (
  db: DB,
  provider: string,
  status: "ok" | "error",
  errorMsg?: string
) => {
  await db.insert(pollLog).values({
    provider,
    status,
    errorMsg: errorMsg ?? null,
    polledAt: new Date().toISOString(),
  });
};

export const getRecentPollLogs = async (db: DB, limit: number) => {
  return db
    .select()
    .from(pollLog)
    .orderBy(desc(pollLog.polledAt))
    .limit(limit);
};
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npm test
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/db/queries.ts tests/ vitest.config.ts package.json
git commit -m "feat: add database query functions with tests"
```

---

## Chunk 2: Provider Adapter Interface & Implementations

### Task 6: Provider Types & Registry

**Files:**
- Create: `src/providers/types.ts`, `src/providers/registry.ts`, `tests/providers/registry.test.ts`

- [ ] **Step 1: Write provider types**

Create `src/providers/types.ts`:

```typescript
export interface UsageRecord {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  periodStart: string;
  periodEnd: string;
}

export interface UsageProvider {
  name: string;
  fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]>;
  isConfigured(): boolean;
}
```

- [ ] **Step 2: Write failing registry test**

Create `tests/providers/registry.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { getConfiguredProviders } from "@/providers/registry";
import type { UsageProvider } from "@/providers/types";

const mockProvider = (name: string, configured: boolean): UsageProvider => ({
  name,
  isConfigured: () => configured,
  fetchUsage: vi.fn().mockResolvedValue([]),
});

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
    // Re-mock anthropic as configured
    const { anthropicProvider } = await import("@/providers/anthropic");
    vi.spyOn(anthropicProvider, "isConfigured").mockReturnValue(true);

    const providers = getConfiguredProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("anthropic");
  });
});
```

- [ ] **Step 3: Run test — verify fail**

```bash
npm test -- tests/providers/registry.test.ts
```

- [ ] **Step 4: Implement registry**

Create `src/providers/registry.ts`:

```typescript
import type { UsageProvider } from "./types";
import { anthropicProvider } from "./anthropic";
import { openaiProvider } from "./openai";
import { googleProvider } from "./google";
import { kimiProvider } from "./kimi";

const allProviders: UsageProvider[] = [
  anthropicProvider,
  openaiProvider,
  googleProvider,
  kimiProvider,
];

export const getConfiguredProviders = (): UsageProvider[] => {
  return allProviders.filter((p) => p.isConfigured());
};
```

- [ ] **Step 5: Create stub provider files** (so imports resolve)

Create `src/providers/google.ts`:

```typescript
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
```

Create `src/providers/kimi.ts`:

```typescript
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
```

- [ ] **Step 6: Run test — verify pass**

```bash
npm test -- tests/providers/registry.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add src/providers/ tests/providers/registry.test.ts
git commit -m "feat: add provider interface, registry, and stub providers"
```

---

### Task 7: Anthropic Provider

**Files:**
- Create: `src/providers/anthropic.ts`, `tests/providers/anthropic.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/anthropic.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { anthropicProvider } from "@/providers/anthropic";

// Mock env
vi.mock("@/lib/env", () => ({
  env: { anthropicAdminKey: "sk-ant-admin-test-key" },
}));

// Mock fetch
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
    expect(records[0].costUsd).toBe(4.5); // 450 cents = $4.50
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
```

- [ ] **Step 2: Run test — verify fail**

```bash
npm test -- tests/providers/anthropic.test.ts
```

- [ ] **Step 3: Implement Anthropic provider**

Create `src/providers/anthropic.ts`:

```typescript
import type { UsageProvider, UsageRecord } from "./types";
import { env } from "@/lib/env";

const API_BASE = "https://api.anthropic.com/v1/organizations";

interface UsageBucket {
  bucket_start_time: string;
  bucket_end_time: string;
  input_tokens: number;
  output_tokens: number;
  model: string;
}

interface CostBucket {
  bucket_start_time: string;
  bucket_end_time: string;
  amount: number; // cents
  description: string;
}

const fetchWithAuth = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      "x-api-key": env.anthropicAdminKey!,
      "anthropic-version": "2023-06-01",
    },
  });
  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
};

const fetchAllPages = async <T>(baseUrl: string): Promise<T[]> => {
  const results: T[] = [];
  let url = baseUrl;
  while (true) {
    const data = await fetchWithAuth(url);
    results.push(...data.data);
    if (!data.has_more) break;
    url = `${baseUrl}&page=${data.next_page}`;
  }
  return results;
};

export const anthropicProvider: UsageProvider = {
  name: "anthropic",

  isConfigured: () => !!env.anthropicAdminKey,

  async fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    const start = startDate.toISOString();
    const end = endDate.toISOString();

    const [usageBuckets, costBuckets] = await Promise.all([
      fetchAllPages<UsageBucket>(
        `${API_BASE}/usage_report/messages?starting_at=${start}&ending_at=${end}&bucket_width=1h&group_by[]=model`
      ),
      fetchAllPages<CostBucket>(
        `${API_BASE}/cost_report?starting_at=${start}&ending_at=${end}&bucket_width=1h`
      ),
    ]);

    // Build cost lookup: "model|start" -> cost in USD
    const costMap = new Map<string, number>();
    for (const c of costBuckets) {
      costMap.set(
        `${c.description}|${c.bucket_start_time}`,
        c.amount / 100 // cents to dollars
      );
    }

    return usageBuckets.map((u) => ({
      provider: "anthropic",
      model: u.model,
      inputTokens: u.input_tokens,
      outputTokens: u.output_tokens,
      costUsd: costMap.get(`${u.model}|${u.bucket_start_time}`) ?? 0,
      periodStart: u.bucket_start_time,
      periodEnd: u.bucket_end_time,
    }));
  },
};
```

- [ ] **Step 4: Run test — verify pass**

```bash
npm test -- tests/providers/anthropic.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/providers/anthropic.ts tests/providers/anthropic.test.ts
git commit -m "feat: add Anthropic usage provider"
```

---

### Task 8: OpenAI Provider

**Files:**
- Create: `src/providers/openai.ts`, `tests/providers/openai.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/providers/openai.test.ts`:

```typescript
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
    // Usage response
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

    // Cost response
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
```

- [ ] **Step 2: Run test — verify fail**

```bash
npm test -- tests/providers/openai.test.ts
```

- [ ] **Step 3: Implement OpenAI provider**

Create `src/providers/openai.ts`:

```typescript
import type { UsageProvider, UsageRecord } from "./types";
import { env } from "@/lib/env";

const API_BASE = "https://api.openai.com/v1/organization";

interface UsageBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    input_tokens: number;
    output_tokens: number;
    model: string | null;
    num_model_requests: number;
  }>;
}

interface CostBucket {
  start_time: number;
  end_time: number;
  results: Array<{
    amount: { value: number; currency: string };
    line_item: string | null;
  }>;
}

const fetchWithAuth = async (url: string) => {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.openaiAdminKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
};

const fetchAllPages = async <T>(baseUrl: string): Promise<T[]> => {
  const results: T[] = [];
  let url = baseUrl;
  while (true) {
    const data = await fetchWithAuth(url);
    results.push(...data.data);
    if (!data.has_more) break;
    url = `${baseUrl}&page=${data.next_page}`;
  }
  return results;
};

export const openaiProvider: UsageProvider = {
  name: "openai",

  isConfigured: () => !!env.openaiAdminKey,

  async fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]> {
    const startUnix = Math.floor(startDate.getTime() / 1000);
    const endUnix = Math.floor(endDate.getTime() / 1000);

    const [usageBuckets, costBuckets] = await Promise.all([
      fetchAllPages<UsageBucket>(
        `${API_BASE}/usage/completions?start_time=${startUnix}&end_time=${endUnix}&bucket_width=1h&group_by[]=model`
      ),
      fetchAllPages<CostBucket>(
        `${API_BASE}/costs?start_time=${startUnix}&end_time=${endUnix}&bucket_width=1d&group_by[]=line_item`
      ),
    ]);

    // Build cost lookup: "model|day_start" -> cost
    const costMap = new Map<string, number>();
    for (const b of costBuckets) {
      for (const r of b.results) {
        if (r.line_item) {
          costMap.set(`${r.line_item}|${b.start_time}`, r.amount.value);
        }
      }
    }

    // Count total tokens per model per day for proportional cost distribution
    // (OpenAI costs API only supports daily granularity)
    const modelDayTokens = new Map<string, number>();
    for (const bucket of usageBuckets) {
      for (const r of bucket.results) {
        if (!r.model) continue;
        const dayStart = Math.floor(bucket.start_time / 86400) * 86400;
        const key = `${r.model}|${dayStart}`;
        modelDayTokens.set(key, (modelDayTokens.get(key) ?? 0) + r.input_tokens + r.output_tokens);
      }
    }

    const records: UsageRecord[] = [];
    for (const bucket of usageBuckets) {
      for (const r of bucket.results) {
        if (!r.model) continue;
        const dayStart = Math.floor(bucket.start_time / 86400) * 86400;
        const dayCost = costMap.get(`${r.model}|${dayStart}`) ?? 0;
        const dayTokens = modelDayTokens.get(`${r.model}|${dayStart}`) ?? 1;
        const bucketTokens = r.input_tokens + r.output_tokens;
        // Distribute daily cost proportionally by token count
        const proportionalCost = dayCost * (bucketTokens / dayTokens);

        records.push({
          provider: "openai",
          model: r.model,
          inputTokens: r.input_tokens,
          outputTokens: r.output_tokens,
          costUsd: proportionalCost,
          periodStart: new Date(bucket.start_time * 1000).toISOString(),
          periodEnd: new Date(bucket.end_time * 1000).toISOString(),
        });
      }
    }
    return records;
  },
};
```

- [ ] **Step 4: Run test — verify pass**

```bash
npm test -- tests/providers/openai.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/providers/openai.ts tests/providers/openai.test.ts
git commit -m "feat: add OpenAI usage provider"
```

---

## Chunk 3: Cron Endpoint, Alert Engine & Project Files

### Task 9: Alert Engine (uses alert_rules table)

**Files:**
- Create: `src/alerts/engine.ts`, `tests/alerts/engine.test.ts`
- Modify: `src/db/queries.ts` (add alert rule queries)

- [ ] **Step 1: Add alert query functions to src/db/queries.ts**

Append to `src/db/queries.ts`:

```typescript
import { alertRules } from "./schema";
import { eq } from "drizzle-orm";

export const getEnabledAlertRules = async (db: DB) => {
  return db.select().from(alertRules).where(eq(alertRules.enabled, true));
};

export const updateLastTriggered = async (db: DB, ruleId: number, timestamp: string) => {
  await db.update(alertRules).set({ lastTriggered: timestamp }).where(eq(alertRules.id, ruleId));
};

export const seedAlertRulesFromEnv = async (
  db: DB,
  config: { webhookUrl: string; daily: number; weekly: number; monthly: number }
) => {
  // Only seed if no rules exist yet
  const existing = await db.select().from(alertRules);
  if (existing.length > 0) return;

  const rules: (typeof alertRules.$inferInsert)[] = [];
  if (config.daily > 0) {
    rules.push({ thresholdUsd: config.daily, period: "daily", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (config.weekly > 0) {
    rules.push({ thresholdUsd: config.weekly, period: "weekly", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (config.monthly > 0) {
    rules.push({ thresholdUsd: config.monthly, period: "monthly", webhookUrl: config.webhookUrl, enabled: true });
  }
  if (rules.length > 0) {
    await db.insert(alertRules).values(rules);
  }
};
```

Note: add `alertRules` to the import from `./schema` and `eq` to the import from `drizzle-orm` at the top of the file.

- [ ] **Step 2: Write failing alert engine test**

Create `tests/alerts/engine.test.ts`:

```typescript
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
      lastTriggered: "2026-03-10T08:00:00Z", // already triggered today
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
      lastTriggered: "2026-03-09T08:00:00Z", // triggered yesterday
    };

    const result = await checkAndFireAlerts({
      rule,
      currentSpend: 15,
      now: new Date("2026-03-10T12:00:00Z"),
    });

    expect(result.fired).toBe(true);
  });
});
```

- [ ] **Step 3: Run test — verify fail**

```bash
npm test -- tests/alerts/engine.test.ts
```

Expected: FAIL — `@/alerts/engine` module does not exist.

- [ ] **Step 4: Implement alert engine**

Create `src/alerts/engine.ts`:

```typescript
interface AlertRule {
  id: number;
  provider: string | null;
  thresholdUsd: number;
  period: "daily" | "weekly" | "monthly";
  webhookUrl: string;
  enabled: boolean;
  lastTriggered: string | null;
}

interface SlackPayload {
  text: string;
}

export const formatSlackPayload = (params: {
  provider: string | null;
  period: string;
  currentSpend: number;
  threshold: number;
}): SlackPayload => {
  const providerLabel = params.provider ?? "All providers";
  return {
    text: `🚨 *DelveStats Alert*\n*${providerLabel}* ${params.period} spend: *$${params.currentSpend.toFixed(2)}* exceeded threshold of *$${params.threshold.toFixed(2)}*`,
  };
};

const getPeriodStart = (now: Date, period: "daily" | "weekly" | "monthly"): Date => {
  switch (period) {
    case "daily":
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "weekly":
      return new Date(now.getTime() - 7 * 86400000);
    case "monthly":
      return new Date(now.getFullYear(), now.getMonth(), 1);
  }
};

const wasTriggeredInCurrentPeriod = (
  lastTriggered: string | null,
  now: Date,
  period: "daily" | "weekly" | "monthly"
): boolean => {
  if (!lastTriggered) return false;
  const triggerDate = new Date(lastTriggered);
  const periodStart = getPeriodStart(now, period);
  return triggerDate >= periodStart;
};

export const checkAndFireAlerts = async (params: {
  rule: AlertRule;
  currentSpend: number;
  now: Date;
}): Promise<{ fired: boolean }> => {
  const { rule, currentSpend, now } = params;

  if (currentSpend <= rule.thresholdUsd) return { fired: false };
  if (wasTriggeredInCurrentPeriod(rule.lastTriggered, now, rule.period)) return { fired: false };

  const payload = formatSlackPayload({
    provider: rule.provider,
    period: rule.period,
    currentSpend,
    threshold: rule.thresholdUsd,
  });

  await fetch(rule.webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  return { fired: true };
};
```

- [ ] **Step 5: Run test — verify pass**

```bash
npm test -- tests/alerts/engine.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/alerts/ tests/alerts/ src/db/queries.ts
git commit -m "feat: add alert engine with last_triggered deduplication"
```

---

### Task 10: Cron Poll Endpoint

**Files:**
- Create: `src/app/api/cron/poll/route.ts`, `vercel.json`, `tests/cron/poll.test.ts`

- [ ] **Step 1: Write failing cron test**

Create `tests/cron/poll.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all dependencies before imports
vi.mock("@/lib/env", () => ({
  env: {
    cronSecret: "test-secret",
    alertWebhookUrl: null,
    alertDailyThreshold: 0,
    alertWeeklyThreshold: 0,
    alertMonthlyThreshold: 0,
  },
}));

const mockInsertUsageRecords = vi.fn();
const mockLogPoll = vi.fn();
const mockGetSpendByPeriod = vi.fn().mockResolvedValue(0);
const mockGetEnabledAlertRules = vi.fn().mockResolvedValue([]);
const mockUpdateLastTriggered = vi.fn();
const mockSeedAlertRulesFromEnv = vi.fn();

vi.mock("@/db/queries", () => ({
  insertUsageRecords: (...args: unknown[]) => mockInsertUsageRecords(...args),
  logPoll: (...args: unknown[]) => mockLogPoll(...args),
  getSpendByPeriod: (...args: unknown[]) => mockGetSpendByPeriod(...args),
  getEnabledAlertRules: (...args: unknown[]) => mockGetEnabledAlertRules(...args),
  updateLastTriggered: (...args: unknown[]) => mockUpdateLastTriggered(...args),
  seedAlertRulesFromEnv: (...args: unknown[]) => mockSeedAlertRulesFromEnv(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

const mockProvider = {
  name: "anthropic",
  isConfigured: () => true,
  fetchUsage: vi.fn().mockResolvedValue([{
    provider: "anthropic",
    model: "claude-sonnet-4",
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 0.01,
    periodStart: "2026-03-10T00:00:00Z",
    periodEnd: "2026-03-10T01:00:00Z",
  }]),
};

vi.mock("@/providers/registry", () => ({
  getConfiguredProviders: () => [mockProvider],
}));

vi.mock("@/alerts/engine", () => ({
  checkAndFireAlerts: vi.fn().mockResolvedValue({ fired: false }),
}));

import { GET } from "@/app/api/cron/poll/route";
import { NextRequest } from "next/server";

describe("cron poll endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects unauthorized requests", async () => {
    const req = new NextRequest("http://localhost/api/cron/poll", {
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("polls providers and inserts records", async () => {
    const req = new NextRequest("http://localhost/api/cron/poll", {
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].provider).toBe("anthropic");
    expect(body.results[0].status).toBe("ok");

    expect(mockInsertUsageRecords).toHaveBeenCalled();
    expect(mockLogPoll).toHaveBeenCalledWith(expect.anything(), "anthropic", "ok");
  });
});
```

- [ ] **Step 2: Run test — verify fail**

```bash
npm test -- tests/cron/poll.test.ts
```

Expected: FAIL — route module does not exist.

- [ ] **Step 3: Write the cron route handler**

Create `src/app/api/cron/poll/route.ts`:

```typescript
import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { getConfiguredProviders } from "@/providers/registry";
import {
  insertUsageRecords,
  logPoll,
  getSpendByPeriod,
  getEnabledAlertRules,
  updateLastTriggered,
  seedAlertRulesFromEnv,
} from "@/db/queries";
import { checkAndFireAlerts } from "@/alerts/engine";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const providers = getConfiguredProviders();
  const results: Array<{ provider: string; status: string; error?: string }> = [];

  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 60 * 60 * 1000); // 1 hour ago

  for (const provider of providers) {
    try {
      const records = await provider.fetchUsage(startDate, endDate);
      if (records.length > 0) {
        await insertUsageRecords(
          db,
          records.map((r) => ({
            ...r,
            recordedAt: new Date().toISOString(),
          }))
        );
      }
      await logPoll(db, provider.name, "ok");
      results.push({ provider: provider.name, status: "ok" });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await logPoll(db, provider.name, "error", msg);
      results.push({ provider: provider.name, status: "error", error: msg });
    }
  }

  // Seed alert rules from env on first run
  if (env.alertWebhookUrl) {
    await seedAlertRulesFromEnv(db, {
      webhookUrl: env.alertWebhookUrl,
      daily: env.alertDailyThreshold,
      weekly: env.alertWeeklyThreshold,
      monthly: env.alertMonthlyThreshold,
    });
  }

  // Check alerts from alert_rules table
  const now = new Date();
  const alertRules = await getEnabledAlertRules(db);

  for (const rule of alertRules) {
    const periodStart = rule.period === "daily"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
      : rule.period === "weekly"
      ? new Date(now.getTime() - 7 * 86400000).toISOString()
      : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const spend = await getSpendByPeriod(db, periodStart, now.toISOString(), rule.provider ?? undefined);

    const { fired } = await checkAndFireAlerts({
      rule: rule as Parameters<typeof checkAndFireAlerts>[0]["rule"],
      currentSpend: spend,
      now,
    });

    if (fired) {
      await updateLastTriggered(db, rule.id, now.toISOString());
    }
  }

  return Response.json({ results });
}
```

- [ ] **Step 4: Write vercel.json**

Create `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/poll",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 5: Run test — verify pass**

```bash
npm test -- tests/cron/poll.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/ vercel.json tests/cron/
git commit -m "feat: add cron poll endpoint with database-driven alert rules"
```

---

### Task 11: Project Files (License, README, .env.example)

**Files:**
- Create: `LICENSE`, `README.md`

- [ ] **Step 1: Write MIT LICENSE**

```
MIT License

Copyright (c) 2026 DelveStats

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Write README.md**

```markdown
# DelveStats

Self-hosted dashboard for monitoring AI API costs and usage across multiple providers in one unified view.

> **No proxy required.** DelveStats reads usage data directly from each provider's billing API — no need to route your API calls through a middleman.

## Supported Providers

| Provider | Status | API Key Type |
|----------|--------|--------------|
| Anthropic | ✅ Full support | Admin key (`sk-ant-admin-...`) |
| OpenAI | ✅ Full support | Admin key |
| Google AI (Gemini) | 🚧 Coming soon | — |
| Kimi (Moonshot) | 🚧 Coming soon | — |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_USERNAME%2Fdelvestats&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,CRON_SECRET&envDescription=Required%20environment%20variables&project-name=delvestats)

### Prerequisites

1. A [Turso](https://turso.tech) database (free tier works)
2. Admin API keys from your AI providers
3. A Vercel account (Pro plan for hourly cron; Hobby for daily)

### Setup

1. Clone this repo
2. Copy `.env.example` to `.env.local` and fill in your keys
3. Create a Turso database:
   ```bash
   turso db create delvestats
   turso db tokens create delvestats
   ```
4. Push the database schema:
   ```bash
   npx drizzle-kit push
   ```
5. Run locally:
   ```bash
   npm run dev
   ```

## Configuration

All configuration is via environment variables. See [`.env.example`](.env.example) for the full list.

### Alert Webhooks

DelveStats sends Slack-formatted JSON payloads to your webhook URL when spend exceeds thresholds. Works with:

- **Slack** — [Create an Incoming Webhook](https://api.slack.com/messaging/webhooks)
- **Discord** — Use a Slack-compatible webhook URL (`/slack` suffix)
- **Microsoft Teams** — Use an Incoming Webhook connector
- **Zapier/Make** — Use a Webhook trigger

## Development

```bash
npm install
npm run dev    # Start dev server
npm test       # Run tests
```

## License

MIT
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: add MIT license and README with deploy instructions"
```

---

### Task 12: Final Verification

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 2: Run build**

```bash
npm run build
```

Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 3: Fix any issues found**

If tests or build fail, fix the issues and commit.

- [ ] **Step 4: Final commit (if any fixes)**

```bash
git add -A
git commit -m "fix: resolve build/test issues from final verification"
```
