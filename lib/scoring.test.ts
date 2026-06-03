import { describe, expect, it } from "vitest";
import { buildFlipCandidates, filterAndSortFlips } from "./scoring";
import type { ItemMeta, LatestPrice } from "./types";

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
