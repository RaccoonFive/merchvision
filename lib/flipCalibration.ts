import type { FlipObservation, Prisma } from "@prisma/client";
import { recommendMonotonicConfidenceWeights } from "./flipCalibrationAnalysis";
import { loadReliableCandidateUniverse, loadUpsideCandidateUniverse } from "./flipFinder";
import { getTimeseries } from "./osrsWiki";
import { prisma } from "./prisma";
import type { FlipCandidate, PricePoint, UpsideFlipCandidate } from "./types";

const LEGACY_MODEL_VERSION = "legacy-current-v1";
const CALIBRATION_INTERVAL_MINUTES = 15;
const HORIZON_HOURS = 4;
const RETENTION_DAYS = 90;
const MAX_UPSIDE_OBSERVATIONS = 50;
const MAX_BASELINE_OBSERVATIONS = 25;
const MAX_PENDING_RESOLUTIONS = 500;
const TIMESERIES_BATCH_SIZE = 10;

export type FlipProxyOutcome = "completed" | "no_entry" | "entered_incomplete" | "ambiguous";

export type ProxyEvaluation = {
  outcome: FlipProxyOutcome;
  entryTouchedAt: Date | null;
  exitTouchedAt: Date | null;
  timeToCompletionMinutes: number | null;
  proxyGpPerHour: number;
};

export async function runFlipCalibration(now = new Date()) {
  const resolved = await resolvePendingObservations(now);
  const created = await collectObservations(now);
  const retentionCutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const pruned = await prisma.flipObservation.deleteMany({
    where: { status: "resolved", resolvedAt: { lt: retentionCutoff } }
  });

  return {
    created,
    resolved,
    pruned: pruned.count,
    bucketAt: calibrationBucket(now).toISOString()
  };
}

export async function collectObservations(now = new Date()): Promise<number> {
  const upside = await loadUpsideCandidateUniverse();
  const reliableUniverse = await loadReliableCandidateUniverse();
  const reliable = [...reliableUniverse].sort((a, b) => b.score - a.score || a.id - b.id);
  const legacy = [...reliableUniverse].sort((a, b) =>
    legacyCurrentMarginScore(b) - legacyCurrentMarginScore(a) || a.id - b.id
  );
  const bucketAt = calibrationBucket(now);
  const horizonEndsAt = new Date(now.getTime() + HORIZON_HOURS * 60 * 60 * 1000);
  const rows = [
    ...upside.slice(0, MAX_UPSIDE_OBSERVATIONS).map((candidate, index) =>
      upsideObservation(candidate, index + 1, now, bucketAt, horizonEndsAt)
    ),
    ...reliable.slice(0, MAX_BASELINE_OBSERVATIONS).map((candidate, index) =>
      reliableObservation(candidate, index + 1, now, bucketAt, horizonEndsAt)
    ),
    ...legacy.slice(0, MAX_BASELINE_OBSERVATIONS).map((candidate, index) =>
      legacyObservation(candidate, index + 1, now, bucketAt, horizonEndsAt)
    )
  ];

  if (rows.length === 0) return 0;
  const result = await prisma.flipObservation.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

export async function resolvePendingObservations(now = new Date()): Promise<number> {
  const pending = await prisma.flipObservation.findMany({
    where: { status: "pending", horizonEndsAt: { lte: now } },
    orderBy: { horizonEndsAt: "asc" },
    take: MAX_PENDING_RESOLUTIONS
  });
  if (pending.length === 0) return 0;

  const pointsByItem = await loadFiveMinuteHistories([...new Set(pending.map((row) => row.itemId))]);
  let resolved = 0;

  for (let index = 0; index < pending.length; index += 25) {
    const batch = pending.slice(index, index + 25);
    const updates = batch.flatMap((observation) => {
      const points = pointsByItem.get(observation.itemId);
      if (!points) return [];
      const evaluation = evaluateFlipObservation(observation, points);
      if (!evaluation) return [];

      return [prisma.flipObservation.update({
        where: { id: observation.id },
        data: {
          status: "resolved",
          outcome: evaluation.outcome,
          entryTouchedAt: evaluation.entryTouchedAt,
          exitTouchedAt: evaluation.exitTouchedAt,
          timeToCompletionMinutes: evaluation.timeToCompletionMinutes,
          proxyGpPerHour: evaluation.proxyGpPerHour,
          resolvedAt: now
        }
      })];
    });
    await Promise.all(updates);
    resolved += updates.length;
  }

  return resolved;
}

export function evaluateFlipObservation(
  observation: Pick<
    FlipObservation,
    "observedAt" | "horizonEndsAt" | "buyPrice" | "sellPrice" | "netProfit" | "estimatedUnitsPerHour"
  >,
  points: PricePoint[]
): ProxyEvaluation | null {
  const observedAtSeconds = Math.floor(observation.observedAt.getTime() / 1000);
  const horizonSeconds = Math.floor(observation.horizonEndsAt.getTime() / 1000);
  const sorted = points
    .filter((point) => point.timestamp > observedAtSeconds && point.timestamp <= horizonSeconds)
    .sort((a, b) => a.timestamp - b.timestamp);
  const latestSourceTimestamp = Math.max(0, ...points.map((point) => point.timestamp));
  const sourceCoversStart = sorted.some((point) => point.timestamp <= observedAtSeconds + 10 * 60);
  if (!sourceCoversStart || latestSourceTimestamp < horizonSeconds - 5 * 60) return null;

  const entry = sorted.find((point) =>
    hasPositiveNumber(point.avgLowPrice) &&
    point.avgLowPrice <= observation.buyPrice &&
    hasPositiveNumber(point.lowPriceVolume)
  );
  if (!entry) return emptyEvaluation("no_entry");

  const exit = sorted.find((point) =>
    point.timestamp > entry.timestamp &&
    hasPositiveNumber(point.avgHighPrice) &&
    point.avgHighPrice >= observation.sellPrice &&
    hasPositiveNumber(point.highPriceVolume)
  );
  if (exit) {
    return {
      outcome: "completed",
      entryTouchedAt: new Date(entry.timestamp * 1000),
      exitTouchedAt: new Date(exit.timestamp * 1000),
      timeToCompletionMinutes: Math.round((exit.timestamp - entry.timestamp) / 60),
      proxyGpPerHour: roundMetric(observation.netProfit * observation.estimatedUnitsPerHour)
    };
  }

  const sameBucketExit = hasPositiveNumber(entry.avgHighPrice) &&
    entry.avgHighPrice >= observation.sellPrice &&
    hasPositiveNumber(entry.highPriceVolume);
  if (sameBucketExit) {
    return {
      ...emptyEvaluation("ambiguous"),
      entryTouchedAt: new Date(entry.timestamp * 1000)
    };
  }

  return {
    ...emptyEvaluation("entered_incomplete"),
    entryTouchedAt: new Date(entry.timestamp * 1000)
  };
}

export async function getFlipCalibrationReport(now = new Date()) {
  const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const observations = await prisma.flipObservation.findMany({
    where: { status: "resolved", observedAt: { gte: cutoff } },
    select: {
      modelVersion: true,
      bucketAt: true,
      itemId: true,
      rank: true,
      outcome: true,
      proxyGpPerHour: true,
      timeToCompletionMinutes: true,
      observedAt: true,
      features: true
    }
  });
  const modelVersions = [...new Set(observations.map((row) => row.modelVersion))].sort();
  const oldestObservedAt = observations.reduce<Date | null>(
    (oldest, row) => !oldest || row.observedAt < oldest ? row.observedAt : oldest,
    null
  );

  return {
    generatedAt: now.toISOString(),
    retentionDays: RETENTION_DAYS,
    resolvedCount: observations.length,
    oldestObservedAt: oldestObservedAt?.toISOString() ?? null,
    readyForReview: Boolean(oldestObservedAt && now.getTime() - oldestObservedAt.getTime() >= 30 * 24 * 60 * 60 * 1000),
    models: modelVersions.map((modelVersion) => ({
      modelVersion,
      top10: summarizeModel(observations.filter((row) => row.modelVersion === modelVersion && row.rank <= 10)),
      top25: summarizeModel(observations.filter((row) => row.modelVersion === modelVersion && row.rank <= 25))
    })),
    upsideWeightRecommendation: recommendMonotonicConfidenceWeights(
      observations.filter((row) => row.modelVersion === "upside-v1")
    )
  };
}

export function legacyCurrentMarginScore(candidate: FlipCandidate): number {
  const profitScore = Math.log10(Math.max(candidate.netProfit, 1)) * 22;
  const roiScore = Math.min(Math.max(candidate.roi, 0), 0.2) * 180;
  const volumeScore = Math.min(Math.log10(Math.max(candidate.volume, 1)) * 12, 48);
  const limitScore = candidate.buyLimit ? Math.min(Math.log10(candidate.buyLimit) * 5, 20) : -15;
  const legacyFreshnessSeconds = Math.min(
    candidate.quoteHealth.highAgeSeconds,
    candidate.quoteHealth.lowAgeSeconds
  );
  const stalePenalty = Math.min(legacyFreshnessSeconds / 90, 45);
  return Math.max(0, Math.round(profitScore + roiScore + volumeScore + limitScore - stalePenalty));
}

function upsideObservation(
  candidate: UpsideFlipCandidate,
  rank: number,
  observedAt: Date,
  bucketAt: Date,
  horizonEndsAt: Date
): Prisma.FlipObservationCreateManyInput {
  return baseObservation({
    candidate,
    rank,
    observedAt,
    bucketAt,
    horizonEndsAt,
    rankingView: "upside",
    modelVersion: candidate.modelVersion,
    estimatedUnitsPerHour: candidate.upsideAnalysis.estimatedUnitsPerHour,
    estimatedGpPerHour: candidate.upsideAnalysis.riskAdjustedGpPerHour,
    confidence: candidate.upsideAnalysis.opportunityConfidence,
    features: {
      quoteHealth: candidate.quoteHealth,
      analysis: candidate.upsideAnalysis,
      currentRoi: candidate.roi
    }
  });
}

function reliableObservation(
  candidate: FlipCandidate,
  rank: number,
  observedAt: Date,
  bucketAt: Date,
  horizonEndsAt: Date
): Prisma.FlipObservationCreateManyInput {
  const units = candidate.marketAnalysis?.estimatedExecutableUnitsPerHour ?? 0;
  return baseObservation({
    candidate,
    rank,
    observedAt,
    bucketAt,
    horizonEndsAt,
    rankingView: "reliable",
    modelVersion: candidate.modelVersion,
    estimatedUnitsPerHour: units,
    estimatedGpPerHour: candidate.conservativeExpectedGpPerHour ?? 0,
    confidence: candidate.confidence,
    features: {
      quoteHealth: candidate.quoteHealth,
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      marketAnalysis: candidate.marketAnalysis ?? null,
      repeatableNetProfit: candidate.repeatableNetProfit
    }
  });
}

function legacyObservation(
  candidate: FlipCandidate,
  rank: number,
  observedAt: Date,
  bucketAt: Date,
  horizonEndsAt: Date
): Prisma.FlipObservationCreateManyInput {
  const units = candidate.marketAnalysis?.estimatedExecutableUnitsPerHour ?? 0;
  return baseObservation({
    candidate,
    rank,
    observedAt,
    bucketAt,
    horizonEndsAt,
    rankingView: "legacy",
    modelVersion: LEGACY_MODEL_VERSION,
    estimatedUnitsPerHour: units,
    estimatedGpPerHour: candidate.netProfit * units,
    confidence: 0,
    features: {
      quoteHealth: candidate.quoteHealth,
      legacyScore: legacyCurrentMarginScore(candidate),
      currentRoi: candidate.roi,
      trailingVolume: candidate.volume
    }
  });
}

function baseObservation({
  candidate,
  rank,
  observedAt,
  bucketAt,
  horizonEndsAt,
  rankingView,
  modelVersion,
  estimatedUnitsPerHour,
  estimatedGpPerHour,
  confidence,
  features
}: {
  candidate: FlipCandidate | UpsideFlipCandidate;
  rank: number;
  observedAt: Date;
  bucketAt: Date;
  horizonEndsAt: Date;
  rankingView: string;
  modelVersion: string;
  estimatedUnitsPerHour: number;
  estimatedGpPerHour: number;
  confidence: number;
  features: Prisma.InputJsonValue;
}): Prisma.FlipObservationCreateManyInput {
  return {
    itemId: candidate.id,
    rankingView,
    modelVersion,
    observedAt,
    bucketAt,
    horizonEndsAt,
    rank,
    buyPrice: candidate.buyPrice,
    sellPrice: candidate.sellPrice,
    netProfit: candidate.netProfit,
    estimatedUnitsPerHour,
    estimatedGpPerHour,
    confidence,
    features
  };
}

async function loadFiveMinuteHistories(ids: number[]): Promise<Map<number, PricePoint[] | undefined>> {
  const result = new Map<number, PricePoint[] | undefined>();
  for (let index = 0; index < ids.length; index += TIMESERIES_BATCH_SIZE) {
    const batch = ids.slice(index, index + TIMESERIES_BATCH_SIZE);
    const rows = await Promise.all(batch.map(async (id) => {
      try {
        return [id, await getTimeseries(id, "5m")] as const;
      } catch {
        return [id, undefined] as const;
      }
    }));
    rows.forEach(([id, points]) => result.set(id, points));
  }
  return result;
}

function calibrationBucket(date: Date): Date {
  const bucket = new Date(date);
  bucket.setUTCSeconds(0, 0);
  bucket.setUTCMinutes(
    Math.floor(bucket.getUTCMinutes() / CALIBRATION_INTERVAL_MINUTES) * CALIBRATION_INTERVAL_MINUTES
  );
  return bucket;
}

function emptyEvaluation(outcome: Exclude<FlipProxyOutcome, "completed">): ProxyEvaluation {
  return {
    outcome,
    entryTouchedAt: null,
    exitTouchedAt: null,
    timeToCompletionMinutes: null,
    proxyGpPerHour: 0
  };
}

function summarizeModel(rows: Array<{
  outcome: string | null;
  proxyGpPerHour: number | null;
  timeToCompletionMinutes: number | null;
}>) {
  const completed = rows.filter((row) => row.outcome === "completed");
  return {
    observationCount: rows.length,
    completedCount: completed.length,
    noEntryCount: rows.filter((row) => row.outcome === "no_entry").length,
    enteredIncompleteCount: rows.filter((row) => row.outcome === "entered_incomplete").length,
    ambiguousCount: rows.filter((row) => row.outcome === "ambiguous").length,
    completionRate: rows.length === 0 ? null : roundMetric(completed.length / rows.length),
    averageZeroInclusiveProxyGpPerHour: rows.length === 0
      ? null
      : roundMetric(rows.reduce((total, row) => total + (row.proxyGpPerHour ?? 0), 0) / rows.length),
    medianCompletionMinutes: median(
      completed.flatMap((row) => row.timeToCompletionMinutes === null ? [] : [row.timeToCompletionMinutes])
    )
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function hasPositiveNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
