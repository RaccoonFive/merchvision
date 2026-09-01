import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./flipFinder", () => ({
  loadReliableCandidateUniverse: vi.fn(),
  loadUpsideCandidateUniverse: vi.fn()
}));
vi.mock("./osrsWiki", () => ({ getTimeseries: vi.fn() }));
vi.mock("./prisma", () => ({
  prisma: {
    flipObservation: {
      createMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn()
    }
  }
}));

import { loadReliableCandidateUniverse, loadUpsideCandidateUniverse } from "./flipFinder";
import { evaluateFlipObservation, runFlipCalibration } from "./flipCalibration";
import { prisma } from "./prisma";
import type { PricePoint } from "./types";

const mockedReliable = vi.mocked(loadReliableCandidateUniverse);
const mockedUpside = vi.mocked(loadUpsideCandidateUniverse);
const mockedDeleteMany = vi.mocked(prisma.flipObservation.deleteMany);
const mockedFindMany = vi.mocked(prisma.flipObservation.findMany);

describe("evaluateFlipObservation", () => {
  const observedAt = new Date("2026-09-01T00:00:00.000Z");
  const horizonEndsAt = new Date("2026-09-01T04:00:00.000Z");
  const observation = {
    observedAt,
    horizonEndsAt,
    buyPrice: 1_000,
    sellPrice: 1_200,
    netProfit: 176,
    estimatedUnitsPerHour: 10
  };

  it("requires a buy-side touch before a later sell-side touch", () => {
    const result = evaluateFlipObservation(observation, coveragePoints([
      pointAt(5, { low: 1_000, lowVolume: 10 }),
      pointAt(10, { high: 1_200, highVolume: 10 })
    ]));

    expect(result).toEqual({
      outcome: "completed",
      entryTouchedAt: new Date("2026-09-01T00:05:00.000Z"),
      exitTouchedAt: new Date("2026-09-01T00:10:00.000Z"),
      timeToCompletionMinutes: 5,
      proxyGpPerHour: 1_760
    });
  });

  it("treats same-bucket touches as ambiguous rather than completed", () => {
    const result = evaluateFlipObservation(observation, coveragePoints([
      pointAt(5, { low: 1_000, lowVolume: 10, high: 1_200, highVolume: 10 })
    ]));

    expect(result).toMatchObject({
      outcome: "ambiguous",
      exitTouchedAt: null,
      proxyGpPerHour: 0
    });
  });

  it("distinguishes no entry from an entry that never exits", () => {
    expect(evaluateFlipObservation(observation, coveragePoints([]))?.outcome).toBe("no_entry");
    expect(evaluateFlipObservation(observation, coveragePoints([
      pointAt(5, { low: 1_000, lowVolume: 10 })
    ]))?.outcome).toBe("entered_incomplete");
  });

  it("waits when source history does not yet cover the full horizon", () => {
    expect(evaluateFlipObservation(observation, [pointAt(5, { low: 1_000, lowVolume: 10 })])).toBeNull();
    expect(evaluateFlipObservation(observation, [{
      timestamp: Math.floor(horizonEndsAt.getTime() / 1000) + 60
    }])).toBeNull();
  });

  function coveragePoints(points: PricePoint[]): PricePoint[] {
    return [
      { timestamp: Math.floor(observedAt.getTime() / 1000) + 60 },
      ...points,
      { timestamp: Math.floor(horizonEndsAt.getTime() / 1000) }
    ];
  }

  function pointAt(minutes: number, values: {
    low?: number;
    lowVolume?: number;
    high?: number;
    highVolume?: number;
  }): PricePoint {
    return {
      timestamp: Math.floor(observedAt.getTime() / 1000) + minutes * 60,
      avgLowPrice: values.low,
      lowPriceVolume: values.lowVolume,
      avgHighPrice: values.high,
      highPriceVolume: values.highVolume
    };
  }
});

describe("runFlipCalibration", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedReliable.mockResolvedValue([]);
    mockedUpside.mockResolvedValue([]);
    mockedFindMany.mockResolvedValue([]);
    mockedDeleteMany.mockResolvedValue({ count: 2 });
  });

  it("uses a stable 15-minute bucket and prunes resolved rows after 90 days", async () => {
    const now = new Date("2026-09-01T12:07:42.000Z");
    const result = await runFlipCalibration(now);

    expect(result).toEqual({
      created: 0,
      resolved: 0,
      pruned: 2,
      bucketAt: "2026-09-01T12:00:00.000Z"
    });
    expect(mockedDeleteMany).toHaveBeenCalledWith({
      where: {
        status: "resolved",
        resolvedAt: { lt: new Date("2026-06-03T12:07:42.000Z") }
      }
    });
  });
});
