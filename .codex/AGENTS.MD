# Agent Instructions

## Project Snapshot
- This is a Next.js app for finding low-risk Old School RuneScape Grand Exchange flips.
- The app uses the OSRS Wiki Real-Time Prices API for item mapping, latest prices, and item timeseries data.
- The main user experience lives in `components/FlipFinder.tsx`.
- Server routes live under `app/api/**`.
- Core data, scoring, and API helpers live under `lib/**`.

## Required Environment
- Use Node.js and npm.
- Live API requests require `USER_AGENT_CONTACT`.
- Store local env values in `.env`; start from `.env.example` when creating it:
  - `USER_AGENT_CONTACT=you@example.com`
  - `OSRS_LATEST_CACHE_SECONDS=60`
  - `OSRS_MAPPING_CACHE_SECONDS=86400`
- Do not hardcode a real personal contact value in tracked files.

## Common Commands
- Install dependencies: `npm install`
- Run dev server: `npm run dev`
- Run tests: `npm test`
- Run typecheck: `npm run typecheck`
- Run production build: `npm run build`

## Workflow Expectations
- Before changing behavior, inspect the relevant files with `rg`, `sed`, or `nl`.
- Keep edits scoped to the requested behavior.
- Prefer existing local patterns over adding new libraries.
- Use `apply_patch` for manual file edits.
- Do not run formatters or code generators that rewrite tracked files unless the user asks.
- After meaningful code changes, run at least:
  - `npm test`
  - `npm run typecheck`
- Run `npm run build` for UI, route, config, or Next.js changes.

## Data And API Notes
- `lib/osrsWiki.ts` is the only place that should call the OSRS Wiki API directly.
- Keep the User-Agent compliant: include the app name and `USER_AGENT_CONTACT`.
- Cache live prices briefly and item mapping much longer.
- API routes should return JSON with either `{ data: ... }` or `{ error: ... }`.
- Avoid making one timeseries request per item beyond the current capped enrichment behavior; the Wiki API should be treated respectfully.

## Flip Scoring Rules
- Conservative buy price is the current low price.
- Conservative sell price is the current high price.
- GE tax is handled in `lib/tax.ts`.
- Net profit is `sellPrice - buyPrice - tax`.
- Exclude incomplete prices and non-profitable candidates.
- Down-rank stale quotes, thin volume, and unknown buy limits rather than presenting them as equally safe.
- Keep scoring deterministic and covered by unit tests.

## Frontend Notes
- The first screen should remain the tool itself, not a marketing landing page.
- Keep the UI dense, scannable, and practical for repeated flip finding.
- Use the existing dark, utility-focused visual style in `app/globals.css`.
- Make sure table columns and filter controls remain usable on small screens.
- Do not add visible instructional copy unless it directly supports the workflow.

## Testing Notes
- Tax behavior is tested in `lib/tax.test.ts`.
- Candidate ranking/filtering is tested in `lib/scoring.test.ts`.
- The flips API route has a mocked-route test in `app/api/flips/route.test.ts`.
- Add focused tests when changing scoring, filters, route contracts, or API normalization.

## Current Caveats
- This workspace may not be a valid Git repository even though a `.git` directory exists; check `git status --short` before relying on Git.
- `npm install` may report dependency audit findings or Node engine warnings depending on the local Node version.
- A generated `tsconfig.tsbuildinfo` may appear after typechecking.
