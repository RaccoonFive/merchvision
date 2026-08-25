import { calculateGeTax } from "./tax";
import type {
  FlipCandidate,
  FlipFilters,
  FlipScoreBreakdown,
  ItemMeta,
  LatestPrice,
  MarketAnalysis,
  PricePoint
} from "./types";

const STALE_AFTER_SECONDS = 15 * 60;
const VERY_STALE_AFTER_SECONDS = 60 * 60;
const MARKET_ANALYSIS_WINDOW_HOURS = 7 * 24;
const MIN_CONFIDENT_SAMPLES = 84;
const BUY_LIMIT_WINDOW_HOURS = 4;
const FRESH_QUOTE_SECONDS = 15 * 60;
const SCORE_STALE_SECONDS = 60 * 60;
const CURRENT_MARGIN_SPIKE_START = 1.5;
const CURRENT_MARGIN_SPIKE_WARNING_RATIO = 2;
const CURRENT_MARGIN_SPIKE_WARNING_MINIMUM_GP = 100;
const CONSERVATIVE_GP_PER_HOUR_WEIGHT = 30;
const CONSERVATIVE_BUY_LIMIT_PROFIT_WEIGHT = 10;
const REPEATABLE_NET_MARGIN_WEIGHT = 15;
const REPEATABLE_ROI_WEIGHT = 5;
const MATCHED_VOLUME_WEIGHT = 10;
const POSITIVE_SPREAD_WEIGHT = 12;
const SPREAD_STABILITY_WEIGHT = 8;
const HISTORICAL_CONFIDENCE_WEIGHT = 10;
export const MIN_DEFAULT_CONFIDENCE = 0.45;

type BuildCandidatesInput = {
  items: ItemMeta[];
  prices: LatestPrice[];
  volumesByItem?: Map<number, number>;
  analysesByItem?: Map<number, MarketAnalysis>;
  nowSeconds?: number;
};

export function buildFlipCandidates({
  items,
  prices,
  volumesByItem = new Map<number, number>(),
  analysesByItem = new Map<number, MarketAnalysis>(),
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
    const marketAnalysis = analysesByItem.get(price.id);
    const confidence = marketAnalysis?.confidence ?? 0;
    const stability = marketAnalysis && marketAnalysis.sampleCount > 0
      ? Math.max(0, 1 - marketAnalysis.volatilityPenalty)
      : 0;
    const totalBuyLimitProfit = item.limit ? netProfit * item.limit : 0;
    const warnings = buildWarnings({ item, netProfit, freshnessSeconds, marketAnalysis });
    const repeatable = repeatableProfitMetrics(netProfit, marketAnalysis);
    const scoreBreakdown = scoreFlip({
      netProfit,
      buyPrice,
      freshnessSeconds,
      buyLimit: item.limit,
      marketAnalysis
    });

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
      repeatableNetProfit: repeatable?.netProfit ?? null,
      conservativeExpectedGpPerHour: repeatable?.expectedGpPerHour ?? null,
      score: scoreBreakdown.score,
      scoreBreakdown,
      marketAnalysis,
      confidence,
      stability,
      totalBuyLimitProfit,
      warnings
    });
  }

  return candidates;
}

export function filterAndSortFlips(candidates: FlipCandidate[], filters: FlipFilters): FlipCandidate[] {
  const search = filters.search?.trim().toLowerCase();
  const includeStale = filters.includeStale ?? true;
  const includeLowConfidence = filters.includeLowConfidence ?? true;
  const sort = filters.sort ?? "score";

  return candidates
    .filter((candidate) => {
      if (search && !candidate.name.toLowerCase().includes(search)) return false;
      if ((filters.minProfit ?? 0) > candidate.netProfit) return false;
      if ((filters.minRoi ?? 0) / 100 > candidate.roi) return false;
      if ((filters.minVolume ?? 0) > candidate.volume) return false;
      if ((filters.minConfidence ?? 0) / 100 > candidate.confidence) return false;
      if ((filters.minStability ?? 0) / 100 > candidate.stability) return false;
      if ((filters.minTotalBuyLimitProfit ?? 0) > candidate.totalBuyLimitProfit) return false;
      if ((filters.maxPrice ?? 0) > 0 && candidate.buyPrice > (filters.maxPrice ?? 0)) return false;
      if (filters.members === "members" && !candidate.members) return false;
      if (filters.members === "f2p" && candidate.members) return false;
      if (!includeStale && candidate.freshnessSeconds > VERY_STALE_AFTER_SECONDS) return false;
      if (!includeLowConfidence && candidate.confidence < MIN_DEFAULT_CONFIDENCE) return false;
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
    volatilityPenalty: roundMetric(volatilityPenalty)
  };
}

function buildWarnings({
  item,
  netProfit,
  freshnessSeconds,
  marketAnalysis
}: {
  item: ItemMeta;
  netProfit: number;
  freshnessSeconds: number;
  marketAnalysis?: MarketAnalysis;
}): string[] {
  const warnings: string[] = [];
  const analysis = marketAnalysis && marketAnalysis.sampleCount > 0 ? marketAnalysis : undefined;
  if (!item.limit) warnings.push("Unknown buy limit");
  if (!marketAnalysis) warnings.push("Seven-day history not analyzed");
  if (marketAnalysis && !analysis) warnings.push("Seven-day history unavailable");
  if (analysis) {
    if (analysis.sampleCoverage < 0.5) warnings.push("Low sample coverage");
    if (analysis.confidence < 0.45) warnings.push("Low confidence");
    if (analysis.positiveSpreadRatio < 0.7) warnings.push("Unstable spread");
    if (analysis.midpointPriceVolatility > 0.08) warnings.push("High volatility");
    if (analysis.medianMatchedHourlyVolume < 100) warnings.push("Thin volume");
    if (analysis.historicalNetMarginMedian <= 0) {
      warnings.push("Seven-day median margin is not profitable");
    } else if (
      netProfit / analysis.historicalNetMarginMedian >= CURRENT_MARGIN_SPIKE_WARNING_RATIO &&
      netProfit - analysis.historicalNetMarginMedian >= CURRENT_MARGIN_SPIKE_WARNING_MINIMUM_GP
    ) {
      warnings.push("Current margin is far above its seven-day norm");
    }
  }
  if (freshnessSeconds > STALE_AFTER_SECONDS) warnings.push("Stale quotes");
  if (netProfit < 100) warnings.push("Small margin");
  return warnings;
}

export function scoreFlip({
  netProfit,
  buyPrice,
  freshnessSeconds,
  buyLimit,
  marketAnalysis
}: {
  netProfit: number;
  buyPrice: number;
  freshnessSeconds: number;
  buyLimit?: number;
  marketAnalysis?: MarketAnalysis;
}): FlipScoreBreakdown {
  const analysis = marketAnalysis && marketAnalysis.sampleCount > 0 ? marketAnalysis : undefined;
  const confidence = analysis?.confidence ?? 0;
  const coverage = analysis?.sampleCoverage ?? 0;
  const repeatable = repeatableProfitMetrics(netProfit, marketAnalysis);
  const repeatableNetProfit = repeatable?.netProfit ?? 0;
  const conservativeExpectedGpPerHour = repeatable?.expectedGpPerHour ?? 0;
  const conservativeBuyLimitProfit = buyLimit ? repeatableNetProfit * buyLimit : 0;
  const repeatableRoi = buyPrice > 0 ? repeatableNetProfit / buyPrice : 0;
  const medianMatchedHourlyVolume = analysis?.medianMatchedHourlyVolume ?? 0;
  const positiveSpreadRatio = analysis?.positiveSpreadRatio ?? 0;
  const stability = analysis ? Math.max(0, 1 - analysis.volatilityPenalty) : 0;
  const components = [
    scoreComponent(
      "Conservative estimated GP/hour",
      logScale(conservativeExpectedGpPerHour, 1_000_000) * CONSERVATIVE_GP_PER_HOUR_WEIGHT * confidence
    ),
    scoreComponent(
      "Conservative buy-limit profit",
      logScale(conservativeBuyLimitProfit, 10_000_000) * CONSERVATIVE_BUY_LIMIT_PROFIT_WEIGHT * confidence
    ),
    scoreComponent(
      "Repeatable net margin",
      logScale(repeatableNetProfit, 100_000) * REPEATABLE_NET_MARGIN_WEIGHT * confidence
    ),
    scoreComponent("Repeatable ROI", clamp(repeatableRoi / 0.1, 0, 1) * REPEATABLE_ROI_WEIGHT * confidence),
    scoreComponent(
      "Historical matched volume",
      logScale(medianMatchedHourlyVolume, 100_000) * MATCHED_VOLUME_WEIGHT * confidence
    ),
    scoreComponent("Positive-spread consistency", positiveSpreadRatio * POSITIVE_SPREAD_WEIGHT * coverage),
    scoreComponent("Seven-day spread stability", stability * SPREAD_STABILITY_WEIGHT * coverage),
    scoreComponent("Historical confidence", confidence * HISTORICAL_CONFIDENCE_WEIGHT)
  ];

  const freshnessPenalty = clamp(
    (freshnessSeconds - FRESH_QUOTE_SECONDS) / (SCORE_STALE_SECONDS - FRESH_QUOTE_SECONDS),
    0,
    1
  ) * 20;
  if (freshnessPenalty > 0) {
    components.push(scoreComponent("Quote freshness", -freshnessPenalty));
  }

  const historicalMedian = analysis?.historicalNetMarginMedian ?? 0;
  const spikePenalty = historicalMedian <= 0
    ? 25
    : Math.min(
      25,
      Math.max(0, Math.log2((netProfit / historicalMedian) / CURRENT_MARGIN_SPIKE_START) * 15)
    );
  if (spikePenalty > 0) {
    components.push(scoreComponent("Current-margin spike", -spikePenalty));
  }

  if (!buyLimit) {
    components.push(scoreComponent("Unknown buy limit", -5));
  }

  const rawScore = components.reduce((total, component) => total + component.points, 0);

  return {
    components,
    rawScore,
    score: clamp(Math.round(rawScore), 0, 100)
  };
}

function scoreComponent(label: string, points: number) {
  return { label, points, kind: points < 0 ? "penalty" as const : "driver" as const };
}

function getSortValue(candidate: FlipCandidate, sort: NonNullable<FlipFilters["sort"]>): number {
  switch (sort) {
    case "confidence":
      return candidate.confidence;
    case "stability":
      return candidate.stability;
    case "totalBuyLimitProfit":
      return candidate.totalBuyLimitProfit;
    case "profit":
      return candidate.netProfit;
    case "typicalProfit":
      return candidate.marketAnalysis && candidate.marketAnalysis.sampleCount > 0
        ? candidate.marketAnalysis.historicalNetMarginMedian
        : Number.NEGATIVE_INFINITY;
    case "expectedGpPerHour":
      return candidate.conservativeExpectedGpPerHour ?? Number.NEGATIVE_INFINITY;
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

function logScale(value: number, cap: number): number {
  return clamp(Math.log10(Math.max(0, value) + 1) / Math.log10(cap + 1), 0, 1);
}

function repeatableProfitMetrics(
  currentNetProfit: number,
  marketAnalysis?: MarketAnalysis
): { netProfit: number; expectedGpPerHour: number } | undefined {
  if (!marketAnalysis || marketAnalysis.sampleCount === 0) {
    return undefined;
  }

  const netProfit = Math.max(0, Math.min(currentNetProfit, marketAnalysis.historicalNetMarginMedian));
  return {
    netProfit: roundMetric(netProfit),
    expectedGpPerHour: roundMetric(netProfit * marketAnalysis.estimatedExecutableUnitsPerHour)
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
