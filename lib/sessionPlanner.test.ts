import { describe, expect, it } from "vitest";
import { analyzeMarket, buildFlipCandidates } from "./scoring";
import { buildSessionPlan, validateSessionInputs, type SessionInputs } from "./sessionPlanner";
import type { FlipCandidate } from "./types";

const now = 1_700_000_000;
const inputs: SessionInputs = { budget: 100_000, slots: 4, sessionMinutes: 60, checkIntervalMinutes: 15, members: "all" };

function candidate(id = 1, overrides: Partial<FlipCandidate> = {}): FlipCandidate {
  const analysis = analyzeMarket(Array.from({ length: 168 }, (_, index) => ({
    timestamp: now - (167 - index) * 3600,
    avgLowPrice: 100, avgHighPrice: 140, highPriceVolume: 100_000, lowPriceVolume: 100_000
  })), 4_000);
  return {
    ...buildFlipCandidates({
      items: [{ id, name: `Item ${id}`, members: false, limit: 4_000 }],
      prices: [{ id, low: 100, high: 140, highTime: now - 30, lowTime: now - 60 }],
      analysesByItem: new Map([[id, analysis]]), nowSeconds: now
    })[0], ...overrides
  };
}

describe("session planner", () => {
  it("sizes a single after-tax batch with a reserve and equal per-item capital caps", () => {
    const plan = buildSessionPlan([candidate(4), candidate(3), candidate(2), candidate(1)], inputs, now);
    expect(plan.allocations.map((row) => row.candidate.id)).toEqual([1, 2, 3, 4]);
    expect(plan.allocations[0]).toMatchObject({ quantity: 200, capital: 20_000, netProfitPerUnit: 38, estimatedBatchProfit: 7_600, limitingFactor: "Capital cap" });
    expect(plan).toMatchObject({ reserve: 20_000, perItemCapitalCap: 20_000, allocatedCapital: 80_000, unallocatedCapital: 20_000, estimatedBatchProfit: 30_400 });
  });

  it("keeps single-item exposure below 25% rather than forcing the budget into one market", () => {
    const plan = buildSessionPlan([candidate()], { ...inputs, slots: 1 }, now);
    expect(plan.allocatedCapital).toBe(25_000);
    expect(plan.unallocatedCapital).toBe(75_000);
  });

  it("caps quantity by historical capacity and reduces exposure for infrequent checks", () => {
    const candidates = [candidate()];
    const largeBudget = { ...inputs, budget: 1_000_000 };
    const frequent = buildSessionPlan(candidates, largeBudget, now);
    const half = buildSessionPlan(candidates, { ...largeBudget, checkIntervalMinutes: 30 }, now);
    const quarter = buildSessionPlan(candidates, { ...largeBudget, checkIntervalMinutes: 60 }, now);
    expect(frequent.allocations[0]).toMatchObject({ quantity: 500, limitingFactor: "Market capacity" });
    expect(half.allocations[0].quantity).toBe(250);
    expect(quarter.allocations[0].quantity).toBe(125);
  });

  it("allows longer capacity windows without exceeding the buy limit or assuming repeated cycles", () => {
    const c = candidate(1, { buyLimit: 100 });
    const plan = buildSessionPlan([c], { ...inputs, budget: 10_000_000, sessionMinutes: 240 }, now);
    expect(plan.allocations[0]).toMatchObject({ quantity: 100, limitingFactor: "Buy limit", estimatedBatchProfit: 3_800 });
  });

  it("caps the profit scenario at the lower historical or current net margin", () => {
    const c = candidate(1, { repeatableNetProfit: 10, netProfit: 50 });
    expect(buildSessionPlan([c], inputs, now).allocations[0].estimatedBatchProfit).toBe(2_000);
    expect(buildSessionPlan([candidate(1, { repeatableNetProfit: 50, netProfit: 10 })], inputs, now).allocations[0].netProfitPerUnit).toBe(10);
  });

  it("rejects weak history, unknown limits, stale or skewed quotes, and invalid evidence", () => {
    const base = candidate();
    const invalid = [
      candidate(1, { marketAnalysis: undefined }), candidate(2, { buyLimit: undefined }),
      candidate(3, { confidence: 0.59 }), candidate(4, { stability: 0.59 }),
      candidate(5, { lowTime: now - 901 }), candidate(6, { highTime: now + 1 }),
      candidate(7, { marketAnalysis: { ...base.marketAnalysis!, sampleCoverage: 0.49 } }),
      candidate(8, { marketAnalysis: { ...base.marketAnalysis!, positiveSpreadRatio: 0.79 } }),
      candidate(9, { repeatableNetProfit: null }), candidate(10, { netProfit: -1 }),
      candidate(11, { buyPrice: NaN }), candidate(12, { confidence: NaN }),
      candidate(13, { marketAnalysis: { ...base.marketAnalysis!, estimatedExecutableUnitsPerHour: 0 } })
    ];
    expect(buildSessionPlan(invalid, inputs, now).allocations).toEqual([]);
    expect(buildSessionPlan([candidate(1, { lowTime: now - 900, highTime: now, confidence: 0.6, stability: 0.6 })], inputs, now).allocations).toHaveLength(1);
  });

  it("recomputes quote age from source timestamps rather than trusting cached freshness", () => {
    expect(buildSessionPlan([candidate(1, { freshnessSeconds: 0 })], inputs, now + 901).allocations).toEqual([]);
  });

  it("filters free-to-play eligibility and skips unaffordable or sub-unit candidates", () => {
    const base = candidate();
    const list = [candidate(1, { members: true }), candidate(2, { buyPrice: 30_000 }),
      candidate(3, { marketAnalysis: { ...base.marketAnalysis!, estimatedExecutableUnitsPerHour: 1 } }), candidate(4)];
    expect(buildSessionPlan(list, { ...inputs, members: "f2p" }, now).allocations.map((row) => row.candidate.id)).toEqual([4]);
  });

  it("retains Reliable ordering, deduplicates items, and never changes source rankings or inputs", () => {
    const list = [candidate(1, { score: 60 }), candidate(3, { score: 90 }), candidate(2, { score: 90 }), candidate(2, { score: 90 })];
    const before = structuredClone(list);
    expect(buildSessionPlan(list, { ...inputs, slots: 2 }, now).allocations.map((row) => row.candidate.id)).toEqual([2, 3]);
    expect(list).toEqual(before);
    expect(buildSessionPlan(list, { ...inputs, budget: 1 }, now)).toMatchObject({ allocatedCapital: 0, unallocatedCapital: 1 });
  });

  it("always respects budget, slots, whole units and remaining capital across input boundaries", () => {
    const list = Array.from({ length: 10 }, (_, i) => candidate(i + 1));
    for (const budget of [1, 399, 10_001, 100_003, 1_000_000_000_000]) {
      for (const slots of [1, 3, 8]) {
        const plan = buildSessionPlan(list, { ...inputs, budget, slots }, now);
        expect(plan.allocations.length).toBeLessThanOrEqual(slots);
        expect(plan.allocatedCapital + plan.unallocatedCapital).toBe(budget);
        expect(plan.unallocatedCapital).toBeGreaterThanOrEqual(plan.reserve);
        for (const allocation of plan.allocations) {
          expect(Number.isInteger(allocation.quantity)).toBe(true);
          expect(allocation.quantity).toBeGreaterThan(0);
          expect(allocation.capital).toBeLessThanOrEqual(plan.perItemCapitalCap);
        }
      }
    }
  });

  it.each([
    { budget: 0 }, { budget: -1 }, { budget: 1.5 }, { budget: NaN }, { budget: Infinity }, { budget: 1_000_000_000_001 },
    { slots: 0 }, { slots: 9 }, { slots: 1.5 }, { sessionMinutes: 0 }, { sessionMinutes: 300 },
    { checkIntervalMinutes: 0 }, { checkIntervalMinutes: 20 }, { members: "unknown" }
  ])("validates input boundaries: %j", (override) => {
    const invalid = { ...inputs, ...override } as SessionInputs;
    expect(validateSessionInputs(invalid)).not.toBeNull();
    expect(() => buildSessionPlan([], invalid, now)).toThrow();
  });
});
