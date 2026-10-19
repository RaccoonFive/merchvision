# Merchvision Roadmap

Last updated: 2026-10-18

## Product Direction

> Help active OSRS merchants find conservative, evidence-backed Grand Exchange opportunities quickly, then give them enough market history to judge each candidate for themselves.

- The current feature set is sufficient for this stage. Prioritize code quality, performance, reliability, and design over expanding flipping functionality.
- Keep new features optional. Favor useful or enjoyable OSRS tools beyond flipping when there is a concrete idea worth building; do not treat the idea backlog as a delivery commitment.
- Lead with ranked opportunities and use item-level analysis as the drill-down experience.
- Optimize the default ranking for repeatable market quality, not maximum paper profit.
- Use two fixed, evidence-backed views: Reliable by default and High Upside with separately displayed uncertainty. The High Upside model remains experimental; its tab no longer carries an Experimental badge. Do not add user-defined score weights.
- Use only the OSRS Wiki Prices API for market data.
- Keep accounts limited to authentication, Favorites, and private manually entered investment lots.
- Explicitly permit Bank Overview as one browser-local imported inventory snapshot, including coins; keep it separate from account persistence, manual purchase lots, trade history, and synchronization.
- Recommend candidates and expose evidence; do not prescribe offer prices or predict price targets.
- Keep sales, realized-profit history, offer state, synchronized trades, account bankroll, and execution data outside Merchvision.
- Optimize dense workflows for desktop while keeping every core action usable on narrow screens.

`docs/PRODUCT.md` remains the durable product contract. This file owns delivery order, active work, and completion status.

## Current Baseline

- Flip Finder defaults to a conservative Reliable score and lazy-loads an experimental High Upside ranking based on fresh paired quotes, five-minute margin persistence, robust capacity, and separately displayed confidence.
- Flip enrichment is bounded to balanced shortlists and produces deterministic confidence, stability, spread-quality, and executability estimates.
- Item Lookup exposes current quote math, warnings, Favorites, and 1-day, 7-day, 3-month, and 1-year price history.
- Item Lookup includes Market Rhythm: a local-time heatmap of observed hourly after-tax spread quality and matched volume from the latest seven days, with explicit missing-data and non-forecast caveats.
- Item Lookup separates current quote-pair observations, seven-day market-quality measures, and conservative executability estimates, with explicit partial and unavailable states.
- A compact global header search provides keyboard-friendly item lookup with item previews from every application page.
- Investment Finder ranks liquid items with positive 24-hour and 7-day historical midpoint trends.
- Investment Tracker stores separate account-owned purchase lots and compares their cost with the latest net instant-sell value, with explicit stale and partial-data states.
- Bank Overview remembers one Bank Memory inventory import in this browser, with estimated gross/net instant-sell value, coins at face value, signed daily midpoint trends over 7/30/90 days, and bounded progressive analysis with stop/resume and retry.
- Username/password accounts (with email retained), user-owned Favorites, responsive navigation, a five-theme picker, request caching, and request coalescing are implemented.
- The public Bosses dashboard covers 70 boss/reward activities with searchable square cards, live Wiki loot dialogs, conditional rates, and observed instant-sell prices.
- Prayer Potions compares Prayer potion (4) and Super restore (4) by standard Prayer restoration per GP at a chosen base level, with purchase quotes and explicit stale or missing-data states.
- Flip Finder puts estimated GP/hour and historical or capturable margin beside the item name. Shared metric cards use neutral surfaces, with selective emphasis on the main values.
- The validation baseline is `npm test`, `npm run typecheck`, and `npm run build`; browser checks are also needed for interaction and layout changes.

## Active Milestone - Code Quality, Performance, And Design

Status: **Active**

### Outcome

Make the existing tools easier to maintain, faster to use, and more visually consistent. This milestone improves the shipped experience without requiring new market features.

### Code Quality And Reliability

- [ ] Review large components and repeated request, state, and UI logic; make scoped refactors where they reduce maintenance cost.
- [ ] Remove confirmed unused code and simplify unnecessary abstractions without changing market policies or account boundaries.
- [ ] Add bounded Prices API timeouts while preserving TTL caching and request coalescing.
- [ ] Replace caught `Error.message` forwarding in items, latest prices, item quotes, investments, and favorite routes with user-safe failures; test that upstream and database details are not returned.
- [ ] Review cancellation, overlapping requests, and stale responses during navigation, filtering, and dialog changes.
- [x] Cancel superseded Finder list and detail-chart requests; protect results, errors, and loading state against late responses, with interaction coverage for filters, tabs, refreshes, closure, unmounting, and Strict Mode.
- [ ] Add focused regression coverage for concrete defects and fragile behavior found during review.

### Performance

- [ ] Measure route payloads, loading and navigation time, request counts, and rendering cost on representative desktop and mobile workflows before choosing optimizations.
- [ ] Review client/server boundaries, chart loading, image delivery, and repeated transfers; keep existing deferred loading and cache reuse effective.
- [ ] Profile table sorting, sticky headers, search, and detail panels with representative result sizes; optimize demonstrated bottlenecks.
- [ ] Verify cold and warm data paths, bounded enrichment, and Wiki request frequency after performance changes.

### Design And Usability

- [ ] Review typography, spacing, visual hierarchy, and shared controls across tools and all five themes.
- [ ] Refine table, filter, chart, and dialog layouts for narrow screens while preserving dense desktop workflows.
- [ ] Review keyboard navigation, focus visibility, contrast, and reduced-motion behavior.
- [ ] Make loading, empty, error, stale, partial, and unavailable states consistent and easy to recognize.

### Requested Feature - Bank Overview

- [x] Deliver the explicitly requested browser-local Bank Memory import, estimated gross/net valuation, signed 7/30/90-day trends, bounded progressive loading, and cancellation/retry controls; verify synthetic-data tests, desktop/mobile browser behavior, and the full required checks.

### Completion Gate

- [ ] Implement and verify the selected quality fixes; record deferred findings without expanding the feature scope.
- [ ] Record before/after evidence for performance changes and verify that upstream request load remains bounded.
- [ ] Verify changed interactions and layouts in a browser with mocked data on desktop and narrow screens, including degraded-data states.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` for meaningful code changes, with focused checks required by [Repository Guidance](AGENTS.md#verification).

## Deferred Market Work

The former Live Item Research milestone delivered the research experience and boss reference. Its unfinished auto-refresh work and the planned Investment Finder expansion are deferred, not completed. They do not block the current quality milestone.

- **Controlled auto-refresh:** visible interval and update time, pause/resume and manual refresh, visibility-aware requests, overlap prevention, and timer/degraded-data tests. Existing request reliability and data-health polish stay in the active milestone.
- **Investment ranking expansion:** formula review, named drivers and penalties, a clearer insufficient-history policy, table/detail explanations, and formula, threshold, filtering, ranking, and partial-history tests. Candidate links to Item Lookup are already implemented. Fix demonstrated correctness issues as maintenance; broader ranking changes remain optional.
- **Additional market tools:** market overview, side-by-side item comparison, and one-time portfolio suggestions. Portfolio budgets and allocations must remain ephemeral, with no execution tracking or automatic investment lots.

## Basic Reliability And Maintenance

These tasks support a small private deployment and do not require production-scale infrastructure.

- [ ] Document and verify a basic MySQL backup and restore procedure for accounts, Favorites, and investment lots.
- [ ] Review material dependency audit findings before dependency or deployment updates.
- [ ] Document the private deployment environment, migration command, restart procedure, and common recovery steps.
- [ ] Keep a lightweight health indication for database availability and Wiki data freshness.
- [ ] Recheck boss roster coverage and reward-section mappings when OSRS adds bosses or the Wiki changes loot layouts.

Production-scale rate limiting, distributed caching, centralized observability, recovery drills, and multi-instance operations are out of scope unless deployment needs change.

## Optional OSRS Feature Ideas

Remain open to small, useful or enjoyable OSRS features beyond flipping. These are exploration areas, not scheduled deliverables:

- Boss, activity, and reward-reference improvements.
- Item discovery and other public OSRS reference tools.
- Compact game utilities with a clear purpose and modest maintenance cost.

Choose concrete ideas individually based on interest, usability, data availability, and maintenance cost. Prefer additions that fit beside the current tools without crowding market research or expanding private trade tracking. New data sources or persistence need explicit design in the product and architecture docs.

## Explicitly Not Planned

- Saved filter presets or other account personalization beyond Favorites and Investment Tracker lots.
- In-app, email, Discord, browser-push, or other opportunity alerts.
- Sale entry, trade journaling, or transaction-history reconstruction.
- Open-offer or realized-profit tracking.
- Saved bankroll or persistent capital tracking beyond the single browser-local Bank Overview inventory snapshot.
- RuneLite trade synchronization.
- Automatic trade execution.
- Predicted entry prices, exit prices, holding times, or guaranteed outcomes.
- High-alchemy, conversion, item-set, or other arbitrage tools.
- Unbounded full-market snapshots, user-linked recommendation outcomes, or calibration from private trades.
- User-configurable scoring weights or ranking profiles.

## Completed

- **2026-10-18:** Removed the unused cron-driven flip calibration endpoint, reporting code, configuration, and runbook, with a migration to drop its public observation table. Verified fresh and upgrade migrations against disposable MySQL databases, preservation of account-owned records, endpoint 404 responses, full tests, type checking, and production build.
- **2026-10-18:** Protected Flip Finder and Investment Finder from stale list and chart responses, canceled requests on replacement and cleanup, and retained Investment Finder filters during refresh. Verified mocked React interactions, desktop/mobile browser workflows, full tests, type checking, and production build.
- **2026-10-18:** Simplified the Bank Overview header by removing routine warning banners, combining import metadata and actions, and hiding completed progress bars. Partial/stale information remains in cards and item rows; actionable errors stay visible.
- **2026-10-18:** Added Bank Overview with paste/file import, one browser-local inventory snapshot, safe gross/net valuation, coin handling, signed 7/30/90-day midpoint trends, progressive bounded analysis, filtering, cancellation, and retries. Verified mocked unit/API/interaction tests, desktop/mobile browser workflows across five themes, full tests, type checking, and production build.
- **2026-10-14:** Added locally served Prayer potion and Super restore inventory artwork to the comparison cards, with source attribution and desktop/mobile image-loading checks. Full tests, type checking, and production build passed.
- **2026-10-14:** Remembered the last valid Prayer level in browser local storage, with a default of 70 for absent, invalid, or inaccessible preferences. Verified persistence across reloads, invalid edits, blocked storage, full tests, type checking, and production build.
- **2026-10-14:** Added the requested Prayer Potions utility with level-dependent four-dose value, instant-buy quotes from the shared Wiki cache, safe failures, and stale/partial-data warnings. Verified formula boundaries and ranking, full tests, type checking, production build, and mocked browser interactions on desktop/mobile across five themes.
- **2026-10-10:** Refined Flip Finder column hierarchy and shared metric cards, with browser checks across five themes and desktop/mobile layouts. Removed the Experimental badge from the High Upside tab; the model's uncertainty and estimate labels remain documented.
- **2026-09-03:** Made Item Lookup the canonical Finder drill-down with direct result links, conservative quote-pair freshness, seven-day market-quality analysis, explicit evidence states, and separately labeled executability estimates.
- **2026-09-03:** Completed the trustworthy Flip Finder milestone with aggregate enrichment health, preserved results after refresh failures, distinct current/stale/partial/unavailable and chart states, explicit 12-hour traded-volume labeling, and a reproducible score total.
- **2026-09-02:** Reduced cold navigation payloads for chart-capable pages by roughly 100 KB each through deferred chart rendering, and added immediate route loading states for session-gated pages.
- **2026-09-01:** Reused enriched market analysis across filter requests for unchanged snapshots, deduplicated item-catalog and Item Lookup history transfers, cached normalized mapping data, lazy-loaded item icons, and removed repeated sticky-table layout measurement while scrolling.
- **2026-09-01:** Added a compact global item search to the application header with ranked item previews, keyboard navigation, and direct Item Lookup routing.
- **2026-09-01:** Added dual-track Flip Finder rankings with Reliable as the default, an experimental five-minute High Upside model, paired-quote health, bounded public-market calibration, and protected model comparison reports.
- **2026-08-25:** Added the private Investment Tracker with separate editable purchase lots, net instant-sell valuation after prospective GE tax, partial-data reporting, and account ownership enforcement.
- **2026-08-25:** Rebalanced Flip Finder scoring to modestly favor conservative buy-limit profit while retaining GP/hour as the largest driver and preserving market-quality penalties.
- **2026-08-25:** Made usernames the primary account credential for registration and sign-in while retaining email on each account.
- **2026-08-24:** Added Item Lookup Market Rhythm from bounded, cached seven-day hourly history; it exposes observed matched volume, after-tax spread quality, volatility, and data coverage without predicting fills or returns.
- **2026-08-12:** Added the durable product contract, implemented architecture reference, contributor guidance, and operational MySQL setup documentation.
- **2026-06-09:** Shipped the market-quality scoring foundation, balanced enrichment shortlists, confidence and stability signals, warnings, filters, sorting, and focused tests.
- **2026-06-04:** Added the public Investment Finder with liquidity shortlisting, 24-hour and 7-day midpoint trends, risk-adjusted ranking, filters, and detail charts.
- **2026-06-04:** Added email/password accounts, Better Auth sessions, MySQL/Prisma persistence, and protected Favorites.
- **2026-06-04:** Added item favoriting from Item Lookup and live favorite quote tracking.
- **2026-06-04:** Established the responsive application shell, light/dark themes, and closable detail panels.
- **Initial foundation:** Added Flip Finder, Item Lookup, current quote math, hourly charts, and Wiki API caching.

## Roadmap Hygiene

- Keep exactly one milestone marked `Status: **Active**`.
- Update `Last updated` whenever priorities, assumptions, or statuses change.
- Check off work only after implementation and required verification are complete.
- Move completed milestone detail into a concise dated entry instead of retaining large checked checklists.
- Record newly discovered work in the active milestone, basic reliability, deferred market work, optional OSRS ideas, or explicitly-not-planned list.
- Do not silently expand accounts beyond Favorites and manual investment lots or add sales, realized-profit history, open offers, synchronized trades, bankroll, execution, or external-data tracking.
