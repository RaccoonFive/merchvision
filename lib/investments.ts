import type {
  InvestmentAnalysis,
  InvestmentCandidate,
  InvestmentFilters,
  ItemMeta,
  MarketSummary,
  PricePoint
} from "./types";

const HOUR_SECONDS = 60 * 60;
const SHORT_HOURS = 24;
const MEDIUM_HOURS = 7 * 24;
const MIN_COVERAGE = 0.5;
const VOLATILITY_FLOOR = 0.001;

type MidpointPoint = {
  timestamp: number;
  midpoint: number;
};

export function midpointPoints(points: PricePoint[]): MidpointPoint[] {
  return points
    .filter(
      (point) =>
        Number.isFinite(point.avgHighPrice) &&
        Number.isFinite(point.avgLowPrice) &&
        (point.avgHighPrice ?? 0) > 0 &&
        (point.avgLowPrice ?? 0) > 0
    )
    .map((point) => ({
      timestamp: point.timestamp,
      midpoint: ((point.avgHighPrice ?? 0) + (point.avgLowPrice ?? 0)) / 2
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function analyzeInvestment(points: PricePoint[], nowSeconds?: number): InvestmentAnalysis | null {
  const midpoints = midpointPoints(points);
  if (midpoints.length < 2) return null;

  const now = nowSeconds ?? midpoints.at(-1)?.timestamp ?? Math.floor(Date.now() / 1000);
  const shortPoints = pointsInWindow(midpoints, now, SHORT_HOURS);
  const mediumPoints = pointsInWindow(midpoints, now, MEDIUM_HOURS);
  const shortCoverage = coverage(shortPoints, SHORT_HOURS);
  const mediumCoverage = coverage(mediumPoints, MEDIUM_HOURS);
  const shortTrend = regressionTrend(shortPoints);
  const mediumTrend = regressionTrend(mediumPoints);

  if (
    shortTrend === null ||
    mediumTrend === null ||
    shortTrend <= 0 ||
    mediumTrend <= 0 ||
    shortCoverage < MIN_COVERAGE ||
    mediumCoverage < MIN_COVERAGE
  ) {
    return null;
  }

  return {
    currentMidpoint: midpoints.at(-1)?.midpoint ?? 0,
    shortTrend,
    mediumTrend,
    volatility: logReturnVolatility(mediumPoints),
    consistency: positiveReturnRatio(mediumPoints),
    confidence: Math.min(shortCoverage, mediumCoverage),
    shortCoverage,
    mediumCoverage,
    sampleCount: mediumPoints.length
  };
}

export function buildInvestmentCandidates({
  items,
  summaries,
  histories
}: {
  items: ItemMeta[];
  summaries: MarketSummary[];
  histories: Map<number, PricePoint[]>;
}): InvestmentCandidate[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const liquidSummaries = summaries
    .map((summary) => ({ summary, matchedVolume: matchedVolume(summary) }))
    .sort((a, b) => b.matchedVolume - a.matchedVolume);
  const percentileById = new Map(
    liquidSummaries.map(({ summary }, index) => [
      summary.id,
      liquidSummaries.length <= 1 ? 1 : 1 - index / (liquidSummaries.length - 1)
    ])
  );

  return liquidSummaries.flatMap(({ summary, matchedVolume }) => {
    const item = itemsById.get(summary.id);
    const analysis = analyzeInvestment(histories.get(summary.id) ?? []);
    if (!item || !analysis) return [];

    const liquidityPercentile = percentileById.get(summary.id) ?? 0;
    const score = investmentScore(analysis, liquidityPercentile);
    return [{
      ...analysis,
      id: item.id,
      name: item.name,
      members: item.members,
      icon: item.icon,
      buyLimit: item.limit,
      matchedVolume,
      liquidityPercentile,
      score,
      warnings: investmentWarnings(analysis, matchedVolume)
    }];
  });
}

export function filterAndSortInvestments(
  candidates: InvestmentCandidate[],
  filters: InvestmentFilters
): InvestmentCandidate[] {
  const search = filters.search?.trim().toLowerCase();
  const sort = filters.sort ?? "score";

  return candidates
    .filter((candidate) => {
      if (search && !candidate.name.toLowerCase().includes(search)) return false;
      if ((filters.minShortTrend ?? 0) / 100 > candidate.shortTrend) return false;
      if ((filters.minMediumTrend ?? 0) / 100 > candidate.mediumTrend) return false;
      if ((filters.minVolume ?? 0) > candidate.matchedVolume) return false;
      if ((filters.maxPrice ?? 0) > 0 && candidate.currentMidpoint > (filters.maxPrice ?? 0)) return false;
      if (filters.members === "members" && !candidate.members) return false;
      if (filters.members === "f2p" && candidate.members) return false;
      return true;
    })
    .sort((a, b) => sortValue(b, sort) - sortValue(a, sort));
}

export function matchedVolume(summary: MarketSummary): number {
  return Math.min(summary.highPriceVolume ?? 0, summary.lowPriceVolume ?? 0);
}

export function regressionTrend(points: MidpointPoint[]): number | null {
  if (points.length < 2) return null;
  const origin = points[0].timestamp;
  const pairs = points.map((point) => ({
    x: (point.timestamp - origin) / HOUR_SECONDS,
    y: Math.log(point.midpoint)
  }));
  const meanX = average(pairs.map((pair) => pair.x));
  const meanY = average(pairs.map((pair) => pair.y));
  const denominator = pairs.reduce((total, pair) => total + (pair.x - meanX) ** 2, 0);
  if (denominator === 0) return null;
  const slope = pairs.reduce((total, pair) => total + (pair.x - meanX) * (pair.y - meanY), 0) / denominator;
  const duration = pairs.at(-1)?.x ?? 0;
  return Math.exp(slope * duration) - 1;
}

export function logReturnVolatility(points: MidpointPoint[]): number {
  const returns = logReturns(points);
  if (returns.length < 2) return 0;
  const mean = average(returns);
  return Math.sqrt(average(returns.map((value) => (value - mean) ** 2)));
}

export function positiveReturnRatio(points: MidpointPoint[]): number {
  const returns = logReturns(points);
  if (returns.length === 0) return 0;
  return returns.filter((value) => value > 0).length / returns.length;
}

function investmentScore(analysis: InvestmentAnalysis, liquidityPercentile: number): number {
  const weightedTrend = analysis.shortTrend * 0.4 + analysis.mediumTrend * 0.6;
  const liquidityFactor = 0.5 + liquidityPercentile * 0.5;
  const raw = weightedTrend * analysis.confidence * analysis.consistency * liquidityFactor;
  return Math.round((raw / Math.max(analysis.volatility, VOLATILITY_FLOOR)) * 100);
}

function investmentWarnings(analysis: InvestmentAnalysis, volume: number): string[] {
  const warnings: string[] = [];
  if (analysis.confidence < 0.75) warnings.push("Partial price history");
  if (analysis.consistency < 0.55) warnings.push("Inconsistent upward movement");
  if (analysis.volatility > 0.03) warnings.push("High hourly volatility");
  if (volume < 1_000) warnings.push("Thin matched volume");
  return warnings;
}

function pointsInWindow(points: MidpointPoint[], now: number, hours: number): MidpointPoint[] {
  const cutoff = now - hours * HOUR_SECONDS;
  return points.filter((point) => point.timestamp >= cutoff && point.timestamp <= now);
}

function coverage(points: MidpointPoint[], expectedHours: number): number {
  return Math.min(points.length / expectedHours, 1);
}

function logReturns(points: MidpointPoint[]): number[] {
  return points.slice(1).map((point, index) => Math.log(point.midpoint / points[index].midpoint));
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function sortValue(candidate: InvestmentCandidate, sort: NonNullable<InvestmentFilters["sort"]>): number {
  switch (sort) {
    case "shortTrend":
      return candidate.shortTrend;
    case "mediumTrend":
      return candidate.mediumTrend;
    case "volume":
      return candidate.matchedVolume;
    case "volatility":
      return -candidate.volatility;
    case "score":
    default:
      return candidate.score;
  }
}
