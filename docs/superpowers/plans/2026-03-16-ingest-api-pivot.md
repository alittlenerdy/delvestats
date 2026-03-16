# Ingest API Pivot Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace admin-API polling with a self-reporting ingest endpoint so client apps POST their own AI usage data to DelveStats.

**Architecture:** New `POST /api/ingest` endpoint receives usage records from client apps via a drop-in middleware wrapper. Schema gains `project` and `requestId` columns. Dashboard queries gain optional project filtering. Cron polling remains as optional fallback.

**Tech Stack:** Next.js 15, Drizzle ORM, Turso (libSQL), Vitest, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-16-ingest-api-pivot.md`

---

## Chunk 1: Schema + Ingest Endpoint

### Task 1: Add `project` and `requestId` columns to schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/providers/types.ts`
- Modify: `src/lib/env.ts`
- Modify: `src/db/queries.ts`
- Modify: `.env.example`

- [ ] **Step 1: Update `src/db/schema.ts` — add two columns**

```typescript
export const usageRecords = sqliteTable("usage_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  project: text("project"),
  requestId: text("request_id").unique(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  recordedAt: text("recorded_at").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
});
```

- [ ] **Step 2: Update `src/providers/types.ts` — add optional `project`**

```typescript
export interface UsageRecord {
  provider: string;
  model: string;
  project?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  periodStart: string;
  periodEnd: string;
}
```

- [ ] **Step 3: Add `INGEST_API_KEY` to `src/lib/env.ts`**

Add after `cronSecret`:

```typescript
  // Ingest
  ingestApiKey: process.env.INGEST_API_KEY,
```

- [ ] **Step 4: Update `src/db/queries.ts` — add dedup-safe insert**

Add a new function for ingest that handles duplicate `requestId` gracefully:

```typescript
export const insertUsageRecordsIgnoreDuplicates = async (
  db: DB,
  records: (typeof usageRecords.$inferInsert)[]
) => {
  if (records.length === 0) return 0;
  const result = await db.insert(usageRecords).values(records).onConflictDoNothing();
  return result.rowsAffected;
};
```

Keep the existing `insertUsageRecords` unchanged (used by cron polling path).

- [ ] **Step 5: Update `.env.example`**

Add after the Cron section:

```bash
# Ingest API (self-reporting from client apps)
INGEST_API_KEY=generate-a-random-string-here
```

- [ ] **Step 6: Push schema to Turso**

Run: `npx drizzle-kit push --force`
Expected: Schema updated with new columns

- [ ] **Step 7: Commit**

```bash
git add src/db/schema.ts src/providers/types.ts src/lib/env.ts src/db/queries.ts .env.example
git commit -m "feat: add project and requestId columns, dedup-safe insert function"
```

---

### Task 2: Write ingest endpoint tests (TDD)

**Files:**
- Create: `tests/api/ingest.test.ts`

- [ ] **Step 1: Write test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertUsageRecordsIgnoreDuplicates = vi.fn().mockResolvedValue(undefined);

vi.mock("@/db/queries", () => ({
  insertUsageRecordsIgnoreDuplicates: (...args: unknown[]) => mockInsertUsageRecordsIgnoreDuplicates(...args),
}));

vi.mock("@/db/client", () => ({
  db: {},
}));

vi.mock("@/lib/env", () => ({
  env: {
    ingestApiKey: "test-ingest-key",
  },
}));

import { POST } from "@/app/api/ingest/route";

const makeRequest = (body: unknown, token?: string) => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return new Request("http://localhost/api/ingest", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
};

describe("POST /api/ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsertUsageRecordsIgnoreDuplicates.mockResolvedValue(undefined);
  });

  it("returns 401 without auth header", async () => {
    const res = await POST(makeRequest({ provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 }));
    expect(res.status).toBe(401);
  });

  it("returns 401 with wrong token", async () => {
    const res = await POST(makeRequest({ provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 }, "wrong-key"));
    expect(res.status).toBe(401);
  });

  it("inserts a single record", async () => {
    const body = {
      project: "replysequence",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 1523,
      outputTokens: 412,
      costUsd: 0.0089,
      requestId: "abc-123",
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(1);
    expect(mockInsertUsageRecordsIgnoreDuplicates).toHaveBeenCalledOnce();
    const records = mockInsertUsageRecordsIgnoreDuplicates.mock.calls[0][1];
    expect(records[0].provider).toBe("anthropic");
    expect(records[0].project).toBe("replysequence");
    expect(records[0].requestId).toBe("abc-123");
  });

  it("inserts a batch of records", async () => {
    const body = {
      records: [
        { provider: "anthropic", model: "claude-sonnet-4", inputTokens: 100, outputTokens: 50, costUsd: 0.01 },
        { provider: "openai", model: "gpt-4o", inputTokens: 200, outputTokens: 100, costUsd: 0.02 },
      ],
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.inserted).toBe(2);
  });

  it("returns 400 for missing required fields", async () => {
    const body = { provider: "anthropic" }; // missing model, tokens, cost
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for batch over 100 records", async () => {
    const records = Array.from({ length: 101 }, (_, i) => ({
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    }));
    const res = await POST(makeRequest({ records }, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid project format", async () => {
    const body = {
      project: "INVALID CAPS & SPACES!",
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(400);
  });

  it("accepts record without project (defaults to null)", async () => {
    const body = {
      provider: "anthropic",
      model: "claude-sonnet-4",
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.01,
    };
    const res = await POST(makeRequest(body, "test-ingest-key"));
    expect(res.status).toBe(201);
    const records = mockInsertUsageRecordsIgnoreDuplicates.mock.calls[0][1];
    expect(records[0].project).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/ingest.test.ts`
Expected: FAIL — module `@/app/api/ingest/route` not found

- [ ] **Step 3: Commit test file**

```bash
git add tests/api/ingest.test.ts
git commit -m "test: add ingest API endpoint test suite"
```

---

### Task 3: Implement ingest endpoint

**Files:**
- Create: `src/app/api/ingest/route.ts`

- [ ] **Step 1: Create the endpoint**

```typescript
import { env } from "@/lib/env";
import { db } from "@/db/client";
import { insertUsageRecordsIgnoreDuplicates } from "@/db/queries";

export const dynamic = "force-dynamic";

const PROJECT_PATTERN = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]?$/;
const MAX_BATCH_SIZE = 100;

interface IngestRecord {
  project?: string | null;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestId?: string;
}

const validateRecord = (r: unknown): r is IngestRecord => {
  if (typeof r !== "object" || r === null) return false;
  const rec = r as Record<string, unknown>;
  return (
    typeof rec.provider === "string" &&
    typeof rec.model === "string" &&
    typeof rec.inputTokens === "number" &&
    typeof rec.outputTokens === "number" &&
    typeof rec.costUsd === "number"
  );
};

const validateProject = (project: unknown): boolean => {
  if (project === undefined || project === null) return true;
  if (typeof project !== "string") return false;
  return PROJECT_PATTERN.test(project) && project.length <= 64;
};

export const POST = async (request: Request) => {
  if (!env.ingestApiKey) {
    return Response.json({ error: "INGEST_API_KEY not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.ingestApiKey}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Normalize to array of records
  const raw = body as Record<string, unknown>;
  const recordsRaw: unknown[] = Array.isArray(raw.records) ? raw.records : [raw];

  if (recordsRaw.length > MAX_BATCH_SIZE) {
    return Response.json(
      { error: `Batch size ${recordsRaw.length} exceeds max of ${MAX_BATCH_SIZE}` },
      { status: 400 }
    );
  }

  // Validate all records
  for (const r of recordsRaw) {
    if (!validateRecord(r)) {
      return Response.json(
        { error: "Each record requires: provider, model, inputTokens, outputTokens, costUsd" },
        { status: 400 }
      );
    }
    if (!validateProject((r as IngestRecord).project)) {
      return Response.json(
        { error: "project must be lowercase alphanumeric with hyphens, max 64 chars" },
        { status: 400 }
      );
    }
  }

  const records = recordsRaw as IngestRecord[];
  const now = new Date().toISOString();

  const dbRecords = records.map((r) => ({
    provider: r.provider,
    model: r.model,
    project: r.project ?? null,
    requestId: r.requestId ?? null,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    costUsd: r.costUsd,
    recordedAt: now,
    periodStart: now,
    periodEnd: now,
  }));

  const inserted = await insertUsageRecordsIgnoreDuplicates(db, dbRecords);

  return Response.json({ inserted: inserted ?? dbRecords.length }, { status: 201 });
};
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm test -- tests/api/ingest.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing + new)

- [ ] **Step 4: Commit**

```bash
git add src/app/api/ingest/route.ts
git commit -m "feat: add POST /api/ingest endpoint with auth, validation, and batch support"
```

---

## Chunk 2: Dashboard Query Updates

### Task 4: Add project filtering to dashboard queries (TDD)

**Files:**
- Modify: `tests/db/dashboard-queries.test.ts`
- Modify: `src/db/dashboard-queries.ts`

- [ ] **Step 1: Update test CREATE TABLE to include new columns**

In `tests/db/dashboard-queries.test.ts`, update the `beforeEach` CREATE TABLE:

```sql
CREATE TABLE usage_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  project TEXT,
  request_id TEXT UNIQUE,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_usd REAL NOT NULL,
  recorded_at TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL
)
```

- [ ] **Step 2: Add project-filtered tests**

Add after the existing `getModelTrends` describe block:

```typescript
  describe("project filtering", () => {
    it("getKpiSpend filters by project", async () => {
      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const todayStart = `${todayStr}T00:00:00.000Z`;

      await insertRecord({ costUsd: 5.0, periodStart: todayStart, project: "replysequence" });
      await insertRecord({ costUsd: 3.0, periodStart: todayStart, project: "brilliant-nerd" });

      const all = await getKpiSpend(testDb);
      expect(all.today).toBeCloseTo(8.0);

      const rsOnly = await getKpiSpend(testDb, "replysequence");
      expect(rsOnly.today).toBeCloseTo(5.0);
    });

    it("getProviderBreakdown filters by project", async () => {
      const now = new Date();
      const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

      await insertRecord({ provider: "anthropic", model: "claude-sonnet-4", costUsd: 5.0, periodStart: monthStart, project: "replysequence" });
      await insertRecord({ provider: "openai", model: "gpt-4o", costUsd: 3.0, periodStart: monthStart, project: "brilliant-nerd" });

      const all = await getProviderBreakdown(testDb);
      expect(all).toHaveLength(2);

      const rsOnly = await getProviderBreakdown(testDb, "replysequence");
      expect(rsOnly).toHaveLength(1);
      expect(rsOnly[0].provider).toBe("anthropic");
    });
  });

  describe("getDistinctProjects", () => {
    it("returns unique project names", async () => {
      await insertRecord({ project: "replysequence" });
      await insertRecord({ project: "replysequence" });
      await insertRecord({ project: "brilliant-nerd" });
      await insertRecord({ project: null });

      const projects = await getDistinctProjects(testDb);
      expect(projects).toEqual(["brilliant-nerd", "replysequence"]);
    });
  });

  describe("getLatestIngestTimestamp", () => {
    it("returns most recent recorded_at", async () => {
      await insertRecord({ recordedAt: "2026-03-15T10:00:00Z" });
      await insertRecord({ recordedAt: "2026-03-16T12:00:00Z" });

      const latest = await getLatestIngestTimestamp(testDb);
      expect(latest).toBe("2026-03-16T12:00:00Z");
    });

    it("returns null when no records", async () => {
      const latest = await getLatestIngestTimestamp(testDb);
      expect(latest).toBeNull();
    });
  });
```

Update the `insertRecord` helper to support project:

```typescript
async function insertRecord(overrides: Partial<typeof schema.usageRecords.$inferInsert> = {}) {
  const defaults = {
    provider: "anthropic",
    model: "claude-sonnet-4",
    project: null,
    inputTokens: 1000,
    outputTokens: 500,
    costUsd: 1.0,
    recordedAt: new Date().toISOString(),
    periodStart: new Date().toISOString(),
    periodEnd: new Date().toISOString(),
  };
  await testDb.insert(schema.usageRecords).values({ ...defaults, ...overrides });
}
```

Update the imports at the top to include new functions:

```typescript
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
  getDistinctProjects,
  getLatestIngestTimestamp,
} from "@/db/dashboard-queries";
```

- [ ] **Step 3: Run tests to verify new tests fail**

Run: `npm test -- tests/db/dashboard-queries.test.ts`
Expected: New tests FAIL (functions don't accept project param yet)

- [ ] **Step 4: Update `src/db/dashboard-queries.ts`**

Add project filter support to each function. Add a helper at the top:

```typescript
import { sql, desc, eq, and, isNotNull } from "drizzle-orm";
```

Update `getKpiSpend`:

```typescript
export async function getKpiSpend(db: DB, project?: string) {
  const now = new Date();
  const todayStart = now.toISOString().split("T")[0] + "T00:00:00.000Z";
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const projectFilter = project ? sql` AND ${usageRecords.project} = ${project}` : sql``;

  const [todayResult, weekResult, monthResult] = await Promise.all([
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${todayStart}${projectFilter}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${weekStart}${projectFilter}`),
    db.select({ total: sql<number>`COALESCE(SUM(${usageRecords.costUsd}), 0)` })
      .from(usageRecords)
      .where(sql`${usageRecords.periodStart} >= ${monthStart}${projectFilter}`),
  ]);

  return {
    today: todayResult[0].total,
    week: weekResult[0].total,
    month: monthResult[0].total,
  };
}
```

Apply the same pattern to `getDailySpendByProvider`, `getProviderBreakdown`, and `getModelTrends` — add `project?: string` parameter and append `${projectFilter}` to the WHERE clause.

Add two new functions at the bottom:

```typescript
export async function getDistinctProjects(db: DB): Promise<string[]> {
  const rows = await db
    .selectDistinct({ project: usageRecords.project })
    .from(usageRecords)
    .where(isNotNull(usageRecords.project))
    .orderBy(usageRecords.project);

  return rows.map((r) => r.project!);
}

export async function getLatestIngestTimestamp(db: DB, project?: string): Promise<string | null> {
  const projectFilter = project ? sql` AND ${usageRecords.project} = ${project}` : sql``;

  const result = await db
    .select({ latest: sql<string | null>`MAX(${usageRecords.recordedAt})` })
    .from(usageRecords)
    .where(sql`1=1${projectFilter}`);

  return result[0]?.latest ?? null;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- tests/db/dashboard-queries.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 6: Commit**

```bash
git add src/db/dashboard-queries.ts tests/db/dashboard-queries.test.ts
git commit -m "feat: add project filtering to dashboard queries"
```

---

### Task 5: Update dashboard API route for project filter

**Files:**
- Modify: `src/app/api/dashboard/route.ts`
- Modify: `tests/api/dashboard.test.ts`

- [ ] **Step 1: Update `tests/api/dashboard.test.ts`**

Add a mock for the new functions and update GET to accept NextRequest:

Add to the mocks section:

```typescript
const mockGetDistinctProjects = vi.fn().mockResolvedValue(["brilliant-nerd", "replysequence"]);
const mockGetLatestIngestTimestamp = vi.fn().mockResolvedValue("2026-03-16T12:00:00Z");
```

Update the `vi.mock("@/db/dashboard-queries"` block to include:

```typescript
  getDistinctProjects: (...args: unknown[]) => mockGetDistinctProjects(...args),
  getLatestIngestTimestamp: (...args: unknown[]) => mockGetLatestIngestTimestamp(...args),
```

**IMPORTANT:** Update all existing `GET()` calls in this file to pass a Request object, since the route now reads `request.url`. Replace every bare `GET()` call with `GET(new Request("http://localhost/api/dashboard"))`.

Add a test for project filtering:

```typescript
  it("passes project query param to queries", async () => {
    const req = new Request("http://localhost/api/dashboard?project=replysequence");
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(mockGetKpiSpend).toHaveBeenCalledWith(expect.anything(), "replysequence");
    expect(mockGetDailySpendByProvider).toHaveBeenCalledWith(expect.anything(), 30, "replysequence");
  });

  it("includes projects and lastDataAt in response", async () => {
    const req = new Request("http://localhost/api/dashboard");
    const res = await GET(req);
    const body = await res.json();
    expect(body.projects).toEqual(["brilliant-nerd", "replysequence"]);
    expect(body.lastDataAt).toBe("2026-03-16T12:00:00Z");
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- tests/api/dashboard.test.ts`
Expected: New tests FAIL

- [ ] **Step 3: Update `src/app/api/dashboard/route.ts`**

Update to accept project query param and call new functions:

```typescript
import { db } from "@/db/client";
import {
  getKpiSpend,
  getDailySpendByProvider,
  getProviderBreakdown,
  getModelTrends,
  getLatestPollPerProvider,
  getDistinctProjects,
  getLatestIngestTimestamp,
} from "@/db/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const project = url.searchParams.get("project") ?? undefined;

    const [kpi, dailySpend, breakdown, trends, polls, projects, lastDataAt] = await Promise.all([
      getKpiSpend(db, project),
      getDailySpendByProvider(db, 30, project),
      getProviderBreakdown(db, project),
      getModelTrends(db, project),
      getLatestPollPerProvider(db),
      getDistinctProjects(db),
      getLatestIngestTimestamp(db, project),
    ]);

    // ... existing pivot/grouping code unchanged ...

    return Response.json({ kpi, chart, providers, table, lastPolledAt, projects, lastDataAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return Response.json({ error: message }, { status: 500 });
  }
}
```

Keep all the existing chart/provider/table pivoting logic exactly as-is. Only changes are: adding `project` param to query calls, adding `projects` and `lastDataAt` to the response.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- tests/api/dashboard.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/app/api/dashboard/route.ts tests/api/dashboard.test.ts
git commit -m "feat: add project filter and metadata to dashboard API"
```

---

## Chunk 3: Dashboard UI Updates

### Task 6: Update TopBar, DashboardShell, and empty state

**Files:**
- Modify: `src/components/top-bar.tsx`
- Modify: `src/components/dashboard-shell.tsx`

- [ ] **Step 1: Update TopBar to accept project filter**

```typescript
"use client";

import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import { RefreshCw } from "lucide-react";

interface TopBarProps {
  lastDataAt: string;
  projects: string[];
  selectedProject: string | null;
  onProjectChange: (project: string | null) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const TopBar = ({ lastDataAt, projects, selectedProject, onProjectChange, onRefresh, isLoading }: TopBarProps) => {
  return (
    <header className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold tracking-tight">
          <span className="text-[var(--neon-green)]">Delve</span>Stats
        </span>
        {projects.length > 0 && (
          <select
            value={selectedProject ?? ""}
            onChange={(e) => onProjectChange(e.target.value || null)}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-[var(--neon-green)]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-4">
        {lastDataAt && (
          <span className="text-sm text-muted-foreground font-mono">
            Last data: {timeAgo(lastDataAt)}
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
};
```

- [ ] **Step 2: Update DashboardShell with project state and filtering**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { TopBar } from "./top-bar";
import { KpiCards, KpiCardsSkeleton } from "./kpi-cards";
import { SpendChart, SpendChartSkeleton } from "./spend-chart";
import { ProviderGrid, ProviderGridSkeleton } from "./provider-grid";
import { UsageTable, UsageTableSkeleton } from "./usage-table";

interface DashboardData {
  kpi: { today: number; week: number; month: number };
  chart: Array<{ date: string; [provider: string]: string | number }>;
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
  lastDataAt: string;
  projects: string[];
}

export const DashboardShell = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedProject = searchParams.get("project");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = selectedProject ? `?project=${selectedProject}` : "";
      const res = await fetch(`/api/dashboard${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleProjectChange = (project: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (project) {
      params.set("project", project);
    } else {
      params.delete("project");
    }
    router.push(`?${params.toString()}`);
  };

  const hasData = data && (data.providers.length > 0 || data.kpi.month > 0);

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <TopBar
        lastDataAt={data?.lastDataAt ?? ""}
        projects={data?.projects ?? []}
        selectedProject={selectedProject}
        onProjectChange={handleProjectChange}
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
              No usage data yet. Set up the reporting middleware in your projects to start tracking.
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
};
```

- [ ] **Step 3: Wrap page.tsx in Suspense for useSearchParams**

`src/app/page.tsx` needs a Suspense boundary since `useSearchParams()` requires it in Next.js App Router:

```typescript
import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard-shell";

export default function Home() {
  return (
    <Suspense>
      <DashboardShell />
    </Suspense>
  );
}
```

- [ ] **Step 4: Build to verify no errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 5: Run full test suite**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/top-bar.tsx src/components/dashboard-shell.tsx src/app/page.tsx
git commit -m "feat: add project filter dropdown and updated empty state to dashboard UI"
```

---

## Chunk 4: Reporting Middleware

### Task 7: Create delvestats-report middleware

**Files:**
- Create: `src/lib/delvestats-report.ts`

This is the drop-in file that client projects copy into their codebase.

- [ ] **Step 1: Create middleware file**

```typescript
/**
 * DelveStats Usage Reporting Middleware
 *
 * Drop this file into any project that uses Anthropic or OpenAI SDKs.
 * It wraps the client to automatically report usage to DelveStats.
 *
 * Env vars required:
 *   DELVESTATS_INGEST_URL — e.g., https://delvestats.ai/api/ingest
 *   DELVESTATS_API_KEY    — matches INGEST_API_KEY on the DelveStats server
 */

const DELVESTATS_URL = process.env.DELVESTATS_INGEST_URL;
const DELVESTATS_KEY = process.env.DELVESTATS_API_KEY;

// Per-1M-token pricing
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-20250514": { input: 0.80, output: 4 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  // OpenAI
  "gpt-4o": { input: 2.50, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.40, output: 1.60 },
  "gpt-4.1-nano": { input: 0.10, output: 0.40 },
  "o3": { input: 2, output: 8 },
  "o3-mini": { input: 1.10, output: 4.40 },
  "o4-mini": { input: 1.10, output: 4.40 },
};

const calculateCost = (model: string, inputTokens: number, outputTokens: number): number => {
  // Try exact match first, then prefix match for dated model IDs
  const pricing = PRICING[model] ?? Object.entries(PRICING).find(([key]) => model.startsWith(key))?.[1];
  if (!pricing) {
    console.warn(`[delvestats] Unknown model "${model}" — reporting with $0 cost. Update PRICING table.`);
    return 0;
  }
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
};

const reportUsage = (data: {
  project: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  requestId: string;
}) => {
  if (!DELVESTATS_URL || !DELVESTATS_KEY) return;

  fetch(DELVESTATS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DELVESTATS_KEY}`,
    },
    body: JSON.stringify(data),
  }).catch((err) => {
    console.warn(`[delvestats] Failed to report usage: ${err.message}`);
  });
};

const generateId = (): string =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface DelvestatsConfig {
  project: string;
}

/**
 * Wrap an Anthropic client to auto-report usage.
 * Usage: const client = withDelvestatsAnthropic(new Anthropic(), { project: "my-app" });
 */
export const withDelvestatsAnthropic = <T extends { messages: { create: (...args: unknown[]) => Promise<unknown> } }>(
  client: T,
  config: DelvestatsConfig
): T => {
  const originalCreate = client.messages.create.bind(client.messages);

  client.messages.create = async (...args: unknown[]) => {
    const result = await originalCreate(...args);
    const response = result as {
      model?: string;
      usage?: { input_tokens: number; output_tokens: number };
    };

    if (response.usage && response.model) {
      const { input_tokens, output_tokens } = response.usage;
      reportUsage({
        project: config.project,
        provider: "anthropic",
        model: response.model,
        inputTokens: input_tokens,
        outputTokens: output_tokens,
        costUsd: calculateCost(response.model, input_tokens, output_tokens),
        requestId: generateId(),
      });
    }

    return result;
  };

  return client;
};

/**
 * Wrap an OpenAI client to auto-report usage.
 * Usage: const client = withDelvestatsOpenAI(new OpenAI(), { project: "my-app" });
 */
export const withDelvestatsOpenAI = <T extends { chat: { completions: { create: (...args: unknown[]) => Promise<unknown> } } }>(
  client: T,
  config: DelvestatsConfig
): T => {
  const originalCreate = client.chat.completions.create.bind(client.chat.completions);

  client.chat.completions.create = async (...args: unknown[]) => {
    const result = await originalCreate(...args);
    const response = result as {
      model?: string;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    if (response.usage && response.model) {
      const { prompt_tokens, completion_tokens } = response.usage;
      reportUsage({
        project: config.project,
        provider: "openai",
        model: response.model,
        inputTokens: prompt_tokens,
        outputTokens: completion_tokens,
        costUsd: calculateCost(response.model, prompt_tokens, completion_tokens),
        requestId: generateId(),
      });
    }

    return result;
  };

  return client;
};
```

- [ ] **Step 2: Build to verify no TypeScript errors**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/delvestats-report.ts
git commit -m "feat: add delvestats-report middleware for Anthropic and OpenAI SDKs"
```

---

### Task 8: Update .env.example and README, generate INGEST_API_KEY

**Files:**
- Modify: `.env.example`
- Modify: `.env.local`

- [ ] **Step 1: Generate INGEST_API_KEY**

Run: `openssl rand -hex 32`
Copy the output.

- [ ] **Step 2: Add to `.env.local`**

Add: `INGEST_API_KEY=<generated value>`

- [ ] **Step 3: Add to Vercel env vars**

Vercel Dashboard → delvestats → Settings → Environment Variables → add `INGEST_API_KEY` for Production

- [ ] **Step 4: Run full test suite one final time**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 5: Build check**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 6: Push schema changes to Turso**

Run: `npx drizzle-kit push --force`
Expected: Schema updated

- [ ] **Step 7: Commit and push**

```bash
git add .env.example
git commit -m "chore: add INGEST_API_KEY to env example"
git push origin main
```
