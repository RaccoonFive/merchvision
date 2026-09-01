# Merchvision Roadmap

Last updated: 2026-09-01

## Product Direction

> Help active OSRS merchants find conservative, evidence-backed Grand Exchange opportunities quickly, then give them enough market history to judge each candidate for themselves.

- Lead with ranked opportunities and use item-level analysis as the drill-down experience.
- Optimize the default ranking for repeatable market quality, not maximum paper profit.
- Use two fixed, evidence-backed views: Reliable by default and an explicitly experimental High Upside view. Do not add user-defined score weights.
- Use only the OSRS Wiki Prices API for market data.
- Keep accounts limited to authentication, Favorites, and private manually entered investment lots.
- Recommend candidates and expose evidence; do not prescribe offer prices or predict price targets.
- Keep sales, realized-profit history, offer state, synchronized trades, bankroll, and execution data outside Merchvision.
- Optimize dense workflows for desktop while keeping every core action usable on narrow screens.

`docs/PRODUCT.md` remains the durable product contract. This file owns delivery order, active work, and completion status.

## Current Baseline

- Flip Finder defaults to a conservative Reliable score and lazy-loads an experimental High Upside ranking based on fresh paired quotes, five-minute margin persistence, robust capacity, and separately displayed confidence.
- A protected 15-minute calibration job can retain 90 days of bounded public-market observations and compare High Upside, Reliable, and legacy-current ranking cohorts without recording user activity.
- Flip enrichment is bounded to balanced shortlists and produces deterministic confidence, stability, spread-quality, and executability estimates.
- Item Lookup exposes current quote math, warnings, Favorites, and 1-day, 7-day, 3-month, and 1-year price history.
- Item Lookup includes Market Rhythm: a local-time heatmap of observed hourly after-tax spread quality and matched volume from the latest seven days, with explicit missing-data and non-forecast caveats.
- Investment Finder ranks liquid items with positive 24-hour and 7-day historical midpoint trends.
- Investment Tracker stores separate account-owned purchase lots and compares their cost with the latest net instant-sell value, with explicit stale and partial-data states.
- Username/password accounts (with email retained), user-owned Favorites, responsive navigation, light/dark themes, request caching, and request coalescing are implemented.
- The current validation baseline passes 121 tests, type checking, and a production build.

## Milestone 1 - Trustworthy Flip Rankings

Status: **Active**

### Outcome

An active merchant can scan a shortlist of credible opportunities, recognize the key evidence and risks quickly, and distinguish current observations from historical measures and uncertain execution estimates.

### Ranking Policy

- [x] Include stale and low-confidence candidates by default, with an explicit toggle to exclude weak data.
- [x] Tune the default ranking to balance seven-day repeatable after-tax GP-per-hour and buy-limit profit with matched liquidity, freshness, and sample quality over isolated paper-margin spikes.
- [x] Preserve the existing search, membership, price, profit, ROI, volume, confidence, stability, buy-limit-profit, freshness, and sorting controls.
- [x] Keep fixed Reliable and High Upside scoring policies; do not add risk presets or user-configurable score weights.
- [x] Preserve Reliable as the default and add a separately labeled, lazy-loaded High Upside view.
- [x] Use paired quote age and timestamp skew instead of treating the freshest side as the complete quote.
- [x] Bound five-minute High Upside enrichment and exclude stale, unsynchronized, sparse, one-sided, or unknown-limit candidates.
- [x] Add user-independent public-market proxy calibration with protected scheduling, model isolation, deterministic resolution, and 90-day retention.

### Explanation And UI

- [x] Return named quality and risk signals with every flip alongside the aggregate score.
- [x] Derive the aggregate score, available score audit detail, and ranking order from the same deterministic scoring path.
- [x] Keep the results table focused on decision-relevant quality and risk signals; place detailed score arithmetic after the primary market details in the selected-item panel.
- [x] Label current observations, historical measures, and estimates distinctly.
- [x] Clarify trailing traded volume, matched hourly volume, per-item net profit, buy-limit profit, and estimated units per hour.
- [x] Surface every material warning without silently hiding warnings after the first four.
- [ ] Keep loading, empty, stale, partial-history, and upstream-failure states clear on desktop and narrow screens.

### Tuning And Verification

- [x] Document the repeatability tuning: cap scored per-item profit at the seven-day median, make conservative GP/hour the largest driver, give buy-limit profit a modest direct weight, and penalize current-margin spikes so liquid steady markets outrank thin windfalls.
- [x] Add focused tests for warning thresholds and ranking effects.
- [x] Cover score-component arithmetic, explanation consistency, filters, and weak-data toggle behavior; confirm stale or low-confidence results are excluded only when requested.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build` after implementation.

### Completion Gate

- [ ] A user can recognize why a candidate is credible or risky from the table and detail panel without needing to understand point-by-point score arithmetic.
- [ ] Returned score components reproduce the displayed aggregate score for every candidate.
- [ ] No label implies that volume, fill speed, executable units, or profit is guaranteed.

## Milestone 2 - Live Item Research

Status: **Planned next**

### Outcome

Item Lookup becomes the canonical research view for validating a Flip Finder candidate using current quotes, historical spread behavior, liquidity, volatility, and data quality.

### Research Experience

- [ ] Link every Flip Finder and Investment Finder result clearly to its Item Lookup research view.
- [ ] Add historical after-tax spread, positive-spread ratio, matched volume, volatility, freshness, sample coverage, and estimated-executability analysis.
- [ ] Explain how each measure should influence a merchant's decision without suggesting exact buy or sell offers.
- [ ] Retain the existing 1-day, 7-day, 3-month, and 1-year history ranges.
- [ ] Keep current observations, historical calculations, and estimates visually distinct.
- [ ] Represent missing samples and unavailable calculations explicitly rather than substituting zeroes.

### Live Data Behavior

- [ ] Add controlled auto-refresh to Flip Finder and Item Lookup with a visible interval, last-updated time, pause control, and manual refresh action.
- [ ] Pause automatic requests when the page is not visible and prevent overlapping refreshes.
- [ ] Show compact fresh, stale, partial, and unavailable data-health states.
- [ ] Add bounded Wiki request timeouts and user-safe failure messages while preserving request coalescing and TTL caching.
- [ ] Keep request frequency respectful of the Wiki API and avoid unbounded per-item history enrichment.

### Verification

- [ ] Test historical-analysis formulas, missing samples, partial histories, unsupported values, and empty responses.
- [ ] Test refresh intervals, pause/resume behavior, overlapping-request prevention, and degraded-data states.
- [ ] Verify keyboard and narrow-screen usability for charts, refresh controls, and research metrics.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` after implementation.

## Milestone 3 - Risk-Aware Investment Finder

Status: **Planned after Milestone 2**

### Outcome

Investment Finder remains a secondary tool that produces an explainable shortlist of liquid items with sustained historical momentum and clearly reported uncertainty.

### Tasks

- [ ] Review the short- and medium-horizon trend, liquidity, volatility, consistency, and confidence formulas through hands-on ranking tests.
- [ ] Return named score drivers and penalties from the same deterministic path that produces the aggregate investment score.
- [ ] Hide candidates with insufficient or unreliable history by default and explain the exclusion policy.
- [ ] Distinguish observed volume and prices from historical trend measures; do not present momentum as a forecast.
- [ ] Show compact drivers in the table and a complete explanation in the selected-item panel.
- [ ] Link every candidate to the unified Item Lookup research view.
- [ ] Preserve deterministic filtering and sorting with no customizable score weights.
- [ ] Add focused formula, threshold, filtering, ranking, partial-history, and explanation-consistency tests.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` after implementation.

## Basic Reliability And Maintenance

These tasks support a small private deployment and do not require production-scale infrastructure.

- [ ] Document and verify a basic MySQL backup and restore procedure for accounts and Favorites.
- [ ] Keep application errors free of secrets, session details, database internals, and unnecessary upstream payloads.
- [ ] Review material dependency audit findings before dependency or deployment updates.
- [ ] Document the private deployment environment, migration command, restart procedure, and common recovery steps.
- [ ] Keep a lightweight health indication for database availability and Wiki data freshness.

Production-scale rate limiting, distributed caching, centralized observability, recovery drills, and multi-instance operations are out of scope unless deployment needs change.

## Later Product Bets

Promote a bet into a milestone only after the first three milestones are complete and hands-on use shows that it improves the core research workflow.

1. **Market overview:** market-wide movers, liquidity changes, and broad Grand Exchange conditions.
2. **Item comparison:** side-by-side profitability, spread quality, liquidity, volatility, confidence, and freshness for selected candidates.
3. **One-time portfolio suggestions:** deterministic allocations from an ephemeral budget without saving bankroll or recommendations, recording execution, or automatically creating tracker lots.

## Explicitly Not Planned

- Saved filter presets or other account personalization beyond Favorites and Investment Tracker lots.
- In-app, email, Discord, browser-push, or other opportunity alerts.
- Sale entry, trade journaling, or transaction-history reconstruction.
- Open-offer or realized-profit tracking.
- Saved bankroll or persistent capital tracking.
- RuneLite trade synchronization.
- Automatic trade execution.
- Predicted entry prices, exit prices, holding times, or guaranteed outcomes.
- High-alchemy, conversion, item-set, or other arbitrage tools.
- Unbounded full-market snapshots, user-linked recommendation outcomes, or calibration from private trades.
- User-configurable scoring weights or ranking profiles.

## Completed

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
- Record newly discovered work in the active milestone, next milestone, basic reliability, later bets, or explicitly-not-planned list.
- Do not silently expand accounts beyond Favorites and manual investment lots or add sales, realized-profit history, open offers, synchronized trades, bankroll, execution, or external-data tracking.
