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
