import { analyzeMarket } from "./scoring";
import type { ItemResearchAnalysis, PricePoint } from "./types";

const RESEARCH_WINDOW_HOURS = 7 * 24;

/**
 * Builds the canonical Item Lookup summary from the same seven-day policy used
 * by Reliable rankings, while preserving unavailable history as null.
 */
export function analyzeItemResearch(
  points: PricePoint[],
  buyLimit?: number,
  nowSeconds = Math.floor(Date.now() / 1000)
): ItemResearchAnalysis {
  const window = points.slice(-RESEARCH_WINDOW_HOURS);
  const usablePricePoints = window.filter(hasCompletePrices);
  const volumeSampleCount = window.filter(hasCompleteVolumes).length;

  if (usablePricePoints.length === 0) {
    return {
      market: null,
      sourcePointCount: window.length,
      volumeSampleCount,
      latestSampleTime: null,
      freshnessSeconds: null
    };
  }

  const latestSampleTime = Math.max(...usablePricePoints.map((point) => point.timestamp));

  return {
    market: analyzeMarket(window, buyLimit),
    sourcePointCount: window.length,
    volumeSampleCount,
    latestSampleTime,
    freshnessSeconds: Math.max(0, nowSeconds - latestSampleTime)
  };
}

function hasCompletePrices(point: PricePoint): boolean {
  return isPositiveFinite(point.avgHighPrice) && isPositiveFinite(point.avgLowPrice);
}

function hasCompleteVolumes(point: PricePoint): boolean {
  return isNonNegativeFinite(point.highPriceVolume) && isNonNegativeFinite(point.lowPriceVolume);
}

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}
