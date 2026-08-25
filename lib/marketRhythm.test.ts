import { describe, expect, it } from "vitest";
import { analyzeMarketRhythm } from "./marketRhythm";
import type { PricePoint } from "./types";

describe("analyzeMarketRhythm", () => {
  it("keeps complete hourly observations and exposes conservative market-quality measures", () => {
    const points: PricePoint[] = [
      { timestamp: 1, avgHighPrice: 1_100, avgLowPrice: 1_000, highPriceVolume: 200, lowPriceVolume: 150 },
      { timestamp: 2, avgHighPrice: 900, avgLowPrice: 1_000, highPriceVolume: 100, lowPriceVolume: 80 },
      { timestamp: 3, avgHighPrice: 1_200, avgLowPrice: 1_000, highPriceVolume: 300 },
      { timestamp: 4, avgHighPrice: 1_300 }
    ];

    expect(analyzeMarketRhythm(points)).toEqual({
      samples: [
        { timestamp: 1, netMargin: 78, matchedVolume: 150 },
        { timestamp: 2, netMargin: -118, matchedVolume: 80 },
        { timestamp: 3, netMargin: 176, matchedVolume: null }
      ],
      sampleCount: 3,
      sourcePointCount: 4,
      positiveSpreadRatio: 0.6667,
      medianMatchedHourlyVolume: 115,
      midpointPriceVolatility: 0.0594
    });
  });

  it("returns explicit empty measures when no usable hourly prices exist", () => {
    expect(analyzeMarketRhythm([{ timestamp: 1, avgHighPrice: 100 }])).toEqual({
      samples: [],
      sampleCount: 0,
      sourcePointCount: 1,
      positiveSpreadRatio: 0,
      medianMatchedHourlyVolume: null,
      midpointPriceVolatility: 0
    });
  });
});
