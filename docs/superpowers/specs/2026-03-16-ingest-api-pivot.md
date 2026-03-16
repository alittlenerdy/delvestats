# DelveStats: Self-Reporting Ingest API

**Date:** 2026-03-16
**Status:** Approved
**Context:** Admin API polling (Anthropic/OpenAI) requires Team plan admin keys unavailable on individual accounts. Pivoting to a self-reporting model where client apps POST their own usage data to DelveStats after each AI API call.

## Goals

- Track all AI agent API usage across all providers in one place
- Per-project cost attribution (ReplySequence, Brilliant Nerd, agent-ops, etc.)
- No dependency on provider admin APIs or plan upgrades
- Non-blocking — usage reporting never slows down client apps
- Fail-safe — if DelveStats is down, client apps keep working

## Architecture Overview

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ ReplySequence│    │ Brilliant    │    │ Agent Ops    │
│              │    │ Nerd         │    │              │
│ Anthropic SDK│    │ Anthropic SDK│    │ OpenAI SDK   │
│ + middleware │    │ + middleware │    │ + middleware  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │ POST /api/ingest
                           ▼
                   ┌───────────────┐
                   │  DelveStats   │
                   │  (Vercel)     │
                   │               │
                   │  Turso DB     │
                   │  Dashboard UI │
                   │  Alert Engine │
                   └───────────────┘
```

## 1. Schema Change

Add a nullable `project` column to `usage_records`:

```typescript
// src/db/schema.ts
export const usageRecords = sqliteTable("usage_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  project: text("project"),                    // NEW — nullable
  requestId: text("request_id").unique(),      // NEW — dedup key
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  costUsd: real("cost_usd").notNull(),
  recordedAt: text("recorded_at").notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
});
```

Nullable so existing records and the optional cron polling path still work without a project value.

Also update the `UsageRecord` interface in `src/providers/types.ts` to include `project?: string` for consistency.

## 2. Ingest API Endpoint

### `POST /api/ingest`

**Authentication:** `Authorization: Bearer <INGEST_API_KEY>` env var.

**Single record payload:**
```json
{
  "project": "replysequence",
  "provider": "anthropic",
  "model": "claude-sonnet-4-20250514",
  "inputTokens": 1523,
  "outputTokens": 412,
  "costUsd": 0.0089
}
```

**Batch payload:**
```json
{
  "records": [
    {
      "project": "replysequence",
      "provider": "anthropic",
      "model": "claude-sonnet-4-20250514",
      "inputTokens": 1523,
      "outputTokens": 412,
      "costUsd": 0.0089
    }
  ]
}
```

**Behavior:**
1. Validate auth header against `INGEST_API_KEY`
2. Validate payload — required fields: `provider`, `model`, `inputTokens`, `outputTokens`, `costUsd`
3. Optional fields: `project` (defaults to null), `requestId` (UUID for deduplication)
4. Validate `project` format: lowercase alphanumeric + hyphens, max 64 chars
5. Enforce max batch size of 100 records
6. Set `periodStart` to current ISO timestamp (point-in-time event — these are not time ranges like cron polling; both fields get the same value for compatibility with existing queries that filter on `periodStart`)
7. Set `recordedAt` to current ISO timestamp
8. Insert into `usage_records` (skip if `requestId` already exists — deduplication)
9. Return `201 { inserted: N }`

**Deduplication:** The middleware generates a UUID `requestId` per API call. The schema adds a nullable `requestId` column with a unique index. `INSERT OR IGNORE` prevents duplicates from retries or double-sends. This is critical because duplicates directly inflate reported spend.

**Error responses:**
- `401` — missing or invalid auth
- `400` — invalid payload (missing required fields, wrong types, batch > 100)

**New env var:** `INGEST_API_KEY` added to `env.ts` and `.env.example`.

## 3. Reporting Middleware

A single drop-in file (`lib/delvestats.ts`) for client projects.

### Anthropic Wrapper

```typescript
import { withDelvestats } from "./delvestats";

const client = withDelvestats(new Anthropic(), {
  project: "replysequence",
});

// Usage unchanged — client.messages.create({ ... })
// After each call, non-blocking POST to DelveStats
```

### OpenAI Wrapper

```typescript
import { withDelvestatsOpenAI } from "./delvestats";

const client = withDelvestatsOpenAI(new OpenAI(), {
  project: "replysequence",
});

// Usage unchanged — client.chat.completions.create({ ... })
```

### Design Decisions

- **Fire-and-forget**: Usage POST is async, never awaited in the request path
- **Fail-silent**: If DelveStats is unreachable, log a warning, never throw
- **Built-in pricing**: Hardcoded cost table per model (input/output per 1M tokens). Close enough for monitoring. Caller can override `costUsd` if they have exact costs. For unknown models, logs a warning and sets `costUsd: 0` — data still captured, cost shows as zero until pricing table is updated.
- **Env vars per project**: `DELVESTATS_INGEST_URL` and `DELVESTATS_API_KEY`
- **No npm package**: Single file, copy into each project. Package later if adoption grows.

### Model Pricing Table (built-in)

```typescript
const PRICING: Record<string, { input: number; output: number }> = {
  // Anthropic (per 1M tokens)
  "claude-sonnet-4-20250514": { input: 3, output: 15 },
  "claude-haiku-4-20250514": { input: 0.80, output: 4 },
  "claude-opus-4-20250514": { input: 15, output: 75 },
  // OpenAI (per 1M tokens)
  "gpt-4o": { input: 2.50, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4-turbo": { input: 10, output: 30 },
  // Extend as needed
};
```

## 4. Dashboard Updates

### Query Layer

All functions in `dashboard-queries.ts` gain an optional `project?: string` parameter:

- `getKpiSpend(db, project?)`
- `getDailySpendByProvider(db, days, project?)`
- `getProviderBreakdown(db, project?)`
- `getModelTrends(db, project?)`

When provided, adds `WHERE project = ?` to queries. When omitted, returns aggregate across all projects (existing behavior).

### API Route

`GET /api/dashboard?project=replysequence`

Optional query param. Passed through to all query functions.

### UI

- Add project filter dropdown to `TopBar` component
- Options populated dynamically from a new query: `SELECT DISTINCT project FROM usage_records WHERE project IS NOT NULL`
- "All Projects" option shows aggregate (default)
- Selection persists in URL query param via `useSearchParams()` for shareability
- Replace "Last polled" indicator with "Last data received: X ago" using `MAX(recorded_at)` query — more accurate for the ingest model
- Update empty state message: "No usage data yet. Set up the reporting middleware in your projects to start tracking."

## 5. What Stays Unchanged

- **Alert engine**: Continues checking total spend against thresholds. Project-level alerts are a future enhancement.
- **Cron polling**: `/api/cron/poll` remains in codebase as optional. Works if admin keys become available (e.g., after upgrading to Team plan). Not removed, just not the primary data source.
- **Formatting utilities**: No changes.
- **Component structure**: KPI cards, spend chart, provider grid, usage table all receive filtered data — no structural changes needed.

## 6. First Integration Target

**ReplySequence** — 3 files to update:
- `lib/claude-api.ts` (main Claude client)
- `lib/sentiment.ts` (Haiku sentiment)
- `lib/grade-draft.ts` (Haiku grading)

Each wraps the existing Anthropic client with `withDelvestats()`. Add `DELVESTATS_INGEST_URL` and `DELVESTATS_API_KEY` to RS's `.env.local` and Vercel env vars.

## 7. Test Plan

### New Tests
- `tests/api/ingest.test.ts` — auth validation, single record, batch, missing fields, wrong types, batch size limit, dedup via requestId, project format validation

### Updated Tests
- `tests/db/dashboard-queries.test.ts` — add `project TEXT` to CREATE TABLE, test project-filtered queries
- `tests/api/dashboard.test.ts` — test `?project=` query param passthrough

### Unchanged
- Provider tests, alert engine tests, format tests, cron poll tests — no changes needed

## 8. Env Vars Summary

### DelveStats (Vercel)
- `INGEST_API_KEY` — new, authenticates ingest POSTs

### Each Client Project
- `DELVESTATS_INGEST_URL` — e.g., `https://delvestats.ai/api/ingest`
- `DELVESTATS_API_KEY` — matches `INGEST_API_KEY` above
