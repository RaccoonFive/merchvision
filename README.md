# Merchvision

Merchvision is an Old School RuneScape Grand Exchange research tool. It ranks short-term flips and longer-horizon investment candidates using public OSRS Wiki market data, with an emphasis on conservative estimates, explainable scoring, liquidity, freshness, and risk.

The application is decision support, not a profit guarantee. It can track manually entered investment purchase lots, but it does not observe trades, track sales or realized profit, synchronize RuneLite activity, or save bankroll.

## Features

- **Flip Finder:** keeps a conservative Reliable ranking based on seven-day repeatability and adds an experimental High Upside ranking for fresh, two-sided opportunities with stronger recent profit potential.
- **Investment Finder:** identifies liquid items with positive 24-hour and 7-day midpoint trends and ranks them with a risk-adjusted momentum score.
- **Investment Tracker:** lets signed-in users record private purchase lots and compare their cost with the latest net instant-sell value after prospective GE tax.
- **Item Lookup:** shows current quotes, net margin, warnings, recent price history, and a local-time heatmap of the latest seven days of observed hourly market activity.
- **Favorites:** lets signed-in users save items and view their current quotes.
- **Accounts:** provides username/password authentication backed by Better Auth, Prisma, and MySQL. Email remains required for the account record, with a fallback sign-in path for pre-username accounts.
- **Responsive application shell:** supports global item quick search with item previews, a five-theme picker, collapsible navigation, dense tables, and detail panels.

See [the product contract](docs/PRODUCT.md), [architecture](docs/ARCHITECTURE.md), and [roadmap](TODO.md) for the reasoning behind the project and its current priorities.

## Technology

- Next.js App Router, React, and TypeScript
- Vitest and Testing Library
- Better Auth
- Prisma with MySQL
- Recharts and Lucide React
- OSRS Wiki Real-Time Prices API

## Local Setup

You need Node.js, npm, and a local or reachable MySQL server.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create the local environment file:

   ```bash
   cp .env.example .env
   ```

3. Set the values in `.env`:

   | Variable | Purpose |
   | --- | --- |
   | `USER_AGENT_CONTACT` | Required contact information for compliant OSRS Wiki API requests. |
   | `DATABASE_URL` | MySQL connection used by Prisma and Better Auth. Use a dedicated application user. |
   | `BETTER_AUTH_SECRET` | A private, random secret of at least 32 characters. |
   | `BETTER_AUTH_URL` | The application origin, normally `http://localhost:3100` for agent-run local development. |
   | `OSRS_LATEST_CACHE_SECONDS` | Optional latest-price cache TTL; defaults to 60 seconds. |
   | `OSRS_MAPPING_CACHE_SECONDS` | Optional item-mapping cache TTL; defaults to 86,400 seconds. |
   | `OSRS_TIMESERIES_CACHE_SECONDS` | Optional timeseries and 24-hour-summary cache TTL; defaults to 300 seconds. |
   | `CRON_SECRET` | Separate bearer secret for the internal 15-minute flip-calibration job and report. |

   Never commit real credentials or personal contact information. For a least-privilege database bootstrap, follow [docs/mysql-setup.md](docs/mysql-setup.md).

4. Generate the Prisma client and apply the committed migrations:

   ```bash
   npm run db:generate
   npm run db:migrate:deploy
   ```

5. Start the development server:

   ```bash
   npm run dev -- -p 3100
   ```

   Open `http://localhost:3100`.

   Agent-run development, preview, and production servers must never use port 3000. Use port 3100 by default, or another confirmed-free non-3000 port. Stop the exact server process immediately after testing and verify that its port no longer has a listener before completing the task.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev -- -p 3100` | Start the Next.js development server on the required default agent port using `.next-dev`. |
| `npm test` | Run the Vitest suite once. |
| `npm run typecheck` | Run TypeScript without emitting files. |
| `npm run build` | Create an optimized production build. |
| `npm start -- -p 3100` | Serve the production build on a non-3000 port. |
| `npm run db:generate` | Generate the Prisma client. |
| `npm run db:migrate:dev` | Create and apply a migration during schema development. |
| `npm run db:migrate:deploy` | Apply committed migrations in a deployed environment. |

## Repository Layout

```text
app/                 Pages and API route handlers
components/          Feature and shared React components
lib/                 Market logic, API integration, auth, and persistence helpers
prisma/              MySQL schema and migrations
docs/                Product, architecture, and operational documentation
AGENTS.md            Durable instructions for coding agents
TODO.md              Active milestone, backlog, and delivery history
```

## Development Notes

- Keep all direct OSRS Wiki Prices API calls in `lib/osrsWiki.ts`.
- Unit and route tests mock upstream data and should not call the live Wiki API.
- The in-memory Wiki and market-analysis caches are process-local; they are not shared across server instances and do not survive restarts.
- High Upside remains experimental while its public-market completion proxy is calibrated. Configure the protected job using [the calibration runbook](docs/flip-calibration.md).
- Run `npm test` and `npm run typecheck` after meaningful code changes. Run `npm run build` for UI, route, configuration, dependency, or Next.js changes.
- Read [AGENTS.md](AGENTS.md) before contributing with a coding agent.
