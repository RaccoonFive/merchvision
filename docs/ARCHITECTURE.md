# Merchvision Architecture

This document describes the implemented system and its durable boundaries. Keep it synchronized with structural changes; use `TODO.md` for planned work that is not yet implemented.

For task-specific implementation and test entry points, use [Task-to-Code Map](CODEMAP.md).

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
  `-- centralized Wiki client -----------------> OSRS Wiki Prices and MediaWiki APIs
```

The application is a single Next.js codebase. Market data comes from the public OSRS Wiki Real-Time Prices API; boss loot reference comes from the Wiki MediaWiki API. MySQL stores authentication records, favorites, private manually entered investment lots, and bounded user-independent flip observations used for model calibration. Full market snapshots, filters, budgets, sales, private trade outcomes, and realized-profit history are not persisted.

## Runtime Boundaries

### Hosting

- Standard Node.js hosting uses `npm start` (`next start`) after a production build.
- `npm run build:cpanel` sets `MERCHVISION_CPANEL_BUILD=1` to use one Next.js page worker with page-generation concurrency of one. It also reduces V8 and libuv thread pools for the build processes. These build limits are opt-in and do not configure the Passenger runtime.
- cPanel Passenger uses root-level `app.js`, which initializes Next.js in production mode from the project directory and forwards HTTP requests to its request handler. Passenger manages the public listener; the fallback port for direct invocation is 3100.
- Deployment configuration lives in the server's private `.env` or process environment. Start from `.env.example` for local development or `.env.cpanel.example` for cPanel and configure production values in a private `.env.cpanel`, then copy it to `.env` on the hosting server before Prisma commands, building, or startup. See [cPanel deployment](../README.md#deploy-on-cpanel).

### Pages And Components

- `app/**/page.tsx` defines App Router entry points.
- `app/manifest.ts` defines the installable web app identity, root scope, standalone display, and `/flips` launch URL. Next.js automatically serves it at `/manifest.webmanifest` and adds its metadata link, along with the home-screen icon in `app/apple-icon.png`. Static install icons live in `public/`; installation uses the hosted application with its existing request and cache behavior and adds no service worker or offline cache.
- `components/HomePage.tsx` provides the fullscreen landing page at `/welcome` and on the first root visit as a server component with local artwork and one app-entry link to `/flips`. The app’s Welcome link and brand logo always point to `/welcome`, which remains available regardless of the visit cookie. The landing page sits outside the application shell and does not request market rankings, item metadata, or session state.
- `components/HomeBackdrop.tsx` is a small client component inside the server-rendered landing page. It renders an inline blurred preview immediately, preloads precompressed responsive WebP artwork, and fades in the selected image after loading, including cached images that complete before hydration. Reduced motion skips the transition, failed requests retain the preview, and JavaScript-disabled browsers show the full image. Asset details live in `public/images/home/README.md`.
- `middleware.ts` applies only to `/`: the first actual GET displays the introduction and sets an HttpOnly, SameSite=Lax visit cookie for one year; later requests with that marker redirect to `/flips`. Prefetches and HEAD requests do not set the marker. The root page is dynamic so client navigation rechecks the cookie instead of reusing a cached first-visit page. This browser preference is independent of authentication and does not affect direct tool routes.
- `components/AppShell.tsx` owns navigation, session-aware account controls, theme switching, sidebar state, and the global item quick-search placement. `components/HeaderItemSearch.tsx` loads the cached item metadata collection through `/api/items` and routes selections to Item Lookup.
- `components/FlipFinder.tsx`, `InvestmentFinder.tsx`, `ItemLookup.tsx`, and `FavoritesPage.tsx` own the main interactive experiences. Finder item names link directly to the canonical Item Lookup route while their rows retain quick-detail selection. Flip Finder preserves the last successful results when a refresh fails and distinguishes current, stale, partially enriched, empty, and unavailable states.
- Both Finders abort superseded list requests and ignore canceled responses, errors, and loading-state updates, including response bodies that finish after cancellation. Query changes and unmounting cancel the active list request, including manual refreshes. Investment Finder retains its table and filter controls while refreshing. Detail charts cancel on selection changes, closure, or unmounting and clear previous chart data when a new selection loads.
- Price-history charts share a dynamically imported Recharts renderer. Ranking pages defer that bundle until a detail panel opens, while Item Lookup defers it until usable chart data is available.
- Account, Favorites, and Investment Tracker provide route-level loading UI so their dynamic session checks do not leave navigation without immediate feedback.
- Client components request internal `/api/**` endpoints. They do not call the Wiki API or database directly.
- Theme, sidebar, and Prayer-level preferences are stored in browser `localStorage`; they are not account data. `lib/clientPrayerLevel.ts` reads and writes the last valid level under `merchvision-prayer-level`, falling back to 70 when absent, invalid, or inaccessible. Invalid edits preserve the last valid preference, and storage failures do not interrupt the calculator.
- Bank Overview stores one versioned inventory snapshot under `merchvision-bank-v1`, including item IDs, imported names, quantities, and import time. Validation rejects corrupt or unsupported stored versions; storage failures leave the current visit usable with a warning. Snapshot replacement and clearing cancel superseded market/history requests. This browser-only inventory is separate from account-owned purchase lots.
- At widths of 1050px and below, navigation uses a compact rail and the header search occupies its own row. At 760px and below, navigation becomes a horizontally scrollable labeled strip above the tool. These viewport layouts preserve the saved desktop sidebar preference. On tablet and mobile, market tables use bounded scroll regions with native sticky headers and a pinned item column; desktop retains the mirrored sticky table header and existing layout.

### Route Handlers

- `app/api/**` validates HTTP inputs, coordinates domain helpers, and translates outcomes into JSON responses.
- Query-string parsing for market filters is centralized in `lib/query.ts`.
- Domain formulas should remain in `lib/**`, not be duplicated in handlers or components.
- Errors use `{ error: string }`. Collection success responses generally use `{ data, meta? }`; the item quote and favorite mutation endpoints use their documented specific shapes.

### Market Domain

- `lib/osrsWiki.ts` is the only direct Wiki Prices API client.
- `lib/bossCatalog.ts` defines the public boss roster, artwork, encounters, and allowlisted loot source sections. `lib/bossDrops.ts` uses Cheerio to extract typed drop rows and enrich them with shared mapping/latest-price snapshots; no upstream HTML is rendered.
- `lib/scoring.ts` owns flip construction, seven-day market analysis, warnings, filtering, and sorting.
- `lib/upsideScoring.ts` owns the experimental five-minute High Upside gate, analysis, capacity estimate, confidence, filtering, and ranking.
- `lib/flipFinder.ts` coordinates the separate Reliable and High Upside enrichment paths.
- `lib/flipCalibration.ts` records bounded ranking cohorts, resolves public-market touch proxies, prunes retention data, and reports model comparisons.
- `lib/investments.ts` owns midpoint trend, volatility, consistency, confidence, filtering, and ranking for investments.
- `lib/investmentTracker.ts` owns purchase-lot validation, live net-liquidation valuation, partial portfolio summaries, and tracker enrichment.
- `lib/bank.ts` owns Bank Memory parsing, snapshot validation, conservative valuation, safe totals, and signed daily midpoint regression. `lib/bankMarket.ts` coordinates public enrichment; `lib/clientBank.ts` owns browser persistence and `lib/useBankAnalysis.ts` owns cancelable sequential batches.
- `lib/tax.ts` owns the GE tax rule.
- `lib/marketRhythm.ts` derives Item Lookup's latest-seven-days hourly observations, after-tax spread quality, matched volume, and volatility summary.
- `lib/itemResearch.ts` adapts the Reliable seven-day market-analysis policy for Item Lookup, adds hourly-history freshness and volume availability, and preserves missing analysis as unavailable rather than zero.
- `lib/quote.ts` owns current item quote calculations and quote-level warnings.
- `lib/prayerPotions.ts` owns standard four-dose restoration and value comparisons for Prayer potion (2434) and Super restore (3024). `/api/prayer-potions` selects only their high-side purchase prices and trade timestamps from one cached latest-price snapshot; it does not request mapping or history. Restoration is `min(level, base + floor(level / 4))` per dose, with bases 7 and 8. Value uses four doses divided by purchase price, without seller tax. The client recalculates for levels 1–99, compares unrounded ratios, and flags quotes over one hour old or without timestamps. Manual refresh preserves previous successful data on failure. The last valid Prayer level is a browser-local preference; comparisons are not persisted.
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
| `/` | First-visit introduction; redirects returning browsers to Flip Finder | Public |
| `/welcome` | Landing page, always available through Welcome and the brand logo | Public |
| `/flips` | Flip Finder | Public |
| `/investments` | Investment Finder | Public |
| `/investment-tracker` | Manually entered purchase lots and current unrealized net liquidation value | Authenticated; unauthenticated users are redirected |
| `/bank` | Browser-local Bank Memory inventory, estimated valuation, and sustained historical trends | Public |
| `/lookup` and `/lookup/[id]` | Item search and quote/history inspection | Public; favorite controls require a session |
| `/bosses` | Searchable boss grid and live drop-table dialogs | Public |
| `/prayer-potions` | Compare four-dose potion cost per Prayer point at a given base level | Public |
| `/favorites` | Current quotes for saved items | Authenticated; unauthenticated users are redirected |
| `/account` | Sign-up, sign-in, session display, and sign-out | Public |

## API Routes

| Endpoint | Responsibility | Success shape | Access |
| --- | --- | --- | --- |
| `GET /api/flips?view=reliable\|upside` | Rank and filter the default Reliable or experimental High Upside candidates | `{ data, meta: { health, ... } }` | Public |
| `GET /api/investments` | Rank and filter investment candidates | `{ data, meta }` | Public |
| `POST /api/bank/market` | Enrich 1–2,000 distinct item IDs with metadata, latest quotes, and 24-hour matched volume | `{ data, meta: { generatedAt, pricesAvailable, liquidityAvailable } }` | Public |
| `POST /api/bank/trends` | Analyze daily history for 1–20 distinct item IDs over 7, 30, and 90 days | `{ data, meta: { generatedAt } }` | Public |
| `GET /api/investment-tracker` | Enrich the current user's purchase lots with current valuation | `{ data, meta }` | Authenticated |
| `POST /api/investment-tracker` | Create a separate purchase lot | `{ data }` | Authenticated |
| `PUT /api/investment-tracker/[lotId]` | Replace a lot's quantity and per-unit cost | `{ data }` | Authenticated owner |
| `DELETE /api/investment-tracker/[lotId]` | Permanently remove a lot | `{ deleted: true }` | Authenticated owner |
| `GET /api/items` | Return normalized item metadata | `{ data }` | Public |
| `GET /api/items/[id]/quote` | Return item metadata and current quote | `{ item, quote }` | Public |
| `GET /api/items/[id]/timeseries` | Return normalized timeseries points and, when requested, Market Rhythm and canonical Item Lookup research analysis | `{ data, rhythm?, research? }` | Public |
| `GET /api/prices/latest` | Return normalized latest prices | `{ data }` | Public |
| `GET /api/prayer-potions` | Return two observed instant-buy potion prices and trade timestamps | `{ data, meta: { generatedAt } }` | Public |
| `GET /api/bosses/[slug]/drops` | Return typed loot, observed instant-sell prices, source revisions, fetch time, and partial-data flags | `{ data, meta }` | Public |
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

Prices API requests currently have no explicit fetch timeout. The separate MediaWiki loot path has the timeout described below; bounded Prices API timeouts remain active roadmap work.

Item Lookup requests the existing one-hour timeseries with `includeRhythm=true&includeResearch=true` to receive its default seven-day chart, deterministic Market Rhythm summary, and canonical research measures from one response. Item metadata is loaded through the cached mapping only when research is requested so the executability heuristic can respect a known buy limit. Since the upstream hourly series covers only the latest seven days, the UI presents cells as local-time observations, never as a recurring seasonal model, fill estimate, or profit forecast.

Item Lookup reuses the Reliable ranking's seven-day formulas for median after-tax spread, spread variability, positive-spread ratio, midpoint volatility, median matched hourly volume, sample coverage, confidence, and estimated executable units. It separately reports the age of the latest complete hourly sample and whether paired volume samples exist. Current quote-pair age uses the older high/low side and quote skew shows whether the two observations were synchronized. The UI separates current observations, historical calculations, and capacity estimates, and does not substitute zero for missing price or volume evidence.

The Wiki client uses a process-local in-memory cache and a `pending` map that coalesces concurrent requests for the same key. Default TTLs are:

| Data | Environment override | Default |
| --- | --- | --- |
| Latest prices | `OSRS_LATEST_CACHE_SECONDS` | 60 seconds |
| Item mapping | `OSRS_MAPPING_CACHE_SECONDS` | 86,400 seconds |
| Timeseries and 24-hour summaries | `OSRS_TIMESERIES_CACHE_SECONDS` | 300 seconds |

Normalized item metadata is cached rather than rebuilt from the raw mapping on every request. Flip and investment candidate analysis is also memoized against the exact cached market snapshot, so changing filters reuses the already-enriched candidate universe. Flip ranking responses include aggregate data-health metadata for 24-hour-summary availability and bounded history-request success or failure counts; they do not expose upstream payloads or per-item failure details. The browser shares one item-catalog request across the header search and page-level item selectors, and `/api/items` permits browser and shared-cache reuse because the response contains only public mapping data.

This cache is intentionally simple, but it has operational consequences:

- It is empty after a process restart.
- It is not shared across application instances.
- It does not provide durable stale-while-revalidate behavior.
- Upstream failures are handled per route. Flip Finder exposes partial enrichment without failing usable results, returns a fixed safe message for complete route failures, and retains the last successful client snapshot during refreshes. Some older market and favorite handlers still forward caught `Error.message`; normalizing those errors remains reliability work in `TODO.md`.

Any move to multiple production instances should explicitly revisit shared caching, request limits, retries, timeouts, and data-health reporting.

### Boss Loot Data Flow

The boss grid uses a local roster verified against the Wiki Boss list on 2026-10-04. Opening a dialog requests its allowlisted source pages through the MediaWiki parsing API in `lib/osrsWiki.ts`. Named chest and reward pages represent shared activities; configured heading IDs preserve distinct loot modes. Cheerio extracts only drop-table columns, safe Wiki URLs, source prose, and referenced footnotes. Unsupported tables or missing supporting sources produce a partial result; a completely unavailable table returns a safe 503 error.

Successful normalized loot sources are cached for 24 hours and concurrent requests are coalesced. All boss-page requests share a two-request concurrency limit and a 10-second fetch timeout. Referenced shared tables are expanded from a fixed map, bounded to seven supporting sources, with conditional-rate labels. Failed sources are retried rather than cached for a day. Existing Prices API caching is unchanged.

Each response uses one item-mapping snapshot and one latest-price snapshot; there are no per-drop quote or history requests. Explicit item IDs take precedence over unique exact normalized names. Ambiguous or unmatched names never receive guessed prices. The latest low is shown per unit before tax, preserving its timestamp; quotes over one hour old are marked stale. Market failures leave usable loot visible, while confirmed items not sold on the GE remain distinct from unmatched items.

The browser coalesces requests and retains completed responses in memory for 60 seconds. Manual refresh bypasses that browser cache while respecting server TTLs. Dialog cleanup prevents responses for a previous selection from updating a new dialog. The feature adds no authentication or persistence. Wiki-derived HTML fixtures include source revision links and CC BY-NC-SA 3.0 attribution; tests do not depend on live requests.

## Bank Overview Data Flow

1. Parse the Bank Memory TSV entirely in the browser. Accept its three-column header, BOM, blank lines, CRLF/LF, duplicate IDs, and zero-quantity placeholders. Imports are bounded to 2 MiB and 2,000 nonblank item rows; IDs and combined quantities are integers from 1 to 2,147,483,647. Malformed rows reject the replacement with their original line number.
2. Send only distinct item IDs as `{ itemIds: number[] }`. The market endpoint uses cached item, latest-price, and 24-hour snapshots. Mapping failure is a safe 503; quote or liquidity failure returns explicit partial metadata. Missing volume remains null, not zero. The bank adds no database records.
3. The browser values each supported holding at the latest low quote, subtracting per-unit tax separately for estimated net proceeds. Coins (995) are worth one GP each with no tax or trend. No GE mapping means no inferred tradeable replacement. Unsafe individual values are unavailable; unsafe aggregate totals are unavailable. Quotes older than one hour or without usable timestamps are flagged and retained in estimates.
4. Analyze every mapped non-coin holding in descending holding-value order through sequential batches of at most 20 IDs. Server history work shares four slots across bank callers in a process; canceled callers do not start more queued upstream work. Each item uses one cached `24h` series for all periods. Per-item failures remain retryable; unmapped IDs are unsupported. Stop/resume retains completed items. Refresh retains previous results on complete market-request failure; successful refresh restarts history analysis. Cache TTLs and upstream coalescing are unchanged.
5. Filter valid positive two-sided prices into one midpoint per UTC day. For each trailing period, require at least 70% daily coverage, a sample span of at least 80% of the period, and a latest valid observation no older than 48 hours. Fit `log(midpoint)` against elapsed days. With slope `s`, intercept `a` at the period start, and length `d`, fitted change is `expm1(s*d)` and per-unit fitted GP movement is `exp(a)*expm1(s*d)`. Multiply the latter by the browser-held quantity with a safe-arithmetic guard. This is a historical fitted measure, not purchase profit or a forecast.
6. Directional agreement is the proportion of consecutive available sample moves matching the slope's sign; unchanged moves do not support a nonzero slope. Absolute fitted change within 1% is Flat; larger changes need at least 60% agreement for Rising/Falling, otherwise Mixed. Insufficient and stale results have null changes and direction. UI filters and GP movement default to seven days; sorting keeps unavailable values last. Coverage, sample counts, quote warnings, and partial totals remain visible.

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

- `.env`, `.env.local`, and the private deployment file `.env.cpanel` are ignored. Committed environment templates contain placeholders rather than secrets.
- The application database connection must use a dedicated least-privilege MySQL user, not root. See `docs/mysql-setup.md`.
- Favorite reads and writes are scoped to the authenticated user's ID.
- Callback URLs are normalized by `lib/redirect.ts` to prevent unsafe external redirects.
- Beyond account data, Favorites, manual purchase lots, bounded public calibration observations, and the explicitly imported browser-local Bank Overview snapshot, the application does not persist user trades, sales, offers, realized profit, account bankroll, portfolio suggestions, filters, or full market histories. Bank quantities and imported names never enter market API requests or the database.
- Flip observations contain only public item-market features and public-market proxy outcomes; they never contain user IDs, account actions, or evidence that a user's order filled.
- API errors should remain useful without exposing credentials, session tokens, database internals, or unnecessary upstream payloads.

## Testing Strategy

- Tests live in `tests/`, mirroring the source tree and importing application code through the `@/` alias.
- `tests/lib/*.test.ts` covers deterministic formulas, normalization, filtering, and helper behavior.
- `tests/app/api/**/*.test.ts` tests route contracts with mocked dependencies.
- `tests/app/**/page.test.ts` covers server-page authentication and routing behavior.
- `tests/components/*.test.ts` covers component helpers and static markup; `FinderRequests.test.ts` and `BankOverviewPage.test.ts` opt into jsdom and use React Testing Library to cover request ordering, progressive loading, imports, storage, and lifecycle cleanup. `tests/middleware.test.ts` covers homepage redirects.
- Shared HTML fixtures and their source/licensing notes live in `tests/fixtures/`.
- Tests use mocked market data and must not rely on the live Wiki API.
- `npm test`, `npm run typecheck`, and `npm run build` form the current validation baseline.

The current suite does not provide a browser-level end-to-end test or production observability. Those are roadmap-quality improvements rather than existing architecture.

## Change Rules

- New external market endpoints belong behind `lib/osrsWiki.ts` normalization.
- New scoring inputs must be represented in shared types, deterministic domain logic, user-facing explanations where relevant, and focused tests.
- New user-owned data must have authentication, ownership enforcement, database constraints, migration coverage, and cross-user tests.
- Schema changes require a new migration; do not edit migrations that may already be applied.
- Structural changes must update this document in the same change.
