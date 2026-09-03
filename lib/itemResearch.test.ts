import { describe, expect, it } from "vitest";
import { analyzeItemResearch } from "./itemResearch";
import type { PricePoint } from "./types";

const nowSeconds = 1_700_000_000;

describe("analyzeItemResearch", () => {
  it("uses the Reliable seven-day policy and reports history freshness", () => {
    const points = Array.from({ length: 168 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (167 - index) * 3_600,
      avgHighPrice: 1_100,
      avgLowPrice: 1_000,
      highPriceVolume: 20_000,
      lowPriceVolume: 15_000
    }));

    expect(analyzeItemResearch(points, 200, nowSeconds)).toEqual({
      market: {
        historicalNetMarginMedian: 78,
        historicalNetMarginVariability: 0,
        positiveSpreadRatio: 1,
        midpointPriceVolatility: 0,
        medianMatchedHourlyVolume: 15_000,
        sampleCount: 168,
        sampleCoverage: 1,
        estimatedExecutableUnitsPerHour: 50,
        rawExpectedGpPerHour: 3_900,
        confidence: 1,
        volatilityPenalty: 0
      },
      sourcePointCount: 168,
      volumeSampleCount: 168,
      latestSampleTime: nowSeconds,
      freshnessSeconds: 0
    });
  });

  it("distinguishes missing volume from observed zero volume", () => {
    const withoutVolume = analyzeItemResearch([
      { timestamp: nowSeconds - 60, avgHighPrice: 1_100, avgLowPrice: 1_000 }
    ], undefined, nowSeconds);
    const withZeroVolume = analyzeItemResearch([
      {
        timestamp: nowSeconds - 60,
        avgHighPrice: 1_100,
        avgLowPrice: 1_000,
        highPriceVolume: 0,
        lowPriceVolume: 0
      }
    ], undefined, nowSeconds);

    expect(withoutVolume.volumeSampleCount).toBe(0);
    expect(withZeroVolume.volumeSampleCount).toBe(1);
    expect(withoutVolume.market?.medianMatchedHourlyVolume).toBe(0);
    expect(withZeroVolume.market?.medianMatchedHourlyVolume).toBe(0);
  });

  it("returns explicit unavailable values when no complete prices exist", () => {
    expect(analyzeItemResearch([
      { timestamp: nowSeconds, avgHighPrice: 1_100, highPriceVolume: 10, lowPriceVolume: 10 }
    ], 1_000, nowSeconds)).toEqual({
      market: null,
      sourcePointCount: 1,
      volumeSampleCount: 1,
      latestSampleTime: null,
      freshnessSeconds: null
    });
  });

  it("handles an empty upstream response", () => {
    expect(analyzeItemResearch([], undefined, nowSeconds)).toEqual({
      market: null,
      sourcePointCount: 0,
      volumeSampleCount: 0,
      latestSampleTime: null,
      freshnessSeconds: null
    });
  });

  it("excludes unsupported price values while preserving partial coverage", () => {
    const result = analyzeItemResearch([
      { timestamp: nowSeconds - 7_200, avgHighPrice: Number.NaN, avgLowPrice: 1_000 },
      { timestamp: nowSeconds - 3_600, avgHighPrice: 1_100, avgLowPrice: Number.POSITIVE_INFINITY },
      { timestamp: nowSeconds - 600, avgHighPrice: 1_100, avgLowPrice: 1_000 }
    ], undefined, nowSeconds);

    expect(result.market?.sampleCount).toBe(1);
    expect(result.market?.sampleCoverage).toBe(0.006);
    expect(result.latestSampleTime).toBe(nowSeconds - 600);
    expect(result.freshnessSeconds).toBe(600);
  });

  it("bounds analysis and coverage to the latest 168 hourly points", () => {
    const points = Array.from({ length: 170 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (169 - index) * 3_600,
      avgHighPrice: index < 2 ? 5_000 : 1_100,
      avgLowPrice: 1_000,
      highPriceVolume: 1_000,
      lowPriceVolume: 1_000
    }));

    const result = analyzeItemResearch(points, undefined, nowSeconds);

    expect(result.sourcePointCount).toBe(168);
    expect(result.market?.sampleCount).toBe(168);
    expect(result.market?.sampleCoverage).toBe(1);
    expect(result.market?.historicalNetMarginMedian).toBe(78);
  });
});
