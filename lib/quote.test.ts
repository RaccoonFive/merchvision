import { describe, expect, it } from "vitest";
import { buildItemQuote, buildItemQuoteWarnings } from "./quote";

describe("buildItemQuote", () => {
  it("calculates positive, negative, and zero margins without excluding them", () => {
    expect(buildItemQuote({ id: 1, high: 120, low: 100, highTime: 990, lowTime: 980 }, 1_000)).toMatchObject({
      margin: 20,
      tax: 2,
      netProfit: 18,
      roi: 0.18,
      freshnessSeconds: 10
    });
    expect(buildItemQuote({ id: 1, high: 90, low: 100 }, 1_000)).toMatchObject({
      margin: -10,
      tax: 1,
      netProfit: -11,
      roi: -0.11
    });
    expect(buildItemQuote({ id: 1, high: 100, low: 100 }, 1_000)).toMatchObject({
      margin: 0,
      tax: 2,
      netProfit: -2,
      roi: -0.02
    });
  });

  it("returns partial quote data with unavailable calculations", () => {
    expect(buildItemQuote({ id: 1, high: 120, highTime: 990 }, 1_000)).toEqual({
      high: 120,
      low: null,
      highTime: 990,
      lowTime: null,
      margin: null,
      tax: null,
      netProfit: null,
      roi: null,
      freshnessSeconds: 10
    });
  });

  it("warns without excluding negative, stale, and incomplete quotes", () => {
    const quote = buildItemQuote({ id: 1, high: 90, highTime: 1, low: 100, lowTime: 1 }, 4_000);
    expect(buildItemQuoteWarnings(quote)).toEqual([
      "The latest quotes produce a negative margin after GE tax.",
      "The freshest quote is over one hour old and may not reflect the current market."
    ]);

    expect(buildItemQuoteWarnings(buildItemQuote({ id: 1, high: 90 }))).toContain(
      "This item does not currently have both a high and low quote, so its margin is unavailable."
    );
  });
});
