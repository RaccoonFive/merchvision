# Task-to-Code Map

Use this index to build the smallest useful context for a task. Paths are navigation hints, not a substitute for reading code. [AGENTS.md](../AGENTS.md) owns working rules; [README.md](../README.md) owns setup and commands. Update the relevant entry when ownership or paths change; keep formulas and API contracts in [Architecture](ARCHITECTURE.md).

## Choose The Relevant Context

| Task | Read before changing it |
| --- | --- |
| Product behavior, labels, or scope | Relevant experience and non-goals in [Product Contract](PRODUCT.md) |
| Data flow, APIs, caching, scoring, auth, or persistence | Matching sections in [Architecture](ARCHITECTURE.md) |
| Next feature or delivery status | Active milestone in [Roadmap](../TODO.md); do not infer completion from this index |
| Calibration operation or model evaluation | [Flip Calibration](flip-calibration.md) |
| Local database setup | [MySQL Setup](mysql-setup.md) |

## Implementation And Tests

Paths below are relative to the repository root. Tests live under `tests/`, mirroring their source paths; shared fixtures live in `tests/fixtures/`. Include `lib/types.ts` when changing shared market fields and `lib/bossTypes.ts` for boss fields.

| Area | Start with | Closest tests |
| --- | --- | --- |
| Homepage and tool entry points | `middleware.ts` → `app/page.tsx` → `components/HomePage.tsx`, `app/welcome/page.tsx`, `app/flips/page.tsx`, `public/images/home/` | `tests/middleware.test.ts`, `tests/components/HomePage.test.ts`, `tests/components/AppShell.test.ts` |
| Reliable flips | `components/FlipFinder.tsx` → `app/api/flips/route.ts` → `lib/flipFinder.ts` → `lib/scoring.ts` | `tests/lib/scoring.test.ts`, `tests/app/api/flips/route.test.ts` |
| High Upside flips | Same UI/route/coordinator; `lib/upsideScoring.ts` owns the separate policy | `tests/lib/upsideScoring.test.ts`, `tests/app/api/flips/route.test.ts` |
| Filters and sorting | `lib/query.ts` parses URL filters; `lib/tableSort.ts` sorts UI rows; domain files own ranking sorts | `tests/lib/query.test.ts`, `tests/lib/tableSort.test.ts`, scoring/investment tests |
| Flip data-health display | `lib/flipHealth.ts`, `components/FlipFinder.tsx`; health counts come from `lib/flipFinder.ts` | `tests/lib/flipHealth.test.ts`, `tests/app/api/flips/route.test.ts` |
| Investment momentum | `components/InvestmentFinder.tsx` → `app/api/investments/route.ts` → `lib/investments.ts` | `tests/lib/investments.test.ts`, `tests/app/api/investments/route.test.ts` |
| Item quote and tax | `components/ItemLookup.tsx`, `app/api/items/[id]/quote/route.ts`, `lib/quote.ts`, `lib/tax.ts` | `tests/lib/quote.test.ts`, `tests/lib/tax.test.ts`, quote route test |
| Item history and research | `components/ItemLookup.tsx` → `app/api/items/[id]/timeseries/route.ts` → `lib/itemResearch.ts`, `lib/scoring.ts`, `lib/marketRhythm.ts` | `tests/lib/itemResearch.test.ts`, `tests/lib/marketRhythm.test.ts`, timeseries route test |
| Search and item metadata | `components/HeaderItemSearch.tsx`, `components/ItemLookupDialog.tsx`, `lib/itemSearch.ts`, `lib/clientItemCatalog.ts`, `app/api/items/route.ts` | `tests/lib/itemSearch.test.ts`, `tests/lib/clientItemCatalog.test.ts` |
| Boss roster and loot | `components/BossesPage.tsx` → `app/api/bosses/[slug]/drops/route.ts` → `lib/bossCatalog.ts`, `lib/bossDrops.ts`, `lib/osrsWiki.ts`; browser cache in `lib/clientBossDrops.ts` | `tests/lib/bossDrops.test.ts`, `tests/lib/bossWiki.test.ts`, `tests/lib/clientBossDrops.test.ts`, drops route test |
| Wiki integration and caching | `lib/osrsWiki.ts`; flip memo in `lib/flipFinder.ts`; investment memo in `app/api/investments/route.ts` | `tests/lib/osrsWiki.test.ts` (image normalization), `tests/lib/bossWiki.test.ts` (loot fetch/cache), finder route tests (market reuse) |
| Private purchase lots | `components/InvestmentTrackerPage.tsx` → `app/api/investment-tracker/route.ts` and `[lotId]/route.ts` → `lib/investmentTracker.ts` | `tests/lib/investmentTracker.test.ts`, both tracker route tests, `tests/components/InvestmentTrackerPage.test.ts`, tracker page test |
| Favorites | `components/FavoritesPage.tsx`, favorite controls in `components/ItemLookup.tsx`, `app/api/favorites/**`, `lib/favorites.ts` | `tests/lib/favorites.test.ts`, both favorite route tests, `tests/app/favorites/page.test.ts` |
| Accounts and ownership | `components/AccountPage.tsx`, `lib/auth.ts`, `lib/auth-client.ts`, `lib/session.ts`, `lib/redirect.ts`, `lib/prisma.ts`, `prisma/schema.prisma`, `app/api/auth/[...all]/route.ts` | `tests/lib/redirect.test.ts`, authenticated route and page tests |
| Public calibration | `app/api/internal/flip-calibration/route.ts`, `lib/flipCalibration.ts`, `lib/flipCalibrationAnalysis.ts`, `FlipObservation` in `prisma/schema.prisma` | Both calibration library tests and calibration route test |
| Navigation, themes, and layout | `components/AppShell.tsx`, `lib/theme.ts`, `app/layout.tsx`, `app/globals.css` | `tests/components/AppShell.test.ts`, `tests/lib/theme.test.ts`, `tests/app/layout.test.ts` |
| Tables and number entry | `components/StickyTable.tsx`, `components/SortableTableHeader.tsx`, `components/TableFilter.tsx`, `components/GroupedNumberInput.tsx` | `tests/components/StickyTable.test.ts`, `tests/components/GroupedNumberInput.test.ts` |
| Chart loading and compatibility | `components/LazyPriceHistoryChart.tsx`, `components/PriceHistoryChart.tsx`, their callers, `package.json` | `tests/lib/chartCompatibility.test.ts`; verify rendered UI separately |

## Boundaries That Are Easy To Miss

- Reliable and High Upside share coordination but have distinct analysis and ranking policies. `lib/itemResearch.ts` reuses Reliable's `analyzeMarket`; changing that function can also change Item Lookup.
- `lib/osrsWiki.ts` owns both Prices API and MediaWiki requests. MediaWiki loot fetches already have a timeout and concurrency cap; the Prices API fetch does not yet have an explicit timeout. See the active roadmap for remaining live-data work.
- Server TTLs, candidate-universe memoization, and browser caches are separate layers. A manual browser refresh does not force a server Wiki-cache miss. Flip memoization also includes a 60-second time bucket.
- A flip buys at the latest low and sells at the latest high. Tracker liquidation and boss instant-sell reference both use the latest low; the tracker subtracts prospective tax, while boss prices are displayed before tax.
- The default hourly Item Lookup response combines chart, research, and rhythm via `includeResearch=true&includeRhythm=true`. Other chart ranges still need the seven-day hourly evidence; avoid duplicating its default request.
- `generatedAt` describes response generation, not quote freshness. Use source timestamps and returned health/coverage fields to judge data age and completeness.
- Account-owned records are Favorites and manual `InvestmentLot`s. Public `FlipObservation`s have no user relation. Inspect ownership filters and schema constraints before changing persistence.
- Some older routes forward caught `Error.message`; user-safe errors are a requirement, not a guarantee of every current handler. See the reliability task in the roadmap.
- Current Vitest configuration runs `*.test.ts` in the Node environment. Component tests cover helpers or static markup; they do not establish browser interaction, responsive layout, or timer behavior.

## Targeted Discovery And Verification

Run from the repository root. Quote paths containing brackets in shell commands.

```bash
git status --short
rg --files app components lib tests prisma docs -g '!tests/fixtures/**' -g '!docs/assets/**'
rg -n 'analyzeMarket|buildFlipCandidates' lib/scoring.ts lib/itemResearch.ts app/api/flips
sed -n '1,180p' lib/itemResearch.ts
npm test -- tests/lib/scoring.test.ts 'tests/app/api/flips/route.test.ts'
```

Expand searches only when a dependency, caller, or contract is still unclear. Inspect fixture bodies only for parser work; their [source and licensing notes](../tests/fixtures/boss-drops/README.md) must be preserved. Avoid reading the full lockfile, generated Prisma client, build directories, or the entire stylesheet to locate a single symbol or rule.

Focused tests help iteration; the final checks remain those in [AGENTS.md](../AGENTS.md#verification). Documentation-only changes need path, link, command, and implementation-accuracy review. Do not add a persistent test count, copied roadmap checklist, or session history to this map.
