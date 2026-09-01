import { calculateGeTax } from "./tax";
import { buildQuoteHealth } from "./scoring";
import type {
  FlipCandidate,
  ItemMeta,
  LatestPrice,
  MarketSummary,
  PricePoint,
  QuoteHealth,
  UpsideAnalysis,
  UpsideFlipCandidate,
  UpsideFlipFilters
} from "./types";

export const UPSIDE_MODEL_VERSION = "upside-v1";
export const UPSIDE_SHORTLIST_SIZE = 75;

const FIVE_MINUTE_SECONDS = 5 * 60;
const RECENT_WINDOW_SECONDS = 4 * 60 * 60;
const DAILY_WINDOW_SECONDS = 24 * 60 * 60;
const RECENT_EXPECTED_SAMPLES = 48;
const DAILY_EXPECTED_SAMPLES = 288;
const MIN_SAMPLE_COVERAGE = 0.5;
const MAX_QUOTE_AGE_SECONDS = 15 * 60;
const MAX_QUOTE_SKEW_SECONDS = 10 * 60;
const FULLY_FRESH_SECONDS = 5 * 60;
const MIDPOINT_VOLATILITY_LIMIT = 0.08;
const MARKET_SHARE_ESTIMATE = 0.01;
const BUY_LIMIT_WINDOW_HOURS = 4;

type UpsideSample = {
  timestamp: number;
  netMargin: number;
  midpoint: number;
  matchedVolume: number;
};

export function buildUpsideShortlist(
  candidates: FlipCandidate[],
  summaries: MarketSummary[] | undefined,
  limit = UPSIDE_SHORTLIST_SIZE
): FlipCandidate[] {
  const trustworthyQuotes = candidates.filter((candidate) =>
    candidate.buyLimit &&
    candidate.quoteHealth.pairAgeSeconds <= MAX_QUOTE_AGE_SECONDS &&
    candidate.quoteHealth.skewSeconds <= MAX_QUOTE_SKEW_SECONDS
  );
  const volumeByItem = new Map(
    (summaries ?? []).map((summary) => [summary.id, matchedSummaryVolume(summary)])
  );
  const selected = new Map<number, FlipCandidate>();
  const profitRanked = topBy(trustworthyQuotes, (candidate) => candidate.netProfit);
  const roiRanked = topBy(trustworthyQuotes, (candidate) => candidate.roi);
  const capacityRanked = topBy(
    trustworthyQuotes,
    (candidate) => currentCapacityProxy(candidate, volumeByItem.get(candidate.id) ?? 0)
  );
  const volumeRanked = topBy(trustworthyQuotes, (candidate) => volumeByItem.get(candidate.id) ?? 0);

  addCandidates(selected, profitRanked.slice(0, 25), limit);
  addCandidates(selected, roiRanked.slice(0, 15), limit);
  addCandidates(selected, capacityRanked.slice(0, 20), limit);
  addCandidates(selected, volumeRanked.slice(0, 15), limit);
  addCandidates(selected, capacityRanked, limit);

  return [...selected.values()];
}

export function analyzeUpsideMarket(
  points: PricePoint[],
  buyLimit: number,
  quoteHealth: QuoteHealth,
  currentNetMargin: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): UpsideAnalysis {
  const dailySamples = normalizedSamples(points, nowSeconds - DAILY_WINDOW_SECONDS, nowSeconds);
  const recentSamples = dailySamples.filter((sample) => sample.timestamp > nowSeconds - RECENT_WINDOW_SECONDS);
  const dailyMargins = dailySamples.map((sample) => sample.netMargin);
  const netMarginP90 = percentile(dailyMargins, 0.9);
  const capturableNetMargin = Math.max(0, Math.min(currentNetMargin, netMarginP90));
  const recentSampleCoverage = clamp(recentSamples.length / RECENT_EXPECTED_SAMPLES, 0, 1);
  const dailySampleCoverage = clamp(dailySamples.length / DAILY_EXPECTED_SAMPLES, 0, 1);
  const recentPositiveSpreadRatio = positiveRatio(recentSamples);
  const dailyPositiveSpreadRatio = positiveRatio(dailySamples);
  const recentMatchedVolume = recentSamples.reduce((total, sample) => total + sample.matchedVolume, 0);
  const hourlyVolumes = rollingHourlyMatchedVolumes(dailySamples);
  const matchedVolumeP25PerHour = percentile(hourlyVolumes, 0.25);
  const estimatedUnitsPerHour = Math.min(
    buyLimit / BUY_LIMIT_WINDOW_HOURS,
    matchedVolumeP25PerHour * MARKET_SHARE_ESTIMATE
  );
  const midpointPriceVolatility = coefficientOfVariation(dailySamples.map((sample) => sample.midpoint));
  const freshnessFactor = quoteFreshnessFactor(quoteHealth);
  const stabilityFactor = Math.max(0.05, 1 - clamp(midpointPriceVolatility / MIDPOINT_VOLATILITY_LIMIT, 0, 1));
  const opportunityConfidence = geometricMean([
    recentPositiveSpreadRatio,
    dailyPositiveSpreadRatio,
    dailySampleCoverage,
    freshnessFactor,
    stabilityFactor
  ]);
  const baseEstimatedGpPerHour = capturableNetMargin * estimatedUnitsPerHour;
  const riskAdjustedGpPerHour = baseEstimatedGpPerHour * opportunityConfidence;

  return {
    capturableNetMargin: roundMetric(capturableNetMargin),
    netMarginP90: roundMetric(netMarginP90),
    estimatedUnitsPerHour: roundMetric(estimatedUnitsPerHour),
    baseEstimatedGpPerHour: roundMetric(baseEstimatedGpPerHour),
    riskAdjustedGpPerHour: roundMetric(riskAdjustedGpPerHour),
    opportunityConfidence: roundMetric(opportunityConfidence),
    recentPositiveSpreadRatio: roundMetric(recentPositiveSpreadRatio),
    dailyPositiveSpreadRatio: roundMetric(dailyPositiveSpreadRatio),
    recentSampleCoverage: roundMetric(recentSampleCoverage),
    dailySampleCoverage: roundMetric(dailySampleCoverage),
    recentMatchedVolume: roundMetric(recentMatchedVolume),
    matchedVolumeP25PerHour: roundMetric(matchedVolumeP25PerHour),
    midpointPriceVolatility: roundMetric(midpointPriceVolatility),
    freshnessFactor: roundMetric(freshnessFactor),
    stabilityFactor: roundMetric(stabilityFactor),
    sampleCount: dailySamples.length
  };
}

export function buildUpsideCandidates({
  items,
  prices,
  pointsByItem,
  nowSeconds = Math.floor(Date.now() / 1000)
}: {
  items: ItemMeta[];
  prices: LatestPrice[];
  pointsByItem: Map<number, PricePoint[]>;
  nowSeconds?: number;
}): UpsideFlipCandidate[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const candidates: UpsideFlipCandidate[] = [];

  for (const price of prices) {
    const item = itemsById.get(price.id);
    if (!item?.limit || !price.high || !price.low || !price.highTime || !price.lowTime) continue;

    const buyPrice = price.low;
    const sellPrice = price.high;
    const margin = sellPrice - buyPrice;
    const tax = calculateGeTax(sellPrice);
    const netProfit = margin - tax;
    if (netProfit <= 0) continue;

    const quoteHealth = buildQuoteHealth(price.highTime, price.lowTime, nowSeconds);
    const upsideAnalysis = analyzeUpsideMarket(
      pointsByItem.get(item.id) ?? [],
      item.limit,
      quoteHealth,
      netProfit,
      nowSeconds
    );
    if (!passesTrustGate(quoteHealth, upsideAnalysis)) continue;

    candidates.push({
      view: "upside",
      modelVersion: UPSIDE_MODEL_VERSION,
      id: item.id,
      name: item.name,
      members: item.members,
      icon: item.icon,
      buyLimit: item.limit,
      buyPrice,
      sellPrice,
      margin,
      tax,
      netProfit,
      roi: netProfit / buyPrice,
      highTime: price.highTime,
      lowTime: price.lowTime,
      freshnessSeconds: quoteHealth.pairAgeSeconds,
      quoteHealth,
      volume: upsideAnalysis.recentMatchedVolume,
      upsideAnalysis,
      warnings: upsideWarnings(netProfit, upsideAnalysis)
    });
  }

  return candidates.sort(compareUpsideCandidates);
}

export function filterAndSortUpsideFlips(
  candidates: UpsideFlipCandidate[],
  filters: UpsideFlipFilters
): UpsideFlipCandidate[] {
  const search = filters.search?.trim().toLowerCase();
  const sort = filters.sort ?? "riskAdjustedGpPerHour";

  return candidates
    .filter((candidate) => {
      if (search && !candidate.name.toLowerCase().includes(search)) return false;
      if ((filters.minProfit ?? 0) > candidate.netProfit) return false;
      if ((filters.minRoi ?? 0) / 100 > candidate.roi) return false;
      if ((filters.minVolume ?? 0) > candidate.volume) return false;
      if ((filters.minExpectedGpPerHour ?? 0) > candidate.upsideAnalysis.riskAdjustedGpPerHour) return false;
      if ((filters.minOpportunityConfidence ?? 0) / 100 > candidate.upsideAnalysis.opportunityConfidence) return false;
      if ((filters.maxPrice ?? 0) > 0 && candidate.buyPrice > (filters.maxPrice ?? 0)) return false;
      if (filters.members === "members" && !candidate.members) return false;
      if (filters.members === "f2p" && candidate.members) return false;
      return true;
    })
    .sort((a, b) => compareBySort(a, b, sort))
    .slice(0, 250);
}

export function passesTrustGate(quoteHealth: QuoteHealth, analysis: UpsideAnalysis): boolean {
  return quoteHealth.pairAgeSeconds <= MAX_QUOTE_AGE_SECONDS &&
    quoteHealth.skewSeconds <= MAX_QUOTE_SKEW_SECONDS &&
    analysis.recentSampleCoverage >= MIN_SAMPLE_COVERAGE &&
    analysis.dailySampleCoverage >= MIN_SAMPLE_COVERAGE &&
    analysis.recentMatchedVolume > 0 &&
    analysis.capturableNetMargin > 0 &&
    analysis.riskAdjustedGpPerHour > 0;
}

function normalizedSamples(points: PricePoint[], startSeconds: number, endSeconds: number): UpsideSample[] {
  return points
    .filter((point) => point.timestamp > startSeconds && point.timestamp <= endSeconds)
    .map((point) => {
      if (
        !hasPositiveNumber(point.avgHighPrice) ||
        !hasPositiveNumber(point.avgLowPrice) ||
        !hasNonNegativeNumber(point.highPriceVolume) ||
        !hasNonNegativeNumber(point.lowPriceVolume)
      ) {
        return undefined;
      }

      return {
        timestamp: point.timestamp,
        netMargin: point.avgHighPrice - point.avgLowPrice - calculateGeTax(point.avgHighPrice),
        midpoint: (point.avgHighPrice + point.avgLowPrice) / 2,
        matchedVolume: Math.min(point.highPriceVolume, point.lowPriceVolume)
      };
    })
    .filter((sample): sample is UpsideSample => sample !== undefined)
    .sort((a, b) => a.timestamp - b.timestamp);
}

function rollingHourlyMatchedVolumes(samples: UpsideSample[]): number[] {
  const volumes: number[] = [];

  for (let end = 11; end < samples.length; end += 1) {
    const window = samples.slice(end - 11, end + 1);
    const consecutive = window.every((sample, index) =>
      index === 0 || sample.timestamp - window[index - 1].timestamp <= FIVE_MINUTE_SECONDS * 2
    );
    if (!consecutive) continue;
    volumes.push(window.reduce((total, sample) => total + sample.matchedVolume, 0));
  }

  return volumes;
}

function quoteFreshnessFactor(quoteHealth: QuoteHealth): number {
  if (
    quoteHealth.pairAgeSeconds > MAX_QUOTE_AGE_SECONDS ||
    quoteHealth.skewSeconds > MAX_QUOTE_SKEW_SECONDS
  ) return 0;
  const ageFactor = linearDecay(quoteHealth.pairAgeSeconds, FULLY_FRESH_SECONDS, MAX_QUOTE_AGE_SECONDS);
  const skewFactor = linearDecay(quoteHealth.skewSeconds, FULLY_FRESH_SECONDS, MAX_QUOTE_SKEW_SECONDS);
  return Math.max(0.05, Math.min(ageFactor, skewFactor));
}

function linearDecay(value: number, fullUntil: number, zeroAt: number): number {
  if (value <= fullUntil) return 1;
  if (value >= zeroAt) return 0;
  return 1 - (value - fullUntil) / (zeroAt - fullUntil);
}

function upsideWarnings(currentNetProfit: number, analysis: UpsideAnalysis): string[] {
  const warnings: string[] = [];
  if (currentNetProfit > analysis.netMarginP90) warnings.push("Current margin is capped at its recent 90th percentile");
  if (analysis.recentPositiveSpreadRatio < 0.7) warnings.push("Recent after-tax spread is inconsistent");
  if (analysis.midpointPriceVolatility > 0.04) warnings.push("Recent midpoint is volatile");
  if (analysis.opportunityConfidence < 0.5) warnings.push("Low opportunity confidence");
  return warnings;
}

function currentCapacityProxy(candidate: FlipCandidate, matchedDailyVolume: number): number {
  const limitPerHour = (candidate.buyLimit ?? 0) / BUY_LIMIT_WINDOW_HOURS;
  const marketSharePerHour = (matchedDailyVolume / 24) * MARKET_SHARE_ESTIMATE;
  return candidate.netProfit * Math.min(limitPerHour, marketSharePerHour);
}

function matchedSummaryVolume(summary: MarketSummary): number {
  if (!hasNonNegativeNumber(summary.highPriceVolume) || !hasNonNegativeNumber(summary.lowPriceVolume)) return 0;
  return Math.min(summary.highPriceVolume, summary.lowPriceVolume);
}

function compareUpsideCandidates(a: UpsideFlipCandidate, b: UpsideFlipCandidate): number {
  return b.upsideAnalysis.riskAdjustedGpPerHour - a.upsideAnalysis.riskAdjustedGpPerHour ||
    b.upsideAnalysis.opportunityConfidence - a.upsideAnalysis.opportunityConfidence ||
    b.upsideAnalysis.capturableNetMargin - a.upsideAnalysis.capturableNetMargin ||
    b.volume - a.volume ||
    a.id - b.id;
}

function compareBySort(
  a: UpsideFlipCandidate,
  b: UpsideFlipCandidate,
  sort: NonNullable<UpsideFlipFilters["sort"]>
): number {
  const difference = upsideSortValue(b, sort) - upsideSortValue(a, sort);
  return difference || compareUpsideCandidates(a, b);
}

function upsideSortValue(candidate: UpsideFlipCandidate, sort: NonNullable<UpsideFlipFilters["sort"]>): number {
  switch (sort) {
    case "confidence": return candidate.upsideAnalysis.opportunityConfidence;
    case "capturableProfit": return candidate.upsideAnalysis.capturableNetMargin;
    case "profit": return candidate.netProfit;
    case "roi": return candidate.roi;
    case "volume": return candidate.volume;
    case "freshness": return -candidate.freshnessSeconds;
    case "riskAdjustedGpPerHour":
    default: return candidate.upsideAnalysis.riskAdjustedGpPerHour;
  }
}

function topBy(candidates: FlipCandidate[], value: (candidate: FlipCandidate) => number): FlipCandidate[] {
  return [...candidates].sort((a, b) => value(b) - value(a) || a.id - b.id);
}

function addCandidates(selected: Map<number, FlipCandidate>, candidates: FlipCandidate[], limit: number) {
  for (const candidate of candidates) {
    if (selected.size >= limit) break;
    selected.set(candidate.id, candidate);
  }
}

function percentile(values: number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(clamp(percentileValue, 0, 1) * sorted.length) - 1);
  return sorted[index];
}

function positiveRatio(samples: UpsideSample[]): number {
  return samples.length === 0 ? 0 : samples.filter((sample) => sample.netMargin > 0).length / samples.length;
}

function coefficientOfVariation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  if (mean <= 0) return 0;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function geometricMean(values: number[]): number {
  if (values.length === 0 || values.some((value) => value <= 0)) return 0;
  return Math.exp(values.reduce((total, value) => total + Math.log(value), 0) / values.length);
}

function hasPositiveNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function hasNonNegativeNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
