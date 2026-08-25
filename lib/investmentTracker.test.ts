import { describe, expect, it } from "vitest";
import { buildInvestmentTracker, parseInvestmentLotInput, parseInvestmentLotUpdate } from "./investmentTracker";
import type { ItemMeta, LatestPrice } from "./types";

const nowSeconds = 1_700_000_000;
const items: ItemMeta[] = [
  { id: 1, name: "Air rune", members: false },
  { id: 2, name: "Dragon bones", members: true }
];

function lot(overrides: Partial<{
  id: string;
  itemId: number;
  quantity: number;
  unitPricePaid: number;
}> = {}) {
  return {
    id: overrides.id ?? "lot-1",
    itemId: overrides.itemId ?? 1,
    quantity: overrides.quantity ?? 100,
    unitPricePaid: overrides.unitPricePaid ?? 5,
    createdAt: new Date("2026-08-25T12:00:00.000Z"),
    updatedAt: new Date("2026-08-25T12:00:00.000Z")
  };
}

describe("buildInvestmentTracker", () => {
  it("calculates profitable and losing lots from net instant-sell value", () => {
    const prices: LatestPrice[] = [
      { id: 1, low: 10, lowTime: nowSeconds },
      { id: 2, low: 1_000, lowTime: nowSeconds }
    ];
    const result = buildInvestmentTracker([
      lot(),
      lot({ id: "lot-2", itemId: 2, quantity: 2, unitPricePaid: 1_100 })
    ], items, prices, nowSeconds);

    expect(result.data[0]).toMatchObject({
      instantSellPrice: 10,
      taxPerUnit: 0,
      netLiquidationPrice: 10,
      totalCost: 500,
      currentNetValue: 1_000,
      currentProfit: 500,
      roi: 1
    });
    expect(result.data[1]).toMatchObject({
      taxPerUnit: 20,
      totalCost: 2_200,
      currentNetValue: 1_960,
      currentProfit: -240
    });
    expect(result.meta).toMatchObject({
      lotCount: 2,
      totalCost: 2_700,
      valuedCost: 2_700,
      currentNetValue: 2_960,
      currentProfit: 260,
      unavailableLotCount: 0,
      isPartial: false
    });
    expect(result.meta.roi).toBeCloseTo(260 / 2_700);
  });

  it("applies the GE tax cap per unit", () => {
    const [tracked] = buildInvestmentTracker(
      [lot({ quantity: 2, unitPricePaid: 300_000_000 })],
      items,
      [{ id: 1, low: 300_000_000, lowTime: nowSeconds }],
      nowSeconds
    ).data;

    expect(tracked.taxPerUnit).toBe(5_000_000);
    expect(tracked.currentNetValue).toBe(590_000_000);
    expect(tracked.currentProfit).toBe(-10_000_000);
  });

  it("preserves lots and reports partial totals when quotes or metadata are missing", () => {
    const result = buildInvestmentTracker([
      lot(),
      lot({ id: "lot-2", itemId: 999, quantity: 10, unitPricePaid: 50 })
    ], items, [{ id: 1, low: 10, lowTime: nowSeconds }], nowSeconds);

    expect(result.data).toHaveLength(2);
    expect(result.data[1]).toMatchObject({ item: null, currentNetValue: null, currentProfit: null });
    expect(result.data[1].warnings).toEqual(expect.arrayContaining([
      "Item metadata is unavailable.",
      "Current instant-sell price is unavailable."
    ]));
    expect(result.meta).toMatchObject({
      totalCost: 1_000,
      valuedCost: 500,
      currentNetValue: 1_000,
      currentProfit: 500,
      unavailableLotCount: 1,
      isPartial: true
    });
  });

  it("warns on stale quotes and keeps separate lots for the same item", () => {
    const result = buildInvestmentTracker([
      lot(),
      lot({ id: "lot-2", quantity: 25, unitPricePaid: 7 })
    ], items, [{ id: 1, low: 10, lowTime: nowSeconds - 3_601 }], nowSeconds);

    expect(result.data).toHaveLength(2);
    expect(result.data.every((tracked) => tracked.warnings.includes("Instant-sell quote is over one hour old."))).toBe(true);
  });
});

describe("investment lot input validation", () => {
  it("accepts positive whole-number inputs", () => {
    expect(parseInvestmentLotInput({ itemId: 1, quantity: 10, unitPricePaid: 500 })).toEqual({
      data: { itemId: 1, quantity: 10, unitPricePaid: 500 }
    });
    expect(parseInvestmentLotUpdate({ quantity: 5, unitPricePaid: 400 })).toEqual({
      data: { quantity: 5, unitPricePaid: 400 }
    });
  });

  it("rejects missing, fractional, non-positive, and oversized values", () => {
    expect(parseInvestmentLotInput(null)).toHaveProperty("error");
    expect(parseInvestmentLotInput({ itemId: 1, quantity: 1.5, unitPricePaid: 10 })).toHaveProperty("error");
    expect(parseInvestmentLotInput({ itemId: 1, quantity: 0, unitPricePaid: 10 })).toHaveProperty("error");
    expect(parseInvestmentLotInput({ itemId: 1, quantity: 1, unitPricePaid: 2_147_483_648 })).toHaveProperty("error");
    expect(parseInvestmentLotUpdate({ quantity: 2_147_483_647, unitPricePaid: 2_147_483_647 })).toHaveProperty("error");
  });
});
