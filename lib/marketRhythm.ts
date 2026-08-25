import { calculateGeTax } from "./tax";
import type { MarketRhythm, PricePoint } from "./types";

/**
 * Summarizes the latest hourly observations for Item Lookup. The Wiki provides
 * one week of hourly data, so this deliberately describes observed hours rather
 * than treating them as a recurring weekly pattern or a fill forecast.
 */
export function analyzeMarketRhythm(points: PricePoint[]): MarketRhythm {
  const samples = points
    .filter(hasCompletePrices)
    .map((point) => ({
      timestamp: point.timestamp,
      netMargin: point.avgHighPrice - point.avgLowPrice - calculateGeTax(point.avgHighPrice),
      matchedVolume: matchedVolume(point),
      midpoint: (point.avgHighPrice + point.avgLowPrice) / 2
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  const margins = samples.map((sample) => sample.netMargin);
  const volumes = samples
    .map((sample) => sample.matchedVolume)
    .filter((volume): volume is number => volume !== null);
  const midpoints = samples.map((sample) => sample.midpoint);
  const midpointMedian = median(midpoints);

  return {
    samples: samples.map(({ midpoint: _midpoint, ...sample }) => sample),
    sampleCount: samples.length,
    sourcePointCount: points.length,
    positiveSpreadRatio: round(margins.length === 0 ? 0 : margins.filter((margin) => margin > 0).length / margins.length),
    medianMatchedHourlyVolume: volumes.length === 0 ? null : round(median(volumes)),
    midpointPriceVolatility: round(midpointMedian > 0 ? standardDeviation(midpoints) / midpointMedian : 0)
  };
}

function hasCompletePrices(point: PricePoint): point is PricePoint & { avgHighPrice: number; avgLowPrice: number } {
  return isPositiveFinite(point.avgHighPrice) && isPositiveFinite(point.avgLowPrice);
}

function matchedVolume(point: PricePoint): number | null {
  if (!isNonNegativeFinite(point.highPriceVolume) || !isNonNegativeFinite(point.lowPriceVolume)) {
    return null;
  }

  return Math.min(point.highPriceVolume, point.lowPriceVolume);
}

function isPositiveFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((total, value) => total + value, 0) / values.length;
  return Math.sqrt(values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
