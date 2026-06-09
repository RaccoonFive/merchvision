import { describe, expect, it } from "vitest";
import { analyzeMarket, buildFlipCandidates, filterAndSortFlips } from "./scoring";
import type { ItemMeta, LatestPrice, PricePoint } from "./types";

const nowSeconds = 1_700_000_000;

const items: ItemMeta[] = [
  { id: 1, name: "Profitable rune", members: false, limit: 12_000 },
  { id: 2, name: "Negative herb", members: true, limit: 1_000 },
  { id: 3, name: "Stale ore", members: false },
  { id: 4, name: "Missing plank", members: true, limit: 10_000 }
];

const prices: LatestPrice[] = [
  { id: 1, low: 100, high: 140, lowTime: nowSeconds - 30, highTime: nowSeconds - 20 },
  { id: 2, low: 100, high: 101, lowTime: nowSeconds - 30, highTime: nowSeconds - 20 },
  { id: 3, low: 1_000, high: 1_100, lowTime: nowSeconds - 7_200, highTime: nowSeconds - 7_200 },
  { id: 4, low: 500, lowTime: nowSeconds - 30 }
];

describe("buildFlipCandidates", () => {
  it("keeps profitable candidates and excludes negative or incomplete prices", () => {
    const candidates = buildFlipCandidates({
      items,
      prices,
      volumesByItem: new Map([[1, 500]]),
      nowSeconds
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual([1, 3]);
    expect(candidates[0]).toMatchObject({
      buyPrice: 100,
      sellPrice: 140,
      tax: 2,
      netProfit: 38,
      volume: 500
    });
  });

  it("adds risk warnings for stale, thin, and unknown-limit flips", () => {
    const candidates = buildFlipCandidates({ items, prices, nowSeconds });
    const stale = candidates.find((candidate) => candidate.id === 3);

    expect(stale?.warnings).toContain("Unknown buy limit");
    expect(stale?.warnings).toContain("Thin volume");
    expect(stale?.warnings).toContain("Stale quotes");
  });
});

describe("filterAndSortFlips", () => {
  it("filters by search, profit, roi, volume, price, membership, and stale policy", () => {
    const candidates = buildFlipCandidates({
      items,
      prices,
      volumesByItem: new Map([
        [1, 500],
        [3, 500]
      ]),
      nowSeconds
    });

    const result = filterAndSortFlips(candidates, {
      search: "rune",
      minProfit: 10,
      minRoi: 1,
      minVolume: 100,
      maxPrice: 1_000,
      members: "f2p",
      includeStale: false,
      sort: "profit"
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });
});

describe("analyzeMarket", () => {
  it("estimates risk-adjusted gp per hour from stable hourly samples", () => {
    const points = Array.from({ length: 24 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (23 - index) * 3_600,
      avgHighPrice: 1_100,
      avgLowPrice: 1_000,
      highPriceVolume: 20_000,
      lowPriceVolume: 15_000
    }));

    expect(analyzeMarket(points, 1_000)).toEqual({
      historicalNetMarginMedian: 78,
      historicalNetMarginVariability: 0,
      positiveSpreadRatio: 1,
      midpointPriceVolatility: 0,
      medianMatchedHourlyVolume: 15_000,
      sampleCount: 24,
      sampleCoverage: 1,
      estimatedExecutableUnitsPerHour: 150,
      rawExpectedGpPerHour: 11_700,
      confidence: 1,
      volatilityPenalty: 0,
      riskAdjustedGpPerHour: 11_700
    });
  });

  it("caps executable units by the hourly buy-limit allowance", () => {
    const points = Array.from({ length: 24 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (23 - index) * 3_600,
      avgHighPrice: 1_100,
      avgLowPrice: 1_000,
      highPriceVolume: 20_000,
      lowPriceVolume: 15_000
    }));

    const analysis = analyzeMarket(points, 200);

    expect(analysis.estimatedExecutableUnitsPerHour).toBe(50);
    expect(analysis.rawExpectedGpPerHour).toBe(3_900);
    expect(analysis.riskAdjustedGpPerHour).toBe(3_900);
  });

  it("handles missing prices, zero volume, negative spreads, and partial windows", () => {
    const analysis = analyzeMarket([
      {
        timestamp: nowSeconds - 3_600,
        avgHighPrice: 100,
        avgLowPrice: 120,
        highPriceVolume: 0,
        lowPriceVolume: 0
      },
      {
        timestamp: nowSeconds,
        avgHighPrice: 150,
        avgLowPrice: 100,
        highPriceVolume: 0,
        lowPriceVolume: 0
      },
      {
        timestamp: nowSeconds + 3_600,
        avgHighPrice: 200,
        highPriceVolume: 500
      }
    ]);

    expect(analysis).toMatchObject({
      historicalNetMarginMedian: 12.5,
      historicalNetMarginVariability: 2.76,
      positiveSpreadRatio: 0.5,
      medianMatchedHourlyVolume: 0,
      sampleCount: 2,
      sampleCoverage: 0.0833,
      estimatedExecutableUnitsPerHour: 0,
      rawExpectedGpPerHour: 0,
      confidence: 0.1958,
      riskAdjustedGpPerHour: 0
    });
    expect(analysis.midpointPriceVolatility).toBeCloseTo(0.0638, 4);
    expect(analysis.volatilityPenalty).toBeCloseTo(0.7777, 4);
  });

  it("returns zeroed analysis when there are no usable samples", () => {
    expect(analyzeMarket([{ timestamp: nowSeconds }])).toEqual({
      historicalNetMarginMedian: 0,
      historicalNetMarginVariability: 0,
      positiveSpreadRatio: 0,
      midpointPriceVolatility: 0,
      medianMatchedHourlyVolume: 0,
      sampleCount: 0,
      sampleCoverage: 0,
      estimatedExecutableUnitsPerHour: 0,
      rawExpectedGpPerHour: 0,
      confidence: 0,
      volatilityPenalty: 0.4,
      riskAdjustedGpPerHour: 0
    });
  });
});
