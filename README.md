# DelveStats

Self-hosted dashboard for monitoring AI API costs and usage across multiple providers in one unified view.

> **No proxy required.** DelveStats reads usage data directly from each provider's billing API — no need to route your API calls through a middleman.

## Supported Providers

| Provider | Status | API Key Type |
|----------|--------|--------------|
| Anthropic | Full support | Admin key (`sk-ant-admin-...`) |
| OpenAI | Full support | Admin key |
| Google AI (Gemini) | Coming soon | — |
| Kimi (Moonshot) | Coming soon | — |

## Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Falittlenerdy%2Fdelvestats&env=TURSO_DATABASE_URL,TURSO_AUTH_TOKEN,CRON_SECRET&envDescription=Required%20environment%20variables&project-name=delvestats)

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

- **Slack** — Create an Incoming Webhook
- **Discord** — Use a Slack-compatible webhook URL (`/slack` suffix)
- **Microsoft Teams** — Use an Incoming Webhook connector
- **Zapier/Make** — Use a Webhook trigger

## Development

```bash
npm install
npm run dev    # Start dev server
npm test       # Run tests
```

## Adding a Provider

Each provider implements the `UsageProvider` interface from `src/providers/types.ts`:

```typescript
interface UsageProvider {
  name: string;
  fetchUsage(startDate: Date, endDate: Date): Promise<UsageRecord[]>;
  isConfigured(): boolean;
}
```

1. Create `src/providers/yourprovider.ts` implementing the interface
2. Add it to the `allProviders` array in `src/providers/registry.ts`
3. Add the API key env var to `src/lib/env.ts` and `.env.example`

## License

MIT
