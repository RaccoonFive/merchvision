# Merchvision Roadmap

Last updated: 2026-08-12

## Goal

> Maximize expected OSRS merching profit using explainable, market-data-driven recommendations without tracking the user's actual trades.

## Product Principles

- Optimize recommendations for conservative, market-quality scoring rather than impressive-looking margins.
- Explain every recommendation, assumption, uncertainty, and important risk.
- Use public OSRS Wiki/RuneLite market data as the source of market truth.
- Treat fill rates and projected profit as estimates, never guarantees.
- Keep Flip Finder rankings independent of the user's bankroll.
- Do not build trade journaling, actual-position tracking, or RuneLite trade synchronization.
- Do not save bankroll. Portfolio budgets are temporary inputs used only for one recommendation run.

## Current State

- Flip Finder ranks profitable items using current net profit, ROI, recent volume, freshness, and buy limits.
- Investment Finder ranks the top 250 liquid items with positive 24-hour and 7-day midpoint-price trends using a risk-adjusted momentum score.
- Item Lookup shows current quote metrics, warnings, recent hourly prices, and favorite controls.
- Signed-in users can save favorites and view their live quotes on a protected Favorites page.
- Email/password accounts, sessions, MySQL persistence, Prisma migrations, light/dark themes, and responsive layouts are implemented.
- Flip Finder now analyzes up to 100 balanced shortlisted candidates for spread stability, volatility, confidence, matched volume, and estimated executability.
- The flips API bounds hourly timeseries enrichment to a balanced shortlist that retains candidates across net profit, ROI, and volume/score signals.

## Current Focus: Milestone 1 - Explainable Market-Quality Scoring

Status: **Active**

### Outcome

Replace the basic score with an explainable market-quality model that rewards strong margins, liquidity, confidence, and stability while penalizing unstable, stale, or poorly sampled markets.

### Market Analysis

- [x] Define a `MarketAnalysis` type with:
  - Historical net-margin median.
  - Historical net-margin variability.
  - Positive-spread ratio.
  - Midpoint-price volatility.
  - Median matched hourly volume.
  - Sample count and sample coverage.
  - Estimated executable units/hour.
  - Raw expected profit estimate.
  - Confidence score.
  - Volatility/stability penalty.
- [x] Analyze a recent rolling hourly window from the existing timeseries endpoint.
- [x] Treat matched hourly volume as `min(highPriceVolume, lowPriceVolume)` for each sample.
- [x] Estimate executable units/hour as approximately 1% of median matched hourly volume.
- [x] Cap executable units/hour by the item's hourly buy-limit allowance when the buy limit is known.
- [x] Calculate historical margins after GE tax, using only samples with both valid high and low prices.
- [x] Make all formulas deterministic, documented, and resilient to missing or partial samples.

### Candidate Selection and Ranking

- [x] Replace the net-profit-only preliminary shortlist with a balanced shortlist that retains:
  - High net-profit candidates.
  - High-ROI candidates.
  - High-liquidity candidates.
- [x] Avoid unnecessary Wiki API load and remain within acceptable-use expectations.
- [x] Add confidence, stability, and total buy-limit profit to `FlipCandidate`.
- [x] Make market-quality score the default ranking.
- [x] Add filters and sorting for confidence, stability, and total buy-limit profit.
- [ ] Preserve existing filters and clearly label legacy metrics.

### Explainability UI

- [x] Show a compact score and relevant item market facts in the selected-item detail panel.
- [ ] Show clear warnings for:
  - Low sample coverage.
  - Low confidence.
  - Unstable or frequently negative spreads.
  - High midpoint volatility.
  - Stale quotes.
  - Thin matched volume.

### Tests and Acceptance Criteria

- [x] Add deterministic unit tests for every market-analysis formula.
- [ ] Cover missing prices, zero volume, unknown buy limits, negative spreads, stale data, and partial windows.
- [x] Add route tests confirming balanced shortlisting and the new filter/sort behavior.
- [ ] Verify ranking explanations match the numerical score components returned by the API.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.
- [ ] Milestone is complete only when a user can understand why one opportunity ranks above another.

## Milestone 2 - One-Time Budget Portfolio Suggestions

Status: **Planned after Milestone 1**

### Outcome

Generate a diversified basket of actionable flips from Scoring V2 using a temporary GP budget without saving bankroll or tracking execution.

### Tasks

- [ ] Add a `/portfolio` page and navigation entry.
- [ ] Accept a one-time GP budget that is never persisted.
- [ ] Recommend at most six simultaneous opportunities.
- [ ] Limit each item to at most 25% of the entered budget.
- [ ] Respect known buy limits and estimated executable units/hour.
- [ ] Exclude stale and low-confidence opportunities by default.
- [ ] Allocate capital by market-quality score per invested GP while avoiding excessive concentration.
- [ ] Show quantity, required capital, score, confidence, risks, and unused budget.
- [ ] Allow users to regenerate suggestions without saving the budget or recommendations.

### Acceptance Criteria

- [ ] Total suggested capital never exceeds the entered budget.
- [ ] No individual allocation exceeds 25% of the entered budget.
- [ ] Suggestions are deterministic for the same market snapshot and budget.
- [ ] Empty, very small, and extremely large budgets have clear behavior.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build`.

## Milestone 3 - In-App Opportunity Alerts

Status: **Planned after Milestone 2**

### Outcome

Notify signed-in users inside Merchvision when favorites or market-wide opportunities cross meaningful Scoring V2 thresholds.

### Tasks

- [ ] Add user-owned alert rules for favorite items and market-wide scoring thresholds.
- [ ] Support thresholds for score, confidence, stability, ROI, and freshness.
- [ ] Add a secret-protected cron endpoint that evaluates alert rules on a schedule.
- [ ] Store notifications with the triggering metrics and a human-readable explanation.
- [ ] Deduplicate repeated alerts with a configurable cooldown.
- [ ] Add an in-app notification inbox, unread badge, mark-read action, and delete action.
- [ ] Keep delivery in-app only.

### Acceptance Criteria

- [ ] Users never receive alerts created from another user's rules.
- [ ] Repeated unchanged opportunities do not create notification spam.
- [ ] Every notification explains why it triggered and links to the relevant item or market view.
- [ ] Cron requests without the configured secret are rejected.
- [ ] Run database migration validation, `npm run typecheck`, `npm test`, and `npm run build`.

## Operational Priorities

- [ ] Rotate the MySQL root password that was previously shared.
- [ ] Replace the application's MySQL root connection with a dedicated least-privilege user.
- [ ] Apply and verify production Prisma migrations.
- [ ] Define and test a MySQL backup and restore procedure.
- [ ] Add rate limiting for authentication and write endpoints.
- [ ] Add structured handling and visible data-health status for Wiki API failures or stale caches.
- [ ] Review dependency audit findings before each deployment.
- [ ] Document the production deployment and cron configuration.

## Additional Feature Backlog

- [ ] Saved Flip Finder filter presets.
- [ ] Market-regime indicators for improving, weakening, or unstable spreads.
- [ ] Manipulation/anomaly detection for suspicious low-volume price spikes.
- [ ] Favorite-item comparison view.
- [ ] Auto-refresh controls with visible data-health status.
- [ ] High-alchemy opportunity finder.
- [ ] Conversion and item-set arbitrage tools.
- [ ] Historical scoring snapshots to evaluate whether recommendation quality improves over time.

## Deferred / Not Planned

- Trade journal or manual transaction entry.
- Actual-position, open-offer, or realized-profit tracking.
- RuneLite trade synchronization.
- Saved bankroll or persistent capital tracking.
- Discord, email, browser push, or other external alert delivery.
- Claims that public market data can guarantee fills or profit.

## Completed

- **2026-06-04:** Added the public Investment Finder with liquidity shortlisting, confirmed 24-hour and 7-day midpoint trends, risk-adjusted ranking, filters, and explainable detail charts.
- **2026-06-04:** Added email/password accounts, Better Auth sessions, MySQL/Prisma persistence, and protected Favorites.
- **2026-06-04:** Added item favoriting from Item Lookup and live favorite quote tracking.
- **2026-06-04:** Established the permanent Soft visual design, responsive sidebar, and closable Flip Finder detail panel.
- **Initial foundation:** Added Flip Finder, basic opportunity scoring/filtering, Item Lookup, current quote math, hourly charts, and Wiki API caching.

## Session Handoff Rules

- Read this file before starting roadmap work.
- Keep exactly one milestone marked `Status: **Active**`.
- Update `Last updated` whenever priorities, assumptions, or statuses change.
- Check off tasks only after implementation and verification are complete.
- Add a dated entry to **Completed** when a milestone or meaningful feature ships.
- Record newly discovered work in the appropriate milestone, operational priorities, backlog, or deferred section.
- Do not silently change the no-trade-tracking or no-saved-bankroll constraints.
