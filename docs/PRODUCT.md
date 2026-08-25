# Merchvision Product Contract

This document defines the durable product intent. `TODO.md` owns sequencing and delivery status; this file explains what Merchvision should become and the boundaries it must preserve.

## Vision

Help OSRS players make better Grand Exchange decisions by turning noisy public market data into conservative, explainable, and quickly actionable opportunities.

Merchvision should answer three questions clearly:

1. Which markets are worth investigating now?
2. Why does one opportunity rank above another?
3. What uncertainty or market risk could make the apparent opportunity misleading?

## Primary User

The primary user is a self-directed OSRS player who understands Grand Exchange buy and sell offers but does not want to inspect hundreds of item markets manually. They value a trustworthy shortlist, fast comparison, and transparent risk signals more than an opaque prediction.

Newer merchants are a secondary audience. The interface can explain important market concepts when they affect a decision, but it should remain efficient for repeat users.

## Core Job To Be Done

> When I want to merch on the Grand Exchange, help me narrow the market to a small set of credible opportunities and understand the tradeoffs quickly, so I can make my own offer decisions with less manual research.

## Value Proposition

Merchvision is differentiated by decision quality rather than raw feature count:

- **Conservative:** use defensible buy, sell, tax, volume, and freshness assumptions.
- **Explainable:** expose the metrics, warnings, assumptions, and uncertainty behind rankings.
- **Market-quality focused:** reward stable spreads, sufficient samples, liquidity, confidence, and likely executability.
- **Fast to scan:** put the tool and ranked results first; avoid a marketing-first workflow.
- **Private by design:** provide useful recommendations without collecting a user's trades, positions, or bankroll.

## Product Principles

1. **Trust before upside.** A smaller credible opportunity is more useful than a large but unstable paper margin.
2. **Evidence before confidence.** Missing, stale, sparse, or inconsistent data must reduce confidence or produce a clear warning.
3. **Explain rankings.** A user should be able to understand why one candidate outranks another from the returned and displayed metrics.
4. **Separate estimates from facts.** Current quotes and public volumes are observations; fill speed, executable units, and projected profit are estimates.
5. **Keep user agency.** Merchvision suggests markets to investigate. It does not place trades or claim certainty.
6. **Respect the data source.** Bound enrichment work, cache responsibly, and use an identifiable User-Agent with contact information.
7. **Optimize the repeated workflow.** Dense, responsive, keyboard-friendly views are preferred over decorative or instructional UI that slows experienced users.
8. **Earn complexity.** Add features when they improve the core decision, not merely because the data or technology makes them possible.

## Core Experiences

### Flip Finder

Provide a ranked, filterable view of short-term buy-low/sell-high opportunities. The default ranking serves lower-risk, repeatable flips: it caps scored per-item upside at the seven-day median after-tax margin, then combines conservative estimated profit per hour with freshness, liquidity, buy limits, historical spread quality, volatility, and confidence. Isolated current-margin spikes remain discoverable but must be visibly warned and strongly down-ranked.

### Investment Finder

Surface liquid items with sustained positive short- and medium-horizon midpoint trends. Clearly distinguish momentum analysis from guaranteed future appreciation and penalize volatility, inconsistency, and incomplete history.

### Item Lookup

Let a user inspect an individual item's latest quote, after-tax margin, freshness, recent history, observed hourly market rhythm, and relevant warnings without needing to search the full rankings. Market Rhythm must distinguish its latest-seven-days observations from recurring behavior or a fill forecast.

### Favorites And Accounts

Let a signed-in user save a watchlist and revisit current public-market information. Favorites are not positions and must not imply that the user bought, sold, or owns an item.

### Planned Portfolio Suggestions

Use a one-time budget to propose a diversified set of opportunities. The budget and recommendation must remain ephemeral: do not persist bankroll, allocations, execution, or positions.

## Non-Goals

Unless this contract is explicitly revised, Merchvision will not provide:

- Trade journaling or manual transaction entry
- Actual-position, open-offer, or realized-profit tracking
- RuneLite trade synchronization
- Saved bankroll or persistent capital tracking
- Automatic trade execution
- Discord, email, browser-push, or other external alert delivery
- Claims that public market data can guarantee fills, price direction, or profit

## Product Quality Bar

A feature is product-ready when:

- Its user decision and expected outcome are clear.
- Important assumptions and uncertainty are visible at the point of use.
- Empty, loading, partial-data, stale-data, and failure states are intentional.
- The behavior is deterministic for the same stored or mocked market snapshot unless randomness is an explicit requirement.
- Scoring and filters have boundary-case tests.
- The interface remains usable on narrow screens and by keyboard.
- It does not violate the privacy, data-source, or non-goal constraints above.

## Success Signals

Because Merchvision intentionally does not track actual trades, success should be measured with privacy-preserving product and system signals rather than realized user profit:

- Users can reach a credible shortlist quickly.
- A high proportion of displayed candidates have sufficient data coverage and clearly reported confidence.
- Users can explain, from the UI, why a higher-ranked opportunity outranks a lower-ranked one.
- Stale or degraded upstream data is visible rather than silently presented as current.
- Returning users can resume research efficiently through filters, lookup, and favorites.
- Wiki request volume, latency, and failure rates remain within an acceptable operating envelope.

Specific targets should be chosen only after deployment has enough baseline data to make them meaningful.

## Open Product Decisions

These questions should be answered by the product owner as evidence accumulates:

- Which confidence and freshness thresholds should hide a candidate by default versus show it with warnings?
- What is the most useful privacy-preserving measure of a successful recommendation session?
- How much scoring detail belongs in the table versus the detail panel?
- What deployment scale and operating budget should caching and persistence be designed for?

Record implementation work and priority decisions in `TODO.md`. Update this contract only when the product's durable intent or boundaries change.
