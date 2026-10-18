# Merchvision Product Contract

This document defines the durable product intent. `TODO.md` owns sequencing and delivery status; this file explains what Merchvision should become and the boundaries it must preserve.

## Vision

Help OSRS players make better Grand Exchange decisions by turning noisy public market data into conservative, explainable, and quickly actionable opportunities.

Merchvision should answer three questions clearly:

1. Which markets are worth investigating now?
2. Why does one opportunity rank above another?
3. What uncertainty or market risk could make the apparent opportunity misleading?

## Development Focus

The current feature set is sufficient for this stage. Prioritize maintainable code, measured performance improvements, reliability, and visual polish across the existing tools. Improve the experience users already have before adding more flipping functionality. [Roadmap](../TODO.md) owns the active work and deferred ideas.

New features remain welcome when a concrete idea adds useful or enjoyable OSRS functionality with a modest maintenance cost. Favor tools beyond flipping, such as public game references or compact utilities that fit alongside the existing Bosses experience. These additions need a clear purpose and should preserve the focused research screens and existing privacy boundaries; they do not need to expand market rankings or trade tracking.

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
- **Fast to scan:** use a minimal, fullscreen homepage with a single app entrance; keep research views focused on ranked results.
- **Private by design:** keep manually entered investment lots private to the account; Bank Overview holds one explicitly imported inventory snapshot only in the browser. Avoid collecting sales, realized outcomes, synchronized trades, or account bankroll.

## Product Principles

1. **Trust before upside.** Reliable remains the default, while explicitly experimental upside research may accept more uncertainty without disguising it.
2. **Evidence before confidence.** Missing, stale, sparse, or inconsistent data must reduce confidence or produce a clear warning.
3. **Explain rankings.** A user should be able to understand why one candidate outranks another from the returned and displayed metrics.
4. **Separate estimates from facts.** Current quotes and public volumes are observations; fill speed, executable units, and projected profit are estimates.
5. **Keep user agency.** Merchvision suggests markets to investigate. It does not place trades or claim certainty.
6. **Respect the data source.** Bound enrichment work, cache responsibly, and use an identifiable User-Agent with contact information.
7. **Optimize the repeated workflow.** Dense, responsive, keyboard-friendly views are preferred over decorative or instructional UI that slows experienced users.
8. **Earn complexity.** Add features when they improve an existing decision or serve a clear OSRS use case. Consider interface clutter, data availability, and maintenance cost before expanding scope.

Application themes default to Midnight Slate when no valid saved preference exists; returning visitors retain their saved theme. Themes use coordinated emerald, blue, violet, gold, and coral accents to distinguish tools, research categories, and boss categories. Soft color washes and highlighted selections add depth without reducing table density. Financial gains, losses, and market warnings retain their semantic colors and text labels in every theme.

Research tables emphasize the key historical margin and profit estimates, with supporting figures visually quieter. Metric cards use neutral backgrounds by default; selected decision-driving values receive an accent and larger type. Unavailable estimates retain a neutral presentation.

## Core Experiences

### Homepage

On the first visit to `/` in a browser, provide a fullscreen OSRS-themed entry point with edge-to-edge game artwork, a short headline, and a centered golden frosted-glass “Open app” button leading to Flip Finder at `/flips`. Small decorative glass tiles containing OSRS item icons drift in a scattered arrangement, concentrated around the outer edges with a sparse center that leaves the headline and entrance clear. Thin the scatter on smaller viewports, hide the tiles on short screens, and keep them still when reduced motion is preferred. Remember that visit in a browser cookie for one year and send later visits to `/` directly to Flip Finder. Clearing the cookie or using another browser shows the introduction again; visiting a tool directly remains supported. Keep the landing page available at `/welcome` for every visitor, with the app’s Welcome link and brand logo leading there. This public entrance uses a fixed cinematic palette and sits outside the application shell. Shared navigation, item search, account controls, and saved themes are available after entering the app. Avoid simulated live market statistics. Individual tool views remain dense and utility-focused.

On opening the introduction, fade in the headline first, then fade in the app entrance after the headline is fully visible. Show both immediately when reduced motion is preferred.

Show a lightweight blurred preview of the scene from the first render, then fade in the responsive backdrop once it loads. Keep the preview if the image cannot load and skip the backdrop transition when reduced motion is preferred.

### Installed App

Supporting browsers can install Merchvision with its name and icon and launch it in a standalone window directly at Flip Finder (`/flips`). Installation provides a shortcut to the hosted application; live market data and account features continue to require an internet connection. Browser installation controls provide the entry point.

### Flip Finder

Provide two ranked, filterable views of short-term buy-low/sell-high opportunities:

- **Reliable** is the default. It caps scored per-item upside at the seven-day median after-tax margin, then combines conservative estimated profit per hour and buy-limit profit with paired-quote freshness, liquidity, historical spread quality, volatility, and confidence.
- **High Upside** is experimental. It considers only fresh, synchronized, sufficiently sampled, two-sided markets and ranks recent upper-range margins by risk-adjusted estimated GP per hour over a one-to-four-hour horizon. It must show confidence separately and must not imply that its capacity estimate is an observed fill rate.

Both views use fixed, explainable policies rather than user-configurable weights. Isolated current-margin spikes remain visible only when supported by the selected view's evidence policy.

### Investment Finder

Surface liquid items with sustained positive short- and medium-horizon midpoint trends. Clearly distinguish momentum analysis from guaranteed future appreciation and penalize volatility, inconsistency, and incomplete history.

### Investment Tracker

Let a signed-in user manually record separate item purchase lots with a quantity and per-unit GP cost. Compare each lot with the latest observed instant-sell price after prospective GE tax, and aggregate the available values into a clearly labeled unrealized-profit summary. Preserve unavailable and stale valuation states rather than implying that a quote is current or executable.

Investment Tracker is deliberately not a trade journal. Users can correct or remove lots, but Merchvision does not record sales, realized profit, offer state, transaction history, or proof that a purchase occurred.

### Bank Overview

Let a user paste or upload the Bank Memory plugin's tab-separated item ID, name, and quantity export. Remember only the latest validated snapshot in this browser, with an import date and explicit replacement and clearing controls. This inventory snapshot, including coins, is an explicit exception to the prohibition on saved bankroll; it adds no account persistence, transaction records, import history, synchronization, or Investment Tracker lots. Market requests contain item IDs only; imported names and quantities stay in the browser.

Show estimated instant-sell value before tax and separate estimated after-tax proceeds. Count coins at face value; keep untradeable, unmatched, unpriced, and stale holdings visible, with partial totals. Do not infer tradeable replacements for charged or untradeable versions.

Keep the overview header compact: put the import timestamp beside its actions, show partial/stale information within the summary cards and item rows, and omit routine warning banners. Show the progress bar only while analysis is incomplete. Import, storage, and failed-request feedback remain visible when action is needed.

Analyze sustained daily midpoint trends over 7, 30, and 90 days, including declining markets. Show fitted change, directional agreement, sample coverage, and estimated historical GP movement at the current quantity. Classify sufficiently sampled movement as Rising, Falling, Flat, or Mixed, without keep/sell recommendations. Sparse and stale histories remain unavailable. Historical fitted movement is neither purchase profit nor a forecast; midpoint research and instant-sell valuation use different price measures. Load supported items progressively through bounded requests, with progress, stop/resume, and failed-item retry.

### Item Lookup

Let a user find an item from a compact, keyboard-friendly search in the application header on every page, with matching item previews as they type. The research view lets them inspect the item's latest quote, after-tax margin, freshness, recent history, observed hourly market rhythm, and relevant warnings without needing to search the full rankings. Market Rhythm must distinguish its latest-seven-days observations from recurring behavior or a fill forecast.

### Favorites And Accounts

Let a signed-in user save a watchlist and revisit current public-market information. Favorites remain distinct from manually recorded Investment Tracker lots and must not imply that the user bought, sold, or owns an item.

### Boss Loot Reference

Provide a public, searchable grid of repeatable combat, Wilderness, Slayer, skilling, and minigame bosses, plus raids. Shared reward activities such as Barrows, the Gauntlet, and raids have one card per activity. Selecting a card opens a full drop-table dialog with quantities, source rates, reward conditions, and current observed instant-sell GP per unit before GE tax.

Keep conditional, multi-roll, mode-specific, and shared-table rates distinct. Shared-table rates describe rolls within that table, not unconditional per-kill chances. Loot comes from live Wiki pages with a visible fetch date and source links; missing or unsupported data must be marked partial. Unmatched items, items not sold on the GE, unavailable prices, and stale quotes are separate states. This reference does not estimate GP per kill or track loot, kills, or player activity.

### Prayer Potion Value

Provide a public comparison of Prayer potion (4) and Super restore (4) at a user-entered base Prayer level from 1 to 99. Show Prayer points per GP, GP per point, restoration per dose and full potion, and the better value using observed instant-buy quotes. Compare standard restoration without equipment bonuses, cap each dose at the user's base Prayer level, and assume enough missing Prayer to avoid wasting restoration. The comparison values Prayer only; super restores' stat restoration is an additional benefit outside the calculation.

Keep missing prices unavailable, mark quotes older than one hour or without a timestamp, and preserve previous prices with a warning after a refresh failure. Remember the last valid Prayer level in browser local storage and restore it on return, defaulting to 70 when no valid preference is available. This browser preference requires no account or database persistence.

### Deferred Portfolio Idea

Portfolio suggestions are an optional deferred idea, not a planned extension of the current feature set. If pursued, use a one-time budget to propose a diversified set of opportunities. The budget and recommendation must remain ephemeral: do not persist bankroll or allocations, record execution, or automatically create Investment Tracker lots.

## Non-Goals

Unless this contract is explicitly revised, Merchvision will not provide:

- Sale entry, trade journaling, or transaction-history reconstruction
- Open-offer or realized-profit tracking
- RuneLite trade synchronization
- Saved bankroll or persistent capital tracking beyond the single browser-local Bank Overview inventory snapshot
- Automatic trade execution
- Discord, email, browser-push, or other external alert delivery
- Claims that public market data can guarantee fills, price direction, or profit
- User-linked recommendation outcomes or calibration from private trades

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

Because Merchvision does not observe execution or record sales, success should be measured with privacy-preserving product and system signals rather than realized user profit:

- Users can reach a credible shortlist quickly.
- A high proportion of displayed candidates have sufficient data coverage and clearly reported confidence.
- Experimental ranking changes are evaluated against Reliable and legacy baselines using time-ordered public-market proxy outcomes before promotion.
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
