# Flip Calibration Runbook

Merchvision uses flip calibration to evaluate whether its rankings identify plausible public-market opportunities over time. It compares the experimental High Upside ranking with the Reliable ranking and the legacy current-margin scorer.

Calibration is model-quality telemetry. It is not required to serve Flip Finder, does not track user trades, and never changes production scoring automatically. Both Flip Finder views continue to work when calibration is disabled.

## What the job does

An external scheduler calls the protected calibration endpoint every 15 minutes. Each call performs three operations in this order:

1. Resolve pending observations whose four-hour evaluation horizon has ended.
2. Record a new snapshot of the current rankings.
3. Delete resolved raw observations older than 90 days.

One snapshot can contain at most:

- 50 eligible High Upside candidates.
- 25 Reliable candidates.
- 25 candidates ranked by the legacy current-margin scorer.

Each observation stores public, user-independent market information such as the item, model version, rank, observed entry and exit prices, compact scoring features, confidence, estimated capacity, and estimated GP/hour. `FlipObservation` has no relationship to accounts or user activity.

The lifecycle is:

```text
Ranking snapshot
      |
      | wait for the four-hour horizon
      v
Look for a low-side entry touch with volume
      |
      | in a later five-minute bucket
      v
Look for a high-side exit touch with volume
      |
      v
Store the proxy outcome and include it in reports
```

## Proxy outcomes

An observation is evaluated from public five-minute OSRS Wiki price buckets after its snapshot time:

- `completed`: a low-side trade occurred at or below the observed entry price, followed in a later bucket by a high-side trade at or above the observed exit price.
- `no_entry`: the observed entry price was not touched during the four-hour horizon.
- `entered_incomplete`: the entry was touched, but a qualifying later exit was not observed.
- `ambiguous`: entry and exit conditions appeared in the same five-minute bucket, so their order cannot be established.

Only `completed` observations are eligible for non-zero proxy GP/hour. Other outcomes contribute zero to the zero-inclusive average. A same-bucket entry and exit never count as a completion.

These outcomes are calibration proxies, not proof that a player's Grand Exchange offer would have filled. Public buckets cannot reveal offer priority, an individual player's order, or the exact ordering of trades inside a bucket.

## Local development

The calibration job does not run automatically with `npm run dev`. A scheduler is unnecessary for normal feature development; invoke the endpoint manually when testing calibration.

### 1. Prepare the local database

Confirm that `DATABASE_URL` points to the intended local development database, then generate the Prisma client and apply the committed migrations:

```bash
npm run db:generate
npm run db:migrate:deploy
```

This creates the `flip_observation` table if the calibration migration has not already been applied.

### 2. Configure a local secret

Add a separate development-only bearer secret to `.env`:

```dotenv
CRON_SECRET="replace-with-a-long-random-development-secret"
```

Restart the Next.js development server after changing `.env`:

```bash
npm run dev -- -p 3100
```

Agent-run servers must never use port 3000 because it is reserved for the user's WSL workflow. Use port 3100 by default, keep the server in a tracked foreground session, and stop it immediately after testing. Before completing the task, verify that the selected port no longer has a listener.

### 3. Capture a snapshot

Call the protected endpoint using the same secret:

```bash
curl -X POST http://localhost:3100/api/internal/flip-calibration \
  -H "Authorization: Bearer <CRON_SECRET>"
```

The first response normally resembles:

```json
{
  "data": {
    "created": 100,
    "resolved": 0,
    "pruned": 0,
    "bucketAt": "2026-09-01T12:00:00.000Z"
  }
}
```

`created` can be lower than 100 when fewer candidates are eligible or an upstream Wiki request is unavailable. The call may take longer than an ordinary page request because High Upside enrichment reads bounded per-item histories.

The timestamp is rounded down to a UTC 15-minute bucket. Repeating a request in the same bucket is safe: the unique model-version, bucket, and item constraint prevents duplicate observations.

### 4. Resolve the snapshot

Wait until the four-hour horizon has ended, then make another authenticated `POST`. That call resolves the earlier pending observations before recording the next snapshot.

The development server must not stay running for the entire four hours. Pending rows remain in the local database across server restarts, but a later `POST` is still required to resolve them. Start a new tracked server session for that request, then stop it and verify that its port is released. For the most representative test, resolve observations soon after the horizon because the upstream five-minute timeseries is bounded.

### 5. Read the report

Use the authenticated `GET` endpoint:

```bash
curl http://localhost:3100/api/internal/flip-calibration \
  -H "Authorization: Bearer <CRON_SECRET>"
```

Before any horizon has ended, the report can legitimately contain no resolved observations. Useful comparison data accumulates only after repeated snapshots have been resolved.

## Production configuration

Set a separate random bearer secret in the deployment environment. Do not reuse an authentication or database secret:

```dotenv
CRON_SECRET="replace-with-a-separate-random-secret"
```

Apply the committed Prisma migration to the production database before enabling the job:

```bash
npm run db:generate
npm run db:migrate:deploy
```

Configure the deployment scheduler to send one authenticated request every 15 minutes:

```text
Schedule: */15 * * * *
Method: POST
URL: https://your-merchvision-host/api/internal/flip-calibration
Authorization: Bearer <CRON_SECRET>
```

Do not schedule the job more frequently. Allow enough request time for bounded OSRS Wiki history enrichment.

## Endpoint behavior

### Run calibration

```text
POST /api/internal/flip-calibration
Authorization: Bearer <CRON_SECRET>
```

The response reports:

- `created`: observations inserted for the current bucket.
- `resolved`: due observations assigned a proxy outcome.
- `pruned`: resolved observations deleted by the 90-day retention policy.
- `bucketAt`: the current UTC 15-minute bucket.

### Read the report

```text
GET /api/internal/flip-calibration
Authorization: Bearer <CRON_SECRET>
```

The report compares each model's top 10 and top 25 using:

- Observation and completed counts.
- No-entry, entered-but-incomplete, and ambiguous counts.
- Completion rate.
- Median completion time.
- Average zero-inclusive proxy GP/hour.

It also exposes whether at least 30 days of resolved observations are ready for product-owner review. When sufficient High Upside data exists, a time-ordered 70/30 analysis can recommend positive, monotonic confidence weights. This recommendation is evidence for a future reviewed scoring change; it never updates production weights by itself.

High Upside should remain labeled experimental until the product owner has reviewed at least 30 days of resolved observations.

## Troubleshooting

- `401 Unauthorized`: the bearer header is missing or does not exactly match `CRON_SECRET`.
- `503 Flip calibration is not configured`: `CRON_SECRET` is missing from the running process; update `.env` or the deployment environment and restart/redeploy.
- `500 Unable to run flip calibration`: check database availability, confirm the migration is applied, and verify Wiki API configuration such as `USER_AGENT_CONTACT`.
- `resolved: 0`: this is expected before the first four-hour horizon ends. It can also mean the available five-minute history does not fully cover a pending observation.
- Empty report: reports include resolved observations only, so capture a snapshot and run the endpoint again after its horizon ends.
