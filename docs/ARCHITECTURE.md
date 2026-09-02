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

The application is a single Next.js codebase. Market data comes from the public OSRS Wiki Real-Time Prices API. MySQL stores authentication records, favorites, private manually entered investment lots, and bounded user-independent flip observations used for model calibration. Full market snapshots, filters, budgets, sales, private trade outcomes, and realized-profit history are not persisted.

## Runtime Boundaries

### Pages And Components

- `app/**/page.tsx` defines App Router entry points.
- `components/AppShell.tsx` owns navigation, session-aware account controls, theme switching, sidebar state, and the global item quick-search placement. `components/HeaderItemSearch.tsx` loads the cached item metadata collection through `/api/items` and routes selections to Item Lookup.
- `components/FlipFinder.tsx`, `InvestmentFinder.tsx`, `ItemLookup.tsx`, and `FavoritesPage.tsx` own the main interactive experiences.
- Price-history charts share a dynamically imported Recharts renderer. Ranking pages defer that bundle until a detail panel opens, while Item Lookup defers it until usable chart data is available.
- Account, Favorites, and Investment Tracker provide route-level loading UI so their dynamic session checks do not leave navigation without immediate feedback.
- Client components request internal `/api/**` endpoints. They do not call the Wiki API or database directly.
- Theme and sidebar preferences are stored in browser `localStorage`; they are not account data.

### Route Handlers

- `app/api/**` validates HTTP inputs, coordinates domain helpers, and translates outcomes into JSON responses.
- Query-string parsing for market filters is centralized in `lib/query.ts`.
- Domain formulas should remain in `lib/**`, not be duplicated in handlers or components.
- Errors use `{ error: string }`. Collection success responses generally use `{ data, meta? }`; the item quote and favorite mutation endpoints use their documented specific shapes.

### Market Domain

- `lib/osrsWiki.ts` is the only direct Wiki Prices API client.
- `lib/scoring.ts` owns flip construction, seven-day market analysis, warnings, filtering, and sorting.
- `lib/upsideScoring.ts` owns the experimental five-minute High Upside gate, analysis, capacity estimate, confidence, filtering, and ranking.
- `lib/flipFinder.ts` coordinates the separate Reliable and High Upside enrichment paths.
- `lib/flipCalibration.ts` records bounded ranking cohorts, resolves public-market touch proxies, prunes retention data, and reports model comparisons.
- `lib/investments.ts` owns midpoint trend, volatility, consistency, confidence, filtering, and ranking for investments.
- `lib/investmentTracker.ts` owns purchase-lot validation, live net-liquidation valuation, partial portfolio summaries, and tracker enrichment.
- `lib/tax.ts` owns the GE tax rule.
- `lib/marketRhythm.ts` derives Item Lookup's latest-seven-days hourly observations, after-tax spread quality, matched volume, and volatility summary.
- `lib/quote.ts` owns current item quote calculations and quote-level warnings.
- `lib/types.ts` owns shared market and API-facing domain types.

### Authentication And Persistence

- Better Auth is configured in `lib/auth.ts` with the Prisma adapter, email/password account creation, and username/password login. Email is retained on the account record; normalized usernames are unique case-insensitively, the separate display username preserves a user's capitalization, and usernames are the primary sign-in credential. Existing accounts without a username retain an email sign-in fallback.
- Server page sessions and route-request sessions are resolved in `lib/session.ts`.
- `lib/prisma.ts` provides a development-safe Prisma client singleton.
- `prisma/schema.prisma` defines Better Auth records and the user-owned `Favorite` and `InvestmentLot` models.
- `FlipObservation` stores public, user-independent model features and four-hour proxy outcomes for 90 days. It has no user relation.
- Favorite uniqueness is enforced by the composite `(userId, itemId)` constraint. Deleting a user cascades to their sessions, accounts, and favorites.
- Investment lots intentionally allow repeated item IDs so separate purchases retain their own quantity and per-unit cost. Deleting a user cascades to their lots.

## Application Routes

| Route | Responsibility | Access |
| --- | --- | --- |
| `/` | Flip Finder | Public |
| `/investments` | Investment Finder | Public |
| `/investment-tracker` | Manually entered purchase lots and current unrealized net liquidation value | Authenticated; unauthenticated users are redirected |
| `/lookup` and `/lookup/[id]` | Item search and quote/history inspection | Public; favorite controls require a session |
| `/favorites` | Current quotes for saved items | Authenticated; unauthenticated users are redirected |
| `/account` | Sign-up, sign-in, session display, and sign-out | Public |

## API Routes

| Endpoint | Responsibility | Success shape | Access |
| --- | --- | --- | --- |
| `GET /api/flips?view=reliable\|upside` | Rank and filter the default Reliable or experimental High Upside candidates | `{ data, meta }` | Public |
| `GET /api/investments` | Rank and filter investment candidates | `{ data, meta }` | Public |
| `GET /api/investment-tracker` | Enrich the current user's purchase lots with current valuation | `{ data, meta }` | Authenticated |
| `POST /api/investment-tracker` | Create a separate purchase lot | `{ data }` | Authenticated |
| `PUT /api/investment-tracker/[lotId]` | Replace a lot's quantity and per-unit cost | `{ data }` | Authenticated owner |
| `DELETE /api/investment-tracker/[lotId]` | Permanently remove a lot | `{ deleted: true }` | Authenticated owner |
| `GET /api/items` | Return normalized item metadata | `{ data }` | Public |
| `GET /api/items/[id]/quote` | Return item metadata and current quote | `{ item, quote }` | Public |
| `GET /api/items/[id]/timeseries` | Return normalized timeseries points and, when requested, Market Rhythm analysis | `{ data, rhythm? }` | Public |
| `GET /api/prices/latest` | Return normalized latest prices | `{ data }` | Public |
| `GET /api/favorites` | Return the current user's enriched favorites | `{ data }` | Authenticated |
| `GET /api/favorites/[itemId]` | Check favorite state | `{ favorited }` | Authenticated |
| `PUT /api/favorites/[itemId]` | Save an item | `{ favorited: true }` | Authenticated |
| `DELETE /api/favorites/[itemId]` | Remove an item | `{ favorited: false }` | Authenticated |
| `/api/auth/[...all]` | Better Auth handler | Better Auth contract | Depends on operation |
| `GET /api/internal/flip-calibration` | Return bounded calibration reports and monotonic weight analysis | `{ data }` | `CRON_SECRET` bearer token |
| `POST /api/internal/flip-calibration` | Collect, resolve, and prune calibration observations | `{ data }` | `CRON_SECRET` bearer token |

## Market Data Integration And Caching

`lib/osrsWiki.ts` normalizes four upstream resources:

- Item mapping
- Latest high/low prices and timestamps
- Per-item timeseries at supported timesteps
- 24-hour market summaries

Every upstream request includes `Merchvision/0.1` and `USER_AGENT_CONTACT` in the User-Agent. Requests fail early when the contact value is missing.

Item Lookup requests the existing one-hour timeseries with `includeRhythm=true` to receive both its default seven-day chart and a deterministic Market Rhythm summary from one response. Since the upstream hourly series covers only the latest seven days, the UI presents cells as local-time observations, never as a recurring seasonal model, fill estimate, or profit forecast.

The Wiki client uses a process-local in-memory cache and a `pending` map that coalesces concurrent requests for the same key. Default TTLs are:

| Data | Environment override | Default |
| --- | --- | --- |
| Latest prices | `OSRS_LATEST_CACHE_SECONDS` | 60 seconds |
| Item mapping | `OSRS_MAPPING_CACHE_SECONDS` | 86,400 seconds |
| Timeseries and 24-hour summaries | `OSRS_TIMESERIES_CACHE_SECONDS` | 300 seconds |

Normalized item metadata is cached rather than rebuilt from the raw mapping on every request. Flip and investment candidate analysis is also memoized against the exact cached market snapshot, so changing filters reuses the already-enriched candidate universe. The browser shares one item-catalog request across the header search and page-level item selectors, and `/api/items` permits browser and shared-cache reuse because the response contains only public mapping data.

This cache is intentionally simple, but it has operational consequences:

- It is empty after a process restart.
- It is not shared across application instances.
- It does not provide durable stale-while-revalidate behavior.
- Upstream failures are handled per route; timeseries enrichment failures can be skipped or represented as missing analysis depending on the flow.

Any move to multiple production instances should explicitly revisit shared caching, request limits, retries, timeouts, and data-health reporting.

## Flip Finder Data Flow

The browser loads only the selected view. Reliable is the initial request; High Upside enrichment begins only after the user selects its tab.

### Reliable

1. Parse and normalize filters from the request URL.
2. Load item mapping and latest prices concurrently.
3. Load the cached 24-hour market summary when available and build profitable preliminary candidates using the latest low as buy price and latest high as sell price.
4. Create a shortlist of at most 100 candidates: 50 places by matched 24-hour volume, 25 by current net profit, and 25 by current ROI, then fill deduplication gaps by liquidity. If the summary is unavailable, use an even profit/ROI shortlist.
5. Fetch one-hour timeseries for the bounded shortlist. A failed item history becomes an empty series rather than failing the entire ranking.
6. Calculate trailing 12-hour traded volume and seven-day market analysis, then rebuild candidates with repeatability metrics and the final score.
7. Apply user filters, sort, and return at most 250 candidates. Profitable candidates without usable history remain visible but receive no history-supported score upside.

Key invariants:

- `buyPrice = latest low`
- `sellPrice = latest high`
- `margin = sellPrice - buyPrice`
- `tax = min(floor(sellPrice * 0.02), 5,000,000)`
- `netProfit = margin - tax`
- Candidates require complete price/timestamp data and positive current net profit.
- Quotes older than one hour and candidates with low confidence are included by default, with filters available to exclude them.
- Freshness uses the older side of the high/low quote pair. Timestamp skew is returned and warned separately.

Market analysis uses the latest 168 hourly points. It derives the seven-day median after-tax margin, median absolute margin variability, positive-spread ratio, normalized midpoint volatility, median matched hourly volume, sample coverage, confidence, and a volatility penalty. Estimated executable units per hour are 1% of median matched hourly volume, capped by one quarter of a known four-hour buy limit.

The 0–100 score uses `min(current net profit, seven-day median net margin)` as repeatable per-item profit. Conservative estimated GP/hour multiplies that amount by estimated executable units, while conservative buy-limit profit multiplies it by the known four-hour buy limit. GP/hour remains the largest driver, and buy-limit profit receives a modest additional weight so higher-upside markets can compete with easier low-profit flips. Positive points also reward repeatable margin and ROI, matched liquidity, positive-spread consistency, stability, and confidence. Stale or unsynchronized quotes, a current margin far above its historical norm, and an unknown buy limit reduce trust. These are explicit estimates, not observed fills or guaranteed profit.

### High Upside

1. Build a bounded 75-item union: 25 by current net margin, 15 by ROI, 20 by a four-hour capacity proxy, and 15 by matched 24-hour volume; fill gaps by capacity.
2. Reject preliminary items with unknown limits, quote-pair age over 15 minutes, or high/low timestamps more than 10 minutes apart.
3. Fetch five-minute histories in sequential batches of at most 10 requests. A failed history excludes only that item.
4. Require at least 50% valid two-sided coverage in both four-hour and 24-hour windows plus positive recent matched volume.
5. Cap capturable net margin at the 24-hour 90th percentile. Estimate units per hour as 1% of lower-quartile rolling hourly matched volume, capped by one quarter of the buy limit.
6. Calculate opportunity confidence as the geometric mean of four-hour and 24-hour positive-spread ratios, daily coverage, paired-quote freshness, and midpoint stability.
7. Rank by capturable margin times estimated units times confidence, followed by deterministic quality tie-breakers.

High Upside exposes GP/hour and confidence separately. Its 1% market-share assumption is a capacity heuristic, not a fill forecast.

### Calibration

Every 15 minutes, an external scheduler may call the protected calibration endpoint. It records at most 50 High Upside, 25 Reliable, and 25 legacy-current observations per timestamp bucket. Four hours later, a candidate is marked completed only when a qualifying low-side trade is followed in a later five-minute bucket by a qualifying high-side trade. Same-bucket touches are ambiguous and receive zero proxy GP/hour.

Reports compare top-10 and top-25 completion, time-to-completion, and zero-inclusive proxy GP/hour by model. A time-ordered 70/30 analysis can recommend positive monotonic confidence weights, but it never changes the production model automatically. Resolved raw observations are removed after 90 days. See `docs/flip-calibration.md`.

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

## Investment Tracker Data Flow

1. Load the authenticated user's investment lots, item mapping, and latest prices concurrently.
2. Enrich every lot in memory from those shared snapshots; do not issue per-lot Wiki requests.
3. Use the latest low as the observed instant-sell price, subtract per-item GE tax, and multiply the net value by the recorded quantity.
4. Compare net liquidation value with `quantity × unitPricePaid` to calculate unrealized profit and ROI.
5. Preserve lots whose metadata or quote is unavailable and exclude them from valued totals while marking the aggregate summary partial.

Investment Tracker values are estimates based on public quotes, not confirmed fills or realized outcomes. Quotes over one hour old remain visible with a warning. Creating, editing, and deleting lots never creates sales or transaction history.

## Security And Privacy Boundaries

- `.env` is ignored and is the only intended local location for secrets.
- The application database connection must use a dedicated least-privilege MySQL user, not root. See `docs/mysql-setup.md`.
- Favorite reads and writes are scoped to the authenticated user's ID.
- Callback URLs are normalized by `lib/redirect.ts` to prevent unsafe external redirects.
- Beyond account data, Favorites, manual purchase lots, and bounded public calibration observations, the application does not persist user trades, sales, offers, realized profit, bankroll, portfolio suggestions, filters, or full market histories.
- Flip observations contain only public item-market features and public-market proxy outcomes; they never contain user IDs, account actions, or evidence that a user's order filled.
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
