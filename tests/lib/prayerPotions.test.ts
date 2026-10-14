import { describe, expect, it } from "vitest";
import { comparePrayerPotions, getPrayerPotionPrices } from "@/lib/prayerPotions";

const prices = [
  { id: 2434, price: 9600, timestamp: 10_000 },
  { id: 3024, price: 9900, timestamp: 10_000 }
];

describe("Prayer potion value", () => {
  it.each([
    [1, 1, 1], [8, 8, 8], [11, 9, 10], [12, 10, 11],
    [70, 24, 25], [71, 24, 25], [72, 25, 26], [99, 31, 32]
  ])("rounds doses down and caps restoration at level %i", (level, prayer, restore) => {
    const result = comparePrayerPotions(level, prices, 10_100)!;
    expect(result.potions.map((potion) => potion.pointsPerDose)).toEqual([prayer, restore]);
    expect(result.potions.map((potion) => potion.pointsPerPotion)).toEqual([prayer * 4, restore * 4]);
  });

  it("selects value per point rather than the cheaper bottle", () => {
    const result = comparePrayerPotions(70, prices, 10_100)!;
    expect(result.winnerId).toBe(3024);
    expect(result.potions[0]).toMatchObject({ pointsPerGp: 0.01, gpPerPoint: 100 });
    expect(result.potions[1].gpPerPoint).toBe(99);
    expect(result.savingsFraction).toBeCloseTo(0.01);
  });

  it("changes the winner as Prayer level changes", () => {
    const snapshot = [prices[0], { ...prices[1], price: 9950 }];
    expect(comparePrayerPotions(70, snapshot, 10_100)!.winnerId).toBe(3024);
    expect(comparePrayerPotions(99, snapshot, 10_100)!.winnerId).toBe(2434);
  });

  it("handles an exact tie without rounding the comparison", () => {
    const tie = [prices[0], { ...prices[1], price: 10_000 }];
    expect(comparePrayerPotions(70, tie, 10_100)).toMatchObject({ tied: true, winnerId: null, savingsFraction: 0 });
    expect(comparePrayerPotions(70, [prices[0], { ...prices[1], price: 10_001 }], 10_100)!.winnerId).toBe(2434);
  });

  it.each([0, 100, 70.5, NaN, Infinity])("rejects invalid level %s", (level) => {
    expect(comparePrayerPotions(level, prices, 10_100)).toBeNull();
  });

  it.each([null, 0, -1, NaN, Infinity])("does not rank unavailable or invalid price %s", (price) => {
    const result = comparePrayerPotions(70, [prices[0], { ...prices[1], price }], 10_100)!;
    expect(result).toMatchObject({ winnerId: null, tied: false, savingsFraction: null });
    expect(result.potions[1]).toMatchObject({ price: null, pointsPerGp: null, gpPerPoint: null });
  });

  it("handles absent items and stale or unknown timestamps", () => {
    expect(comparePrayerPotions(70, [], 10_100)!.winnerId).toBeNull();
    expect(comparePrayerPotions(70, prices, 13_600)!.potions[0].stale).toBe(false);
    expect(comparePrayerPotions(70, prices, 13_601)!.potions[0].stale).toBe(true);
    expect(comparePrayerPotions(70, [{ ...prices[0], timestamp: null }], 10_100)!.potions[0]).toMatchObject({ ageSeconds: null, stale: true });
  });

  it("uses only the two instant-buy quotes without tax or a low-price fallback", () => {
    expect(getPrayerPotionPrices([
      { id: 2434, high: 9600, highTime: 10_000, low: 9000 },
      { id: 3024, low: 9800, lowTime: 10_000 },
      { id: 999, high: 1 }
    ])).toEqual([prices[0], { id: 3024, price: null, timestamp: null }]);
  });
});
