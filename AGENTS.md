# Repository Guidance

## Start Here

- Read `README.md` for setup, commands, and repository layout.
- Read `docs/PRODUCT.md` before changing product behavior or scope.
- Read `docs/ARCHITECTURE.md` before changing data flow, API boundaries, caching, authentication, persistence, or scoring.
- Read `TODO.md` before roadmap work. It is the source of truth for the active milestone and backlog.
- When documentation and code disagree, verify the implemented behavior, then update the stale documentation in the same change.

## Product Guardrails

- Merchvision helps Old School RuneScape players discover conservative, explainable Grand Exchange opportunities from public market data.
- Optimize for trustworthy market quality, not impressive-looking paper margins.
- Treat fill speed, executable volume, and projected profit as estimates, never guarantees.
- Keep Flip Finder rankings independent of a user's bankroll.
- Do not add trade journaling, actual-position tracking, RuneLite trade synchronization, or saved bankroll unless the product contract is explicitly changed.
- Keep the first screen focused on the tool; do not replace it with a marketing landing page.

## Repository Map

- `app/**`: Next.js App Router pages and route handlers.
- `components/**`: client-facing features and shared UI.
- `lib/osrsWiki.ts`: the only direct integration with the OSRS Wiki Prices API.
- `lib/scoring.ts`: flip candidate construction, market analysis, warnings, filters, and ranking.
- `lib/investments.ts`: investment trend analysis and ranking.
- `lib/query.ts`: URL filter parsing.
- `lib/tax.ts` and `lib/quote.ts`: GE tax and current-quote calculations.
- `lib/auth.ts`, `lib/session.ts`, and `lib/prisma.ts`: authentication, sessions, and database access.
- `prisma/**`: MySQL schema and migrations.
- `docs/**`: durable product, architecture, and operational documentation.

## Environment And Commands

- Use Node.js and npm. Do not switch package managers or add a second lockfile.
- Start local environment values from `.env.example`; never commit `.env` or real credentials.
- Live Wiki requests require `USER_AGENT_CONTACT`. Keep the User-Agent descriptive and include the configured contact value.
- Authentication and favorites require `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`.

Common commands:

- Install dependencies: `npm install`
- Start agent-run development: `npm run dev -- -p 3100`
- Run tests: `npm test`
- Run type checking: `npm run typecheck`
- Run a production build: `npm run build`
- Generate the Prisma client: `npm run db:generate`
- Create a development migration: `npm run db:migrate:dev`
- Apply committed migrations: `npm run db:migrate:deploy`

## Working Agreement

- Inspect relevant files and tests before changing behavior. Prefer `rg`, `rg --files`, `sed`, and `nl` for discovery.
- Keep changes scoped to the requested outcome and preserve unrelated working-tree changes.
- Prefer existing local patterns over new dependencies. Add a dependency only when it materially simplifies the solution and the tradeoff is justified.
- Use `apply_patch` for focused manual edits. Do not run broad formatters, generators, or codemods unless their output is required.
- Do not manually edit generated files such as `next-env.d.ts` or `tsconfig.tsbuildinfo`.
- Add comments for non-obvious policy or algorithm decisions, not to narrate straightforward code.
- Update `README.md`, `docs/PRODUCT.md`, `docs/ARCHITECTURE.md`, or `TODO.md` when a change makes them inaccurate.
- Never start an agent-run development, preview, or production server on port 3000. Use port 3100 by default, or another confirmed-free non-3000 port when necessary.
- Run agent-started servers in a tracked foreground terminal session, never as an untracked background process. Immediately after testing, interrupt the session, stop its exact process group if needed, and verify that the selected port no longer has a listener. Never leave suspended or background Next.js processes behind.

## Data And API Rules

- Keep all direct `prices.runescape.wiki` requests in `lib/osrsWiki.ts`; UI components and route handlers call local helpers or internal routes.
- Preserve the current request coalescing and TTL caching behavior unless the task explicitly changes the caching design.
- Treat the Wiki API respectfully. Keep enrichment shortlists bounded and avoid unbounded per-item timeseries requests.
- Validate route parameters and query values at the boundary.
- Return failures as JSON with an `{ error: string }` shape and an appropriate status code.
- Collection endpoints conventionally return `{ data, meta? }`. Preserve documented endpoint-specific success shapes such as `{ item, quote }` and `{ favorited }`.
- Do not expose secrets, raw session tokens, database details, or upstream response internals in errors.

## Scoring Invariants

- Conservative buy price is the latest low price; conservative sell price is the latest high price.
- GE tax lives in `lib/tax.ts`. Net profit is `sellPrice - buyPrice - tax`.
- Exclude incomplete prices and candidates whose current net profit is not positive.
- Keep scoring deterministic for the same market snapshot and inputs.
- Prefer robust historical measures and explicit confidence or risk penalties over optimistic extrapolation.
- Down-rank or warn on stale quotes, thin volume, unstable spreads, low sample coverage, low confidence, and unknown buy limits.
- Keep scoring formulas, returned explanation fields, displayed labels, and tests synchronized.
- Any scoring change requires focused tests covering its formula, boundary cases, and ranking effect.

## Frontend Rules

- Preserve the dense, scannable, utility-focused visual language in `app/globals.css`.
- Use `AppShell` for application navigation, account state, and theme behavior.
- Keep tables, filters, dialogs, and detail panels keyboard accessible and usable on small screens.
- Represent loading, empty, error, stale-data, and partial-data states explicitly.
- Add visible instructional copy only when it helps a user make or understand a market decision.
- Do not present estimates with language that implies guaranteed fills or profit.

## Authentication And Persistence

- Better Auth owns email/password authentication and sessions; Prisma owns MySQL access.
- Enforce ownership by the authenticated user for all favorites and future user-owned records.
- Validate unauthenticated, invalid-input, not-found, and cross-user cases in route tests where applicable.
- Never use the MySQL root account as the application connection.
- Do not rewrite an applied migration. Create a new migration for schema changes and update `prisma/schema.prisma` in the same change.

## Verification

- Add or update the narrowest useful tests whenever behavior changes. Tests must not depend on the live Wiki API.
- Always run `npm test` and `npm run typecheck` after meaningful code changes.
- Also run `npm run build` for UI, route, configuration, dependency, or Next.js changes.
- For database changes, generate the client and validate the relevant migration path in addition to the checks above.
- Documentation-only changes require a careful link, command, and code-accuracy review; code checks are optional unless generated or source files changed.
- Before finishing, review the diff for unrelated edits, generated-file churn, leaked secrets, stale documentation, and unmet acceptance criteria.

## Roadmap Handoff

- Keep exactly one milestone in `TODO.md` marked active.
- Check off work only after implementation and required verification are complete.
- Update the roadmap date when priorities, assumptions, or statuses change.
- Record newly discovered work in the appropriate milestone, operational section, backlog, or deferred list.
- Do not silently change the no-trade-tracking or no-saved-bankroll constraints.
