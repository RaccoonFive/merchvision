import { calculateGeTax } from "./tax";
import type { FlipCandidate, FlipFilters, ItemMeta, LatestPrice, MarketAnalysis, PricePoint } from "./types";

const STALE_AFTER_SECONDS = 15 * 60;
const VERY_STALE_AFTER_SECONDS = 60 * 60;
const MARKET_ANALYSIS_WINDOW_HOURS = 24;
const MIN_CONFIDENT_SAMPLES = 12;
const BUY_LIMIT_WINDOW_HOURS = 4;

type BuildCandidatesInput = {
  items: ItemMeta[];
  prices: LatestPrice[];
  volumesByItem?: Map<number, number>;
  nowSeconds?: number;
};

export function buildFlipCandidates({
  items,
  prices,
  volumesByItem = new Map<number, number>(),
  nowSeconds = Math.floor(Date.now() / 1000)
}: BuildCandidatesInput): FlipCandidate[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const candidates: FlipCandidate[] = [];

  for (const price of prices) {
    const item = itemsById.get(price.id);
    if (!item || !price.high || !price.low || !price.highTime || !price.lowTime) {
      continue;
    }

    const buyPrice = price.low;
    const sellPrice = price.high;
    const margin = sellPrice - buyPrice;
    const tax = calculateGeTax(sellPrice);
    const netProfit = margin - tax;
    const roi = buyPrice > 0 ? netProfit / buyPrice : 0;
    const freshestTrade = Math.max(price.highTime, price.lowTime);
    const freshnessSeconds = Math.max(0, nowSeconds - freshestTrade);
    const volume = volumesByItem.get(price.id) ?? 0;
    const warnings = buildWarnings({ item, netProfit, freshnessSeconds, volume });
    const score = scoreFlip({ netProfit, roi, volume, freshnessSeconds, buyLimit: item.limit });

    if (netProfit <= 0) {
      continue;
    }

    candidates.push({
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
      roi,
      highTime: price.highTime,
      lowTime: price.lowTime,
      freshnessSeconds,
      volume,
      score,
      warnings
    });
  }

  return candidates;
}

export function filterAndSortFlips(candidates: FlipCandidate[], filters: FlipFilters): FlipCandidate[] {
  const search = filters.search?.trim().toLowerCase();
  const includeStale = filters.includeStale ?? false;
  const sort = filters.sort ?? "score";

  return candidates
    .filter((candidate) => {
      if (search && !candidate.name.toLowerCase().includes(search)) return false;
      if ((filters.minProfit ?? 0) > candidate.netProfit) return false;
      if ((filters.minRoi ?? 0) / 100 > candidate.roi) return false;
      if ((filters.minVolume ?? 0) > candidate.volume) return false;
      if ((filters.maxPrice ?? 0) > 0 && candidate.buyPrice > (filters.maxPrice ?? 0)) return false;
      if (filters.members === "members" && !candidate.members) return false;
      if (filters.members === "f2p" && candidate.members) return false;
      if (!includeStale && candidate.freshnessSeconds > VERY_STALE_AFTER_SECONDS) return false;
      return true;
    })
    .sort((a, b) => getSortValue(b, sort) - getSortValue(a, sort))
    .slice(0, 250);
}

export function volumeFromTimeseries(points: PricePoint[]): number {
  return points.reduce((total, point) => total + (point.highPriceVolume ?? 0) + (point.lowPriceVolume ?? 0), 0);
}

export function analyzeMarket(points: PricePoint[], buyLimit?: number): MarketAnalysis {
  const window = points.slice(-MARKET_ANALYSIS_WINDOW_HOURS);
  const marginSamples = window
    .map((point) => {
      if (!hasPositiveNumber(point.avgHighPrice) || !hasPositiveNumber(point.avgLowPrice)) {
        return undefined;
      }

      return {
        margin: point.avgHighPrice - point.avgLowPrice - calculateGeTax(point.avgHighPrice),
        midpoint: (point.avgHighPrice + point.avgLowPrice) / 2
      };
    })
    .filter((sample): sample is { margin: number; midpoint: number } => sample !== undefined);
  const matchedVolumes = window
    .map((point) => matchedHourlyVolume(point))
    .filter((volume): volume is number => volume !== undefined);
  const margins = marginSamples.map((sample) => sample.margin);
  const midpoints = marginSamples.map((sample) => sample.midpoint);
  const historicalNetMarginMedian = median(margins);
  const marginDeviation = medianAbsoluteDeviation(margins, historicalNetMarginMedian);
  const historicalNetMarginVariability =
    Math.abs(historicalNetMarginMedian) > 0 ? marginDeviation / Math.abs(historicalNetMarginMedian) : 0;
  const positiveSpreadRatio =
    margins.length > 0 ? margins.filter((margin) => margin > 0).length / margins.length : 0;
  const midpointMedian = median(midpoints);
  const midpointPriceVolatility =
    midpointMedian > 0 ? standardDeviation(midpoints) / midpointMedian : 0;
  const medianMatchedHourlyVolume = median(matchedVolumes);
  const estimatedExecutableUnitsPerHour = executableUnitsPerHour(medianMatchedHourlyVolume, buyLimit);
  const rawExpectedGpPerHour = Math.max(0, historicalNetMarginMedian * estimatedExecutableUnitsPerHour);
  const sampleCount = margins.length;
  const sampleCoverage = sampleCount / MARKET_ANALYSIS_WINDOW_HOURS;
  const confidence = confidenceScore({
    sampleCoverage,
    sampleCount,
    positiveSpreadRatio,
    medianMatchedHourlyVolume
  });
  const volatilityPenalty = volatilityPenaltyScore({
    historicalNetMarginVariability,
    midpointPriceVolatility,
    positiveSpreadRatio
  });
  const riskAdjustedGpPerHour = rawExpectedGpPerHour * confidence * Math.max(0, 1 - volatilityPenalty);

  return {
    historicalNetMarginMedian: roundMetric(historicalNetMarginMedian),
    historicalNetMarginVariability: roundMetric(historicalNetMarginVariability),
    positiveSpreadRatio: roundMetric(positiveSpreadRatio),
    midpointPriceVolatility: roundMetric(midpointPriceVolatility),
    medianMatchedHourlyVolume: roundMetric(medianMatchedHourlyVolume),
    sampleCount,
    sampleCoverage: roundMetric(sampleCoverage),
    estimatedExecutableUnitsPerHour: roundMetric(estimatedExecutableUnitsPerHour),
    rawExpectedGpPerHour: roundMetric(rawExpectedGpPerHour),
    confidence: roundMetric(confidence),
    volatilityPenalty: roundMetric(volatilityPenalty),
    riskAdjustedGpPerHour: roundMetric(riskAdjustedGpPerHour)
  };
}

function buildWarnings({
  item,
  netProfit,
  freshnessSeconds,
  volume
}: {
  item: ItemMeta;
  netProfit: number;
  freshnessSeconds: number;
  volume: number;
}): string[] {
  const warnings: string[] = [];
  if (!item.limit) warnings.push("Unknown buy limit");
  if (volume < 100) warnings.push("Thin volume");
  if (freshnessSeconds > STALE_AFTER_SECONDS) warnings.push("Stale quotes");
  if (netProfit < 100) warnings.push("Small margin");
  return warnings;
}

function scoreFlip({
  netProfit,
  roi,
  volume,
  freshnessSeconds,
  buyLimit
}: {
  netProfit: number;
  roi: number;
  volume: number;
  freshnessSeconds: number;
  buyLimit?: number;
}): number {
  const profitScore = Math.log10(Math.max(netProfit, 1)) * 22;
  const roiScore = Math.min(Math.max(roi, 0), 0.2) * 180;
  const volumeScore = Math.min(Math.log10(Math.max(volume, 1)) * 12, 48);
  const limitScore = buyLimit ? Math.min(Math.log10(buyLimit) * 5, 20) : -15;
  const stalePenalty = Math.min(freshnessSeconds / 90, 45);

  return Math.max(0, Math.round(profitScore + roiScore + volumeScore + limitScore - stalePenalty));
}

function getSortValue(candidate: FlipCandidate, sort: NonNullable<FlipFilters["sort"]>): number {
  switch (sort) {
    case "profit":
      return candidate.netProfit;
    case "roi":
      return candidate.roi;
    case "volume":
      return candidate.volume;
    case "freshness":
      return -candidate.freshnessSeconds;
    case "score":
    default:
      return candidate.score;
  }
}

function hasPositiveNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function matchedHourlyVolume(point: PricePoint): number | undefined {
  if (!hasNonNegativeNumber(point.highPriceVolume) || !hasNonNegativeNumber(point.lowPriceVolume)) {
    return undefined;
  }

  return Math.min(point.highPriceVolume, point.lowPriceVolume);
}

function hasNonNegativeNumber(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function executableUnitsPerHour(medianMatchedHourlyVolume: number, buyLimit?: number): number {
  const estimatedMarketShare = medianMatchedHourlyVolume * 0.01;
  const hourlyLimit = buyLimit && buyLimit > 0 ? buyLimit / BUY_LIMIT_WINDOW_HOURS : undefined;

  return hourlyLimit === undefined ? estimatedMarketShare : Math.min(estimatedMarketShare, hourlyLimit);
}

function confidenceScore({
  sampleCoverage,
  sampleCount,
  positiveSpreadRatio,
  medianMatchedHourlyVolume
}: {
  sampleCoverage: number;
  sampleCount: number;
  positiveSpreadRatio: number;
  medianMatchedHourlyVolume: number;
}): number {
  const sampleScore = clamp(sampleCount / MIN_CONFIDENT_SAMPLES, 0, 1);
  const volumeScore = clamp(Math.log10(medianMatchedHourlyVolume + 1) / 4, 0, 1);

  return clamp(sampleCoverage * 0.35 + sampleScore * 0.25 + positiveSpreadRatio * 0.25 + volumeScore * 0.15, 0, 1);
}

function volatilityPenaltyScore({
  historicalNetMarginVariability,
  midpointPriceVolatility,
  positiveSpreadRatio
}: {
  historicalNetMarginVariability: number;
  midpointPriceVolatility: number;
  positiveSpreadRatio: number;
}): number {
  const marginPenalty = clamp(historicalNetMarginVariability / 2, 0, 0.45);
  const midpointPenalty = clamp(midpointPriceVolatility * 2, 0, 0.35);
  const negativeSpreadPenalty = clamp((1 - positiveSpreadRatio) * 0.4, 0, 0.4);

  return clamp(marginPenalty + midpointPenalty + negativeSpreadPenalty, 0, 0.9);
}

function median(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function medianAbsoluteDeviation(values: number[], center: number): number {
  return median(values.map((value) => Math.abs(value - center)));
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;

  return Math.sqrt(variance);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
