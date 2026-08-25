# Merchvision Architecture

This document describes the implemented system and its durable boundaries. Keep it synchronized with structural changes; use `TODO.md` for planned work that is not yet implemented.

## System Context

```text
Browser
  |
  | Next.js pages and internal JSON requests
  v
Next.js application
  |-- UI components and App Router pages
  |-- route handlers and query validation
  |-- deterministic market analysis and ranking
  |-- Better Auth sessions
  |-- Prisma persistence ----------------------> MySQL
  |
  `-- centralized Wiki client -----------------> OSRS Wiki Prices API
```

The application is a single Next.js codebase. Market data comes from the public OSRS Wiki Real-Time Prices API. MySQL stores authentication records and favorites only; market snapshots, rankings, filters, budgets, and positions are not persisted.

## Runtime Boundaries

### Pages And Components

- `app/**/page.tsx` defines App Router entry points.
- `components/AppShell.tsx` owns navigation, session-aware account controls, theme switching, and sidebar state.
- `components/FlipFinder.tsx`, `InvestmentFinder.tsx`, `ItemLookup.tsx`, and `FavoritesPage.tsx` own the main interactive experiences.
- Client components request internal `/api/**` endpoints. They do not call the Wiki API or database directly.
- Theme and sidebar preferences are stored in browser `localStorage`; they are not account data.

### Route Handlers

- `app/api/**` validates HTTP inputs, coordinates domain helpers, and translates outcomes into JSON responses.
- Query-string parsing for market filters is centralized in `lib/query.ts`.
- Domain formulas should remain in `lib/**`, not be duplicated in handlers or components.
- Errors use `{ error: string }`. Collection success responses generally use `{ data, meta? }`; the item quote and favorite mutation endpoints use their documented specific shapes.

### Market Domain

- `lib/osrsWiki.ts` is the only direct Wiki Prices API client.
- `lib/scoring.ts` owns flip construction, 24-hour market analysis, warnings, filtering, and sorting.
- `lib/investments.ts` owns midpoint trend, volatility, consistency, confidence, filtering, and ranking for investments.
- `lib/tax.ts` owns the GE tax rule.
- `lib/marketRhythm.ts` derives Item Lookup's latest-seven-days hourly observations, after-tax spread quality, matched volume, and volatility summary.
- `lib/quote.ts` owns current item quote calculations and quote-level warnings.
- `lib/types.ts` owns shared market and API-facing domain types.

### Authentication And Persistence

- Better Auth is configured in `lib/auth.ts` with the Prisma adapter and email/password login.
- Server page sessions and route-request sessions are resolved in `lib/session.ts`.
- `lib/prisma.ts` provides a development-safe Prisma client singleton.
- `prisma/schema.prisma` defines Better Auth records and the user-owned `Favorite` model.
- Favorite uniqueness is enforced by the composite `(userId, itemId)` constraint. Deleting a user cascades to their sessions, accounts, and favorites.

## Application Routes

| Route | Responsibility | Access |
| --- | --- | --- |
| `/` | Flip Finder | Public |
| `/investments` | Investment Finder | Public |
| `/lookup` and `/lookup/[id]` | Item search and quote/history inspection | Public; favorite controls require a session |
| `/favorites` | Current quotes for saved items | Authenticated; unauthenticated users are redirected |
| `/account` | Sign-up, sign-in, session display, and sign-out | Public |

## API Routes

| Endpoint | Responsibility | Success shape | Access |
| --- | --- | --- | --- |
| `GET /api/flips` | Rank and filter flip candidates | `{ data, meta }` | Public |
| `GET /api/investments` | Rank and filter investment candidates | `{ data, meta }` | Public |
| `GET /api/items` | Return normalized item metadata | `{ data }` | Public |
| `GET /api/items/[id]/quote` | Return item metadata and current quote | `{ item, quote }` | Public |
| `GET /api/items/[id]/timeseries` | Return normalized timeseries points and, when requested, Market Rhythm analysis | `{ data, rhythm? }` | Public |
| `GET /api/prices/latest` | Return normalized latest prices | `{ data }` | Public |
| `GET /api/favorites` | Return the current user's enriched favorites | `{ data }` | Authenticated |
| `GET /api/favorites/[itemId]` | Check favorite state | `{ favorited }` | Authenticated |
| `PUT /api/favorites/[itemId]` | Save an item | `{ favorited: true }` | Authenticated |
| `DELETE /api/favorites/[itemId]` | Remove an item | `{ favorited: false }` | Authenticated |
| `/api/auth/[...all]` | Better Auth handler | Better Auth contract | Depends on operation |

## Market Data Integration And Caching

`lib/osrsWiki.ts` normalizes four upstream resources:

- Item mapping
- Latest high/low prices and timestamps
- Per-item timeseries at supported timesteps
- 24-hour market summaries

Every upstream request includes `Merchvision/0.1` and `USER_AGENT_CONTACT` in the User-Agent. Requests fail early when the contact value is missing.

Item Lookup requests the existing one-hour timeseries with `includeRhythm=true` to receive a deterministic Market Rhythm summary alongside the normalized points. This is a single-item, cache-coalesced request. Since the upstream hourly series covers only the latest seven days, the UI presents cells as local-time observations, never as a recurring seasonal model, fill estimate, or profit forecast.

The Wiki client uses a process-local in-memory cache and a `pending` map that coalesces concurrent requests for the same key. Default TTLs are:

| Data | Environment override | Default |
| --- | --- | --- |
| Latest prices | `OSRS_LATEST_CACHE_SECONDS` | 60 seconds |
| Item mapping | `OSRS_MAPPING_CACHE_SECONDS` | 86,400 seconds |
| Timeseries and 24-hour summaries | `OSRS_TIMESERIES_CACHE_SECONDS` | 300 seconds |

This cache is intentionally simple, but it has operational consequences:

- It is empty after a process restart.
- It is not shared across application instances.
- It does not provide durable stale-while-revalidate behavior.
- Upstream failures are handled per route; timeseries enrichment failures can be skipped or represented as missing analysis depending on the flow.

Any move to multiple production instances should explicitly revisit shared caching, request limits, retries, timeouts, and data-health reporting.

## Flip Finder Data Flow

1. Parse and normalize filters from the request URL.
2. Load item mapping and latest prices concurrently.
3. Build profitable preliminary candidates using the latest low as buy price and latest high as sell price.
4. Create a balanced shortlist of at most 100 candidates drawn from high net profit, high ROI, and current volume when available (falling back to score before volume enrichment).
5. Fetch one-hour timeseries for the bounded shortlist. A failed item history becomes an empty series rather than failing the entire ranking.
6. Calculate recent volume and rebuild candidates.
7. Create a second balanced shortlist of at most 100 candidates for 24-hour market analysis.
8. Add confidence, stability, estimated executability, warnings, and market-quality scoring.
9. Apply user filters, sort, and return at most 250 candidates.

Key invariants:

- `buyPrice = latest low`
- `sellPrice = latest high`
- `margin = sellPrice - buyPrice`
- `tax = min(floor(sellPrice * 0.02), 5,000,000)`
- `netProfit = margin - tax`
- Candidates require complete price/timestamp data and positive current net profit.
- Quotes older than one hour and candidates with low confidence are included by default, with filters available to exclude them.

Market analysis uses the latest 24 hourly points. It derives the median after-tax historical margin, median absolute margin variability, positive-spread ratio, normalized midpoint volatility, median matched hourly volume, sample coverage, confidence, and a volatility penalty. Estimated executable units per hour are 1% of median matched hourly volume, capped by one quarter of a known four-hour buy limit. These are explicit estimates, not observed fills.

## Investment Finder Data Flow

1. Load item mapping and 24-hour summaries concurrently.
2. Rank summaries by matched volume, defined as the lower of high-side and low-side volume.
3. Keep the 250 most liquid known items.
4. Fetch hourly histories in batches of 10. Failed histories are skipped.
5. Build midpoint series from samples that contain positive high and low prices.
6. Require positive regression trends and at least 50% sample coverage in both the 24-hour and 7-day windows.
7. Score candidates using weighted trend, confidence, directional consistency, liquidity percentile, and a volatility penalty.
8. Apply filters and sorting, then return results with enrichment metadata.

Investment scores describe historical momentum and market quality. They are not price forecasts.

## Security And Privacy Boundaries

- `.env` is ignored and is the only intended local location for secrets.
- The application database connection must use a dedicated least-privilege MySQL user, not root. See `docs/mysql-setup.md`.
- Favorite reads and writes are scoped to the authenticated user's ID.
- Callback URLs are normalized by `lib/redirect.ts` to prevent unsafe external redirects.
- The application does not persist trades, positions, bankroll, market filters, portfolio suggestions, or market histories.
- API errors should remain useful without exposing credentials, session tokens, database internals, or unnecessary upstream payloads.

## Testing Strategy

- `lib/*.test.ts` covers deterministic formulas, normalization, filtering, and helper behavior.
- `app/api/**/*.test.ts` tests route contracts with mocked dependencies.
- Page tests cover server-page authentication and routing behavior.
- Tests use mocked market data and must not rely on the live Wiki API.
- `npm test`, `npm run typecheck`, and `npm run build` form the current validation baseline.

The current suite does not provide a browser-level end-to-end test or production observability. Those are roadmap-quality improvements rather than existing architecture.

## Change Rules

- New external market endpoints belong behind `lib/osrsWiki.ts` normalization.
- New scoring inputs must be represented in shared types, deterministic domain logic, user-facing explanations where relevant, and focused tests.
- New user-owned data must have authentication, ownership enforcement, database constraints, migration coverage, and cross-user tests.
- Schema changes require a new migration; do not edit migrations that may already be applied.
- Structural changes must update this document in the same change.
