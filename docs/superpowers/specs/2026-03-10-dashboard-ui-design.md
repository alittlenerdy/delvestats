# DelveStats Dashboard UI — Design Spec

> Neon-accented dark theme dashboard for monitoring AI API costs across providers.

**Domain:** delvestats.com
**Scope:** Frontend dashboard UI — all three sections (Overview, Provider Cards, Data Table) plus API route.

---

## Color System

### Base Palette (dark layered backgrounds)
- `--bg-root`: `#09090b` (zinc-950) — page background
- `--bg-card`: `#18181b` (zinc-900) — card surfaces
- `--bg-elevated`: `#27272a` (zinc-800) — hover states, table headers
- `--border`: `#3f3f46` (zinc-700) — subtle borders

### Neon Accents
- **Neon Green** `#39ff14` — primary accent, total spend, success states
- **Neon Purple** `#bf5af2` — token counts, secondary data
- **Neon Pink** `#ff2d55` — alerts, warnings, threshold indicators
- **Neon Yellow** `#ffd60a` — highlights, hover accents

### Provider Brand Colors
- Anthropic: `#d97757` (coral)
- OpenAI: `#10a37f` (green)
- Google: `#4285f4` (blue)
- Kimi: `#ffd60a` (yellow)

### Glow Effects
Key elements get subtle `box-shadow` or `drop-shadow` using neon colors at low opacity. Not overdone — just enough to feel electric.

### Typography
- Geist Sans — UI text
- Geist Mono — all numerical data (costs, token counts, percentages)

---

## Layout

Single-page, no sidebar. Full-width content area with a slim top bar.

```
┌─────────────────────────────────────────────────┐
│  ⬡ DelveStats          Last polled: 2m ago  ↻   │  top bar
├─────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐         │
│  │  Today   │  │  Week   │  │  Month  │         │  KPI cards
│  │  $4.82   │  │ $31.40  │  │ $142.07 │         │
│  └─────────┘  └─────────┘  └─────────┘         │
├─────────────────────────────────────────────────┤
│  ██▓▓░░████▓▓░░██████▓▓████░░████▓▓██          │  30-day stacked
│  ██▓▓░░████▓▓░░██████▓▓████░░████▓▓██          │  bar chart
│  ──────────────────────────────────────          │  (by provider)
├─────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐     │
│  │ ◉ Anthropic       │  │ ◉ OpenAI         │     │  provider cards
│  │ claude-sonnet  $X │  │ gpt-4o      $X  │     │  (2-col grid)
│  │ claude-opus   $X │  │ gpt-4o-mini $X  │     │
│  └──────────────────┘  └──────────────────┘     │
├─────────────────────────────────────────────────┤
│  Provider │ Model │ In Tokens │ Out │ Cost │ Δ  │  data table
│  anthropic│ son.. │ 1.2M      │340K │$12.4 │+8% │  (sortable,
│  openai   │ gpt.. │ 890K      │210K │$8.20 │-3% │  filterable)
└─────────────────────────────────────────────────┘
```

Responsive: 2-col provider grid → 1-col on mobile. KPI cards stack vertically on small screens.

---

## Component Architecture

| Component | File | Responsibility |
|-----------|------|----------------|
| `TopBar` | `src/components/top-bar.tsx` | Logo, last-polled timestamp, refresh button |
| `KpiCards` | `src/components/kpi-cards.tsx` | Today/week/month spend with neon green glow |
| `SpendChart` | `src/components/spend-chart.tsx` | 30-day stacked bar chart, provider-colored |
| `ProviderCard` | `src/components/provider-card.tsx` | Single provider's model breakdown |
| `ProviderGrid` | `src/components/provider-grid.tsx` | 2-col responsive grid of provider cards |
| `UsageTable` | `src/components/usage-table.tsx` | Sortable/filterable data table |
| `DashboardShell` | `src/components/dashboard-shell.tsx` | Orchestrates layout, handles data fetching |

---

## Data Flow

### API Route: `GET /api/dashboard`

No auth (single-user dashboard). Returns all dashboard data in one request:

```typescript
{
  kpi: {
    today: number,
    week: number,
    month: number,
  },
  chart: Array<{
    date: string,
    anthropic: number,
    openai: number,
    google: number,
    kimi: number,
  }>,
  providers: Array<{
    name: string,
    totalCost: number,
    models: Array<{
      model: string,
      inputTokens: number,
      outputTokens: number,
      cost: number,
    }>,
    lastPollStatus: "ok" | "error",
    lastPollAt: string,
  }>,
  table: Array<{
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    cost: number,
    trend: number,
  }>,
}
```

### Fetching Strategy
1. Page loads → `DashboardShell` calls `fetch('/api/dashboard')` on mount
2. API route queries DB using aggregation functions
3. Response rendered into all four sections
4. User clicks refresh button → re-fetches, state updates, no page reload

### New DB Queries (added to `src/db/queries.ts`)
- `getKpiSpend(db)` — today/week/month totals
- `getDailySpendByProvider(db, days)` — last N days grouped by date + provider
- `getProviderBreakdown(db)` — per-provider, per-model aggregation
- `getModelTrends(db)` — current vs previous period % change

---

## Component Details

### KPI Cards
- Three cards in a row
- Label + dollar amount in Geist Mono (text-3xl)
- Neon green glow on active/highest card: `box-shadow: 0 0 20px rgba(57, 255, 20, 0.15)`
- Zinc-900 background, zinc-700 border

### Spend Chart
- Recharts `BarChart` with stacked bars
- One bar per day, stacked by provider using brand colors
- 30-day window
- Tooltip on hover with per-provider breakdown
- Grid lines in zinc-800, axis labels in zinc-400

### Provider Cards
- 2-column grid
- Left border: 4px solid in provider brand color
- Provider name + status dot (green = ok, pink = error)
- Model list: name, token counts (purple, mono), cost (green, mono)
- Total cost bottom-right

### Usage Table
- shadcn/ui DataTable
- Columns: Provider, Model, Input Tokens, Output Tokens, Cost, Trend
- Trend: green arrow + % for positive, pink arrow for negative
- Sortable columns, provider filter dropdown
- Alternating rows (zinc-900 / zinc-950)
- Formatted numbers: commas for tokens, 2 decimals for costs

### Top Bar
- "DelveStats" logo text with neon green accent
- "Last polled: Xm ago" in zinc-400
- Refresh button with neon yellow hover glow

---

## Tech Stack

- **shadcn/ui** — Card, Table, DataTable components (copy-paste, zero runtime deps)
- **Recharts** — via shadcn/ui Chart component for bar charts
- **Tailwind CSS v4** — all styling, custom CSS variables for neon palette
- **Geist Sans + Geist Mono** — already installed via Next.js scaffold

---

## Out of Scope

- Settings UI (use env vars)
- Authentication
- Real-time WebSocket updates
- Menu bar app (separate project)
- Date range picker (future enhancement)
