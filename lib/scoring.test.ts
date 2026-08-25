import { describe, expect, it } from "vitest";
import { analyzeMarket, buildFlipCandidates, filterAndSortFlips, scoreFlip } from "./scoring";
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

  it("adds risk warnings for stale quotes, missing history, and unknown limits", () => {
    const candidates = buildFlipCandidates({ items, prices, nowSeconds });
    const stale = candidates.find((candidate) => candidate.id === 3);

    expect(stale?.warnings).toContain("Unknown buy limit");
    expect(stale?.warnings).toContain("Seven-day history not analyzed");
    expect(stale?.warnings).toContain("Stale quotes");
  });

  it("returns score components that reproduce the aggregate score", () => {
    const analysis = analyzeMarket(stablePoints());
    const [candidate] = buildFlipCandidates({
      items,
      prices,
      volumesByItem: new Map([[1, 10_000]]),
      analysesByItem: new Map([[1, analysis]]),
      nowSeconds
    });
    const componentTotal = candidate.scoreBreakdown.components.reduce(
      (total, component) => total + component.points,
      0
    );

    expect(candidate.scoreBreakdown.rawScore).toBe(componentTotal);
    expect(candidate.scoreBreakdown.score).toBe(candidate.score);
    expect(candidate.score).toBe(Math.min(100, Math.max(0, Math.round(componentTotal))));
    expect(candidate.scoreBreakdown.components.map((component) => component.label)).toEqual(
      expect.arrayContaining([
        "Conservative estimated GP/hour",
        "Repeatable net margin",
        "Historical confidence",
        "Seven-day spread stability"
      ])
    );
    expect(candidate.repeatableNetProfit).toBe(38);
    expect(candidate.conservativeExpectedGpPerHour).toBe(3_800);
  });

  it("ranks a liquid repeatable margin above an isolated current windfall", () => {
    const comparisonItems: ItemMeta[] = [
      { id: 10, name: "Thin windfall", members: false, limit: 10_000 },
      { id: 11, name: "Steady market", members: false, limit: 10_000 }
    ];
    const comparisonPrices: LatestPrice[] = [
      { id: 10, low: 1_000, high: 2_000, lowTime: nowSeconds, highTime: nowSeconds },
      { id: 11, low: 1_000, high: 1_200, lowTime: nowSeconds, highTime: nowSeconds }
    ];
    const analyses = new Map([
      [10, analyzeMarket(stablePoints({ low: 1_000, high: 1_050, matchedVolume: 50 }), 10_000)],
      [11, analyzeMarket(stablePoints({ low: 1_000, high: 1_200, matchedVolume: 10_000 }), 10_000)]
    ]);

    const ranked = filterAndSortFlips(buildFlipCandidates({
      items: comparisonItems,
      prices: comparisonPrices,
      analysesByItem: analyses,
      nowSeconds
    }), {});

    expect(ranked.map((candidate) => candidate.id)).toEqual([11, 10]);
    expect(ranked[1].repeatableNetProfit).toBe(29);
    expect(ranked[1].warnings).toContain("Current margin is far above its seven-day norm");
  });

  it("warns when seven-day history has no profitable median", () => {
    const analysis = analyzeMarket(stablePoints({ low: 100, high: 101, matchedVolume: 1_000 }));
    const [candidate] = buildFlipCandidates({
      items: [{ id: 1, name: "Occasional margin", members: false, limit: 1_000 }],
      prices: [{ id: 1, low: 100, high: 300, lowTime: nowSeconds, highTime: nowSeconds }],
      analysesByItem: new Map([[1, analysis]]),
      nowSeconds
    });

    expect(candidate.repeatableNetProfit).toBe(0);
    expect(candidate.conservativeExpectedGpPerHour).toBe(0);
    expect(candidate.warnings).toContain("Seven-day median margin is not profitable");
  });

  it("adds the spike warning at twice the median and a 100 GP premium", () => {
    const analysis = analyzeMarket(stablePoints({ low: 880, high: 1_000, matchedVolume: 1_000 }));
    const warningItems: ItemMeta[] = [
      { id: 20, name: "At warning threshold", members: false, limit: 1_000 },
      { id: 21, name: "Below warning threshold", members: false, limit: 1_000 }
    ];
    const candidates = buildFlipCandidates({
      items: warningItems,
      prices: [
        { id: 20, low: 780, high: 1_000, lowTime: nowSeconds, highTime: nowSeconds },
        { id: 21, low: 781, high: 1_000, lowTime: nowSeconds, highTime: nowSeconds }
      ],
      analysesByItem: new Map([[20, analysis], [21, analysis]]),
      nowSeconds
    });

    expect(candidates[0].warnings).toContain("Current margin is far above its seven-day norm");
    expect(candidates[1].warnings).not.toContain("Current margin is far above its seven-day norm");
  });

  it("returns unavailable repeatability metrics and no upside when history is missing", () => {
    const [candidate] = buildFlipCandidates({ items, prices, nowSeconds });

    expect(candidate.repeatableNetProfit).toBeNull();
    expect(candidate.conservativeExpectedGpPerHour).toBeNull();
    expect(candidate.score).toBe(0);
    expect(candidate.warnings).toContain("Seven-day history not analyzed");
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
      includeLowConfidence: true,
      sort: "profit"
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it("includes stale and low-confidence candidates unless explicitly excluded", () => {
    const analysis = analyzeMarket(stablePoints());
    const candidates = buildFlipCandidates({
      items,
      prices,
      volumesByItem: new Map([[1, 10_000]]),
      analysesByItem: new Map([[1, analysis]]),
      nowSeconds
    });
    const reliableCandidate = candidates.find((candidate) => candidate.id === 1)!;
    const lowConfidenceFreshCandidate = {
      ...reliableCandidate,
      id: 99,
      confidence: 0.44,
      freshnessSeconds: 0
    };

    expect(filterAndSortFlips([...candidates, lowConfidenceFreshCandidate], {}).map((candidate) => candidate.id)).toEqual(
      expect.arrayContaining([1, 3, 99])
    );
    expect(
      filterAndSortFlips([...candidates, lowConfidenceFreshCandidate], {
        includeStale: false,
        includeLowConfidence: false
      }).map((candidate) => candidate.id)
    ).toEqual([1]);
  });
});

describe("analyzeMarket", () => {
  it("summarizes stable hourly market samples", () => {
    const points = Array.from({ length: 168 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (167 - index) * 3_600,
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
      sampleCount: 168,
      sampleCoverage: 1,
      estimatedExecutableUnitsPerHour: 150,
      rawExpectedGpPerHour: 11_700,
      confidence: 1,
      volatilityPenalty: 0
    });
  });

  it("caps executable units by the hourly buy-limit allowance", () => {
    const points = Array.from({ length: 168 }, (_, index): PricePoint => ({
      timestamp: nowSeconds - (167 - index) * 3_600,
      avgHighPrice: 1_100,
      avgLowPrice: 1_000,
      highPriceVolume: 20_000,
      lowPriceVolume: 15_000
    }));

    const analysis = analyzeMarket(points, 200);

    expect(analysis.estimatedExecutableUnitsPerHour).toBe(50);
    expect(analysis.rawExpectedGpPerHour).toBe(3_900);
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
      sampleCoverage: 0.0119,
      estimatedExecutableUnitsPerHour: 0,
      rawExpectedGpPerHour: 0,
      confidence: 0.1351
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
      volatilityPenalty: 0.4
    });
  });

  it("uses the seven-day median instead of one or two margin spikes", () => {
    const normal = stablePoints({ low: 1_000, high: 1_100, matchedVolume: 10_000 }).slice(0, 166);
    const spikes: PricePoint[] = [
      { timestamp: nowSeconds - 3_600, avgHighPrice: 5_000, avgLowPrice: 1_000, highPriceVolume: 10, lowPriceVolume: 10 },
      { timestamp: nowSeconds, avgHighPrice: 6_000, avgLowPrice: 1_000, highPriceVolume: 10, lowPriceVolume: 10 }
    ];
    const analysis = analyzeMarket([...normal, ...spikes], 10_000);

    expect(analysis.historicalNetMarginMedian).toBe(78);
    expect(analysis.medianMatchedHourlyVolume).toBe(10_000);
    expect(analysis.sampleCount).toBe(168);
  });

  it("treats 84 samples as full sample confidence but only half coverage", () => {
    const analysis = analyzeMarket(stablePoints().slice(0, 84));

    expect(analysis.sampleCount).toBe(84);
    expect(analysis.sampleCoverage).toBe(0.5);
    expect(analysis.confidence).toBe(0.825);
  });
});

describe("scoreFlip", () => {
  const analysis = analyzeMarket(stablePoints({ low: 1_000, high: 1_200, matchedVolume: 10_000 }), 10_000);

  it("starts the spike penalty above 1.5 times the seven-day median", () => {
    const atThreshold = scoreFlip({
      netProfit: analysis.historicalNetMarginMedian * 1.5,
      buyPrice: 1_000,
      freshnessSeconds: 900,
      buyLimit: 10_000,
      marketAnalysis: analysis
    });
    const aboveThreshold = scoreFlip({
      netProfit: analysis.historicalNetMarginMedian * 3,
      buyPrice: 1_000,
      freshnessSeconds: 900,
      buyLimit: 10_000,
      marketAnalysis: analysis
    });

    expect(atThreshold.components.find((component) => component.label === "Current-margin spike")).toBeUndefined();
    expect(aboveThreshold.components.find((component) => component.label === "Current-margin spike")?.points).toBe(-15);
  });

  it("caps freshness and spike penalties and penalizes an unknown limit", () => {
    const score = scoreFlip({
      netProfit: analysis.historicalNetMarginMedian * 10,
      buyPrice: 1_000,
      freshnessSeconds: 7_200,
      marketAnalysis: analysis
    });

    expect(score.components).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Quote freshness", points: -20 }),
      expect.objectContaining({ label: "Current-margin spike", points: -25 }),
      expect.objectContaining({ label: "Unknown buy limit", points: -5 })
    ]));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(100);
  });
});

function stablePoints({
  low = 100,
  high = 140,
  matchedVolume = 10_000
}: {
  low?: number;
  high?: number;
  matchedVolume?: number;
} = {}): PricePoint[] {
  return Array.from({ length: 168 }, (_, index) => ({
    timestamp: nowSeconds - (167 - index) * 3_600,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: matchedVolume,
    lowPriceVolume: matchedVolume
  }));
}
