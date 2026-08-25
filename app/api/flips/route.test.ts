import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({
  getItems: vi.fn(),
  getLatestPrices: vi.fn(),
  getTimeseries: vi.fn()
}));

import { getItems, getLatestPrices, getTimeseries } from "@/lib/osrsWiki";
import type { PricePoint } from "@/lib/types";

const mockedGetItems = vi.mocked(getItems);
const mockedGetLatestPrices = vi.mocked(getLatestPrices);
const mockedGetTimeseries = vi.mocked(getTimeseries);
const nowSeconds = 1_700_000_000;

describe("GET /api/flips", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetItems.mockResolvedValue([{ id: 1, name: "Air rune", members: false, limit: 30_000 }]);
    mockedGetLatestPrices.mockResolvedValue([
      { id: 1, low: 4, high: 6, lowTime: currentSeconds(), highTime: currentSeconds() }
    ]);
    mockedGetTimeseries.mockResolvedValue(stablePoints({ low: 4, high: 6, matchedVolume: 10_000 }));
  });

  it("returns filtered ranked flip candidates", async () => {
    const response = await GET(new Request("http://localhost/api/flips?search=air&minVolume=100"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: 1,
      name: "Air rune",
      buyPrice: 4,
      sellPrice: 6,
      netProfit: 2,
      volume: 240_000,
      confidence: 1,
      stability: 1,
      totalBuyLimitProfit: 60_000
    });
  });

  it("filters by market confidence", async () => {
    const response = await GET(new Request("http://localhost/api/flips?minConfidence=101"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data).toHaveLength(0);
  });

  it("includes low-confidence candidates by default and excludes them when weak data is disabled", async () => {
    mockedGetTimeseries.mockResolvedValue([]);

    const defaultResponse = await GET(new Request("http://localhost/api/flips"));
    const defaultPayload = await defaultResponse.json();
    const weakDataDisabledResponse = await GET(
      new Request("http://localhost/api/flips?includeStale=false&includeLowConfidence=false")
    );
    const weakDataDisabledPayload = await weakDataDisabledResponse.json();

    expect(defaultPayload.data).toHaveLength(1);
    expect(defaultPayload.data[0].confidence).toBe(0);
    expect(weakDataDisabledPayload.data).toHaveLength(0);
  });

  it("ranks by score by default", async () => {
    mockedGetItems.mockResolvedValue([
      { id: 1, name: "Big unstable spread", members: false, limit: 100 },
      { id: 2, name: "Steady rune", members: false, limit: 30_000 }
    ]);
    mockedGetLatestPrices.mockResolvedValue([
      { id: 1, low: 1_000, high: 1_400, lowTime: currentSeconds(), highTime: currentSeconds() },
      { id: 2, low: 100, high: 130, lowTime: currentSeconds(), highTime: currentSeconds() }
    ]);
    mockedGetTimeseries.mockImplementation(async (id) =>
      id === 1
        ? stablePoints({ low: 1_390, high: 1_400, matchedVolume: 100 })
        : stablePoints({ low: 100, high: 130, matchedVolume: 20_000 })
    );

    const response = await GET(new Request("http://localhost/api/flips"));
    const payload = await response.json();

    expect(payload.data.map((candidate: { id: number }) => candidate.id)).toEqual([2, 1]);
    expect(payload.data[0].score).toBeGreaterThan(payload.data[1].score);
    expect(payload.data[0].scoreBreakdown.score).toBe(payload.data[0].score);
  });

  it("includes high-ROI candidates in the balanced volume shortlist", async () => {
    const highProfitItems = Array.from({ length: 40 }, (_, index) => ({
      id: index + 1,
      name: `High profit ${index + 1}`,
      members: false,
      limit: 1_000
    }));
    const highRoiItem = { id: 999, name: "High ROI", members: false, limit: 1_000 };

    mockedGetItems.mockResolvedValue([...highProfitItems, highRoiItem]);
    mockedGetLatestPrices.mockResolvedValue([
      ...highProfitItems.map((item) => ({
        id: item.id,
        low: 10_000,
        high: 11_000 + item.id,
        lowTime: currentSeconds(),
        highTime: currentSeconds()
      })),
      { id: 999, low: 10, high: 30, lowTime: currentSeconds(), highTime: currentSeconds() }
    ]);

    await GET(new Request("http://localhost/api/flips"));

    expect(mockedGetTimeseries).toHaveBeenCalledWith(999, "1h");
  });
});

function stablePoints({
  low,
  high,
  matchedVolume
}: {
  low: number;
  high: number;
  matchedVolume: number;
}): PricePoint[] {
  return Array.from({ length: 24 }, (_, index) => ({
    timestamp: nowSeconds - (23 - index) * 3_600,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: matchedVolume,
    lowPriceVolume: matchedVolume
  }));
}

function currentSeconds(): number {
  return Math.floor(Date.now() / 1000);
}
