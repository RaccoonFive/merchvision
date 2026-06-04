import { describe, expect, it } from "vitest";
import {
  analyzeInvestment,
  buildInvestmentCandidates,
  filterAndSortInvestments,
  logReturnVolatility,
  midpointPoints,
  positiveReturnRatio,
  regressionTrend
} from "./investments";
import type { PricePoint } from "./types";

const hour = 60 * 60;
const now = 1_700_000_000;

function history(multiplier = 1.001, count = 168): PricePoint[] {
  return Array.from({ length: count }, (_, index) => {
    const midpoint = 100 * multiplier ** index;
    return {
      timestamp: now - (count - 1 - index) * hour,
      avgHighPrice: midpoint + 1,
      avgLowPrice: midpoint - 1
    };
  });
}

describe("investment analysis", () => {
  it("constructs midpoints and ignores incomplete or invalid prices", () => {
    expect(midpointPoints([
      { timestamp: 2, avgHighPrice: 120, avgLowPrice: 100 },
      { timestamp: 1, avgHighPrice: 100 },
      { timestamp: 3, avgHighPrice: 0, avgLowPrice: 100 }
    ])).toEqual([{ timestamp: 2, midpoint: 110 }]);
  });

  it("calculates positive regression trends, volatility, and consistency", () => {
    const points = midpointPoints(history());
    expect(regressionTrend(points)).toBeGreaterThan(0);
    expect(logReturnVolatility(points)).toBeCloseTo(0);
    expect(positiveReturnRatio(points)).toBe(1);
  });

  it("qualifies a positive trend with sufficient coverage", () => {
    const analysis = analyzeInvestment(history(), now);
    expect(analysis).toMatchObject({ confidence: 1, consistency: 1, sampleCount: 168 });
    expect(analysis?.shortTrend).toBeGreaterThan(0);
    expect(analysis?.mediumTrend).toBeGreaterThan(analysis?.shortTrend ?? 0);
  });

  it("rejects flat, negative, and insufficient histories", () => {
    expect(analyzeInvestment(history(1), now)).toBeNull();
    expect(analyzeInvestment(history(0.999), now)).toBeNull();
    expect(analyzeInvestment(history(1.001, 40), now)).toBeNull();
  });

  it("penalizes volatile spikes in deterministic scoring", () => {
    const stable = history();
    const volatile = history().map((point, index) => ({
      ...point,
      avgHighPrice: (point.avgHighPrice ?? 0) * (index % 2 ? 1.08 : 0.94),
      avgLowPrice: (point.avgLowPrice ?? 0) * (index % 2 ? 1.08 : 0.94)
    }));
    const items = [
      { id: 1, name: "Stable", members: false },
      { id: 2, name: "Volatile", members: false }
    ];
    const summaries = [
      { id: 1, highPriceVolume: 10_000, lowPriceVolume: 10_000 },
      { id: 2, highPriceVolume: 10_000, lowPriceVolume: 10_000 }
    ];
    const candidates = buildInvestmentCandidates({
      items,
      summaries,
      histories: new Map([[1, stable], [2, volatile]])
    });

    expect(candidates.find((candidate) => candidate.id === 1)?.score)
      .toBeGreaterThan(candidates.find((candidate) => candidate.id === 2)?.score ?? 0);
  });

  it("filters and sorts candidates by investment metrics", () => {
    const candidates = buildInvestmentCandidates({
      items: [
        { id: 1, name: "Air rune", members: false },
        { id: 2, name: "Dragon item", members: true }
      ],
      summaries: [
        { id: 1, highPriceVolume: 20_000, lowPriceVolume: 15_000 },
        { id: 2, highPriceVolume: 1_000, lowPriceVolume: 1_000 }
      ],
      histories: new Map([[1, history(1.002)], [2, history()]])
    });

    expect(filterAndSortInvestments(candidates, {
      search: "air",
      members: "f2p",
      minVolume: 10_000,
      sort: "mediumTrend"
    }).map((candidate) => candidate.id)).toEqual([1]);
  });

  it("handles zero matched volume", () => {
    const [candidate] = buildInvestmentCandidates({
      items: [{ id: 1, name: "No volume", members: false }],
      summaries: [{ id: 1, highPriceVolume: 0, lowPriceVolume: 0 }],
      histories: new Map([[1, history()]])
    });
    expect(candidate.matchedVolume).toBe(0);
    expect(candidate.warnings).toContain("Thin matched volume");
  });
});
