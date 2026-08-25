# Merchvision Roadmap

Last updated: 2026-08-24

## Product Direction

> Help active OSRS merchants find conservative, evidence-backed Grand Exchange opportunities quickly, then give them enough market history to judge each candidate for themselves.

- Lead with ranked opportunities and use item-level analysis as the drill-down experience.
- Optimize the default ranking for repeatable market quality, not maximum paper profit.
- Use one fixed, quality-focused scoring model with filters and sorting rather than user-defined weights. Surface the evidence and risks a merchant needs, without making score arithmetic the primary workflow.
- Use only the OSRS Wiki Prices API for market data.
- Keep accounts limited to authentication and Favorites.
- Recommend candidates and expose evidence; do not prescribe offer prices or predict price targets.
- Keep all trade, position, bankroll, and execution data outside Merchvision.
- Optimize dense workflows for desktop while keeping every core action usable on narrow screens.

`docs/PRODUCT.md` remains the durable product contract. This file owns delivery order, active work, and completion status.

## Current Baseline

- Flip Finder ranks positive after-tax opportunities using current quotes, ROI, volume, freshness, buy limits, and 24-hour market-quality analysis.
- Flip enrichment is bounded to balanced shortlists and produces deterministic confidence, stability, spread-quality, and executability estimates.
- Item Lookup exposes current quote math, warnings, Favorites, and 1-day, 7-day, 3-month, and 1-year price history.
- Investment Finder ranks liquid items with positive 24-hour and 7-day historical midpoint trends.
- Accounts, user-owned Favorites, responsive navigation, light/dark themes, request caching, and request coalescing are implemented.
- The current validation baseline passes 48 tests, type checking, and a production build.

## Milestone 1 - Trustworthy Flip Rankings

Status: **Active**

### Outcome

An active merchant can scan a shortlist of credible opportunities, recognize the key evidence and risks quickly, and distinguish current observations from historical measures and uncertain execution estimates.

### Ranking Policy

- [x] Hide stale and low-confidence candidates by default, with an explicit opt-in that explains why they were excluded.
- [ ] Tune the default ranking through hands-on reviews to favor liquidity, stable after-tax spreads, freshness, and sample quality over impressive-looking paper margins.
- [ ] Preserve the existing search, membership, price, profit, ROI, volume, confidence, stability, buy-limit-profit, freshness, and sorting controls.
- [ ] Keep one fixed scoring model; do not add risk presets or user-configurable score weights.

### Explanation And UI

- [x] Return named quality and risk signals with every flip alongside the aggregate score.
- [x] Derive the aggregate score, available score audit detail, and ranking order from the same deterministic scoring path.
- [ ] Keep the results table focused on decision-relevant quality and risk signals; make detailed score arithmetic secondary and available only when a merchant wants to inspect it.
- [x] Label current observations, historical measures, and estimates distinctly.
- [x] Clarify trailing traded volume, matched hourly volume, per-item net profit, buy-limit profit, and estimated units per hour.
- [x] Surface every material warning without silently hiding warnings after the first four.
- [ ] Keep loading, empty, stale, partial-history, and upstream-failure states clear on desktop and narrow screens.

### Tuning And Verification

- [ ] Document the reason and expected ranking effect whenever hands-on review leads to a scoring threshold or weight change.
- [ ] Add focused tests for warning thresholds and ranking effects.
- [x] Cover score-component arithmetic, explanation consistency, filters, and weak-data opt-in behavior; confirm stale or low-confidence results never enter the default list accidentally.
- [ ] Run `npm test`, `npm run typecheck`, and `npm run build` after implementation.

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
3. **One-time portfolio suggestions:** deterministic allocations from an ephemeral budget without saving bankroll, recommendations, positions, or execution.

## Explicitly Not Planned

- Saved filter presets or other account personalization beyond Favorites.
- In-app, email, Discord, browser-push, or other opportunity alerts.
- Trade journaling or manual transaction entry.
- Actual-position, open-offer, or realized-profit tracking.
- Saved bankroll or persistent capital tracking.
- RuneLite trade synchronization.
- Automatic trade execution.
- Predicted entry prices, exit prices, holding times, or guaranteed outcomes.
- High-alchemy, conversion, item-set, or other arbitrage tools.
- Automated forward-performance tracking or stored historical ranking snapshots.
- User-configurable scoring weights or ranking profiles.

## Completed

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
- Do not silently expand accounts beyond Favorites or add trade, position, bankroll, execution, or external-data tracking.
