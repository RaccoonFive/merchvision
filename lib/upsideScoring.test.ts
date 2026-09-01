import { describe, expect, it } from "vitest";
import { buildFlipCandidates, buildQuoteHealth } from "./scoring";
import {
  analyzeUpsideMarket,
  buildUpsideCandidates,
  buildUpsideShortlist,
  filterAndSortUpsideFlips,
  passesTrustGate
} from "./upsideScoring";
import type { ItemMeta, LatestPrice, PricePoint } from "./types";

const nowSeconds = 1_700_000_000;
const freshQuote = buildQuoteHealth(nowSeconds - 60, nowSeconds - 90, nowSeconds);

describe("analyzeUpsideMarket", () => {
  it("calculates bounded margin, rolling capacity, confidence, and GP per hour", () => {
    const analysis = analyzeUpsideMarket(stableFiveMinutePoints(), 1_000, freshQuote, 500, nowSeconds);

    expect(analysis).toMatchObject({
      capturableNetMargin: 78,
      netMarginP90: 78,
      estimatedUnitsPerHour: 120,
      baseEstimatedGpPerHour: 9_360,
      riskAdjustedGpPerHour: 9_360,
      opportunityConfidence: 1,
      recentPositiveSpreadRatio: 1,
      dailyPositiveSpreadRatio: 1,
      recentSampleCoverage: 1,
      dailySampleCoverage: 1,
      recentMatchedVolume: 48_000,
      matchedVolumeP25PerHour: 12_000,
      sampleCount: 288
    });
  });

  it("caps an isolated current spike at the recent 90th percentile", () => {
    const analysis = analyzeUpsideMarket(stableFiveMinutePoints(), 1_000, freshQuote, 3_000, nowSeconds);

    expect(analysis.capturableNetMargin).toBe(78);
    expect(analysis.baseEstimatedGpPerHour).toBe(9_360);
  });

  it("requires half coverage in both windows, recent volume, and synchronized quotes", () => {
    const eligible = analyzeUpsideMarket(stableFiveMinutePoints(), 1_000, freshQuote, 78, nowSeconds);
    expect(passesTrustGate(freshQuote, eligible)).toBe(true);

    const partial = analyzeUpsideMarket(stableFiveMinutePoints().slice(-143), 1_000, freshQuote, 78, nowSeconds);
    expect(partial.dailySampleCoverage).toBeLessThan(0.5);
    expect(passesTrustGate(freshQuote, partial)).toBe(false);

    const stale = buildQuoteHealth(nowSeconds - 901, nowSeconds - 60, nowSeconds);
    expect(passesTrustGate(stale, analyzeUpsideMarket(stableFiveMinutePoints(), 1_000, stale, 78, nowSeconds))).toBe(false);

    const skewed = buildQuoteHealth(nowSeconds - 30, nowSeconds - 631, nowSeconds);
    expect(passesTrustGate(skewed, analyzeUpsideMarket(stableFiveMinutePoints(), 1_000, skewed, 78, nowSeconds))).toBe(false);
  });
});

describe("High Upside candidates", () => {
  it("ranks sustained high-margin upside ahead of a smaller liquid staple", () => {
    const items: ItemMeta[] = [
      { id: 1, name: "Sustained margin", members: true, limit: 1_000 },
      { id: 2, name: "Liquid staple", members: true, limit: 1_000 }
    ];
    const prices: LatestPrice[] = [
      { id: 1, low: 1_000, high: 1_500, lowTime: nowSeconds - 30, highTime: nowSeconds - 30 },
      { id: 2, low: 1_000, high: 1_100, lowTime: nowSeconds - 30, highTime: nowSeconds - 30 }
    ];
    const candidates = buildUpsideCandidates({
      items,
      prices,
      pointsByItem: new Map([
        [1, stableFiveMinutePoints({ low: 1_000, high: 1_500, matchedVolume: 500 })],
        [2, stableFiveMinutePoints({ low: 1_000, high: 1_100, matchedVolume: 5_000 })]
      ]),
      nowSeconds
    });

    expect(candidates.map((candidate) => candidate.id)).toEqual([1, 2]);
    expect(candidates[0].upsideAnalysis.riskAdjustedGpPerHour).toBeGreaterThan(
      candidates[1].upsideAnalysis.riskAdjustedGpPerHour
    );
    expect(filterAndSortUpsideFlips(candidates, { minOpportunityConfidence: 101 })).toEqual([]);
  });

  it("excludes unknown limits, stale pairs, sparse history, and zero matched activity", () => {
    const items: ItemMeta[] = [
      { id: 1, name: "Unknown limit", members: true },
      { id: 2, name: "Stale", members: true, limit: 1_000 },
      { id: 3, name: "Sparse", members: true, limit: 1_000 },
      { id: 4, name: "No activity", members: true, limit: 1_000 }
    ];
    const prices: LatestPrice[] = items.map((item) => ({
      id: item.id,
      low: 1_000,
      high: 1_200,
      lowTime: item.id === 2 ? nowSeconds - 1_000 : nowSeconds,
      highTime: nowSeconds
    }));
    const pointsByItem = new Map<number, PricePoint[]>([
      [1, stableFiveMinutePoints()],
      [2, stableFiveMinutePoints()],
      [3, stableFiveMinutePoints().slice(-100)],
      [4, stableFiveMinutePoints({ matchedVolume: 0 })]
    ]);

    expect(buildUpsideCandidates({ items, prices, pointsByItem, nowSeconds })).toEqual([]);
  });

  it("uses deterministic item-id ordering when upside metrics tie", () => {
    const items: ItemMeta[] = [
      { id: 2, name: "Second", members: true, limit: 1_000 },
      { id: 1, name: "First", members: true, limit: 1_000 }
    ];
    const prices: LatestPrice[] = items.map((item) => ({
      id: item.id,
      low: 1_000,
      high: 1_200,
      lowTime: nowSeconds,
      highTime: nowSeconds
    }));
    const points = stableFiveMinutePoints({ high: 1_200 });

    expect(buildUpsideCandidates({
      items,
      prices,
      pointsByItem: new Map([[1, points], [2, points]]),
      nowSeconds
    }).map((candidate) => candidate.id)).toEqual([1, 2]);
  });

  it("builds a bounded balanced shortlist", () => {
    const items = Array.from({ length: 120 }, (_, index): ItemMeta => ({
      id: index + 1,
      name: `Item ${index + 1}`,
      members: true,
      limit: 1_000
    }));
    const prices = items.map((item): LatestPrice => ({
      id: item.id,
      low: item.id === 120 ? 10 : 1_000,
      high: item.id === 120 ? 30 : 1_200 + item.id,
      lowTime: nowSeconds,
      highTime: nowSeconds
    }));
    const preliminary = buildFlipCandidates({ items, prices, nowSeconds });
    const shortlist = buildUpsideShortlist(preliminary, items.map((item) => ({
      id: item.id,
      highPriceVolume: item.id,
      lowPriceVolume: item.id
    })));

    expect(shortlist).toHaveLength(75);
    expect(shortlist.some((candidate) => candidate.id === 120)).toBe(true);
  });
});

function stableFiveMinutePoints({
  low = 1_000,
  high = 1_100,
  matchedVolume = 1_000
}: {
  low?: number;
  high?: number;
  matchedVolume?: number;
} = {}): PricePoint[] {
  return Array.from({ length: 288 }, (_, index) => ({
    timestamp: nowSeconds - (287 - index) * 300,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: matchedVolume,
    lowPriceVolume: matchedVolume
  }));
}
