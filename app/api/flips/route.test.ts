import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({
  get24hPrices: vi.fn(),
  getItems: vi.fn(),
  getLatestPrices: vi.fn(),
  getTimeseries: vi.fn()
}));

import { get24hPrices, getItems, getLatestPrices, getTimeseries } from "@/lib/osrsWiki";
import type { PricePoint } from "@/lib/types";

const mockedGet24hPrices = vi.mocked(get24hPrices);
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
    mockedGet24hPrices.mockResolvedValue([
      { id: 1, avgLowPrice: 4, avgHighPrice: 6, lowPriceVolume: 10_000, highPriceVolume: 10_000 }
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

  it("includes a highly liquid item outside the top current-profit and ROI groups", async () => {
    const marketItems = Array.from({ length: 130 }, (_, index) => ({
      id: index + 1,
      name: `Market ${index + 1}`,
      members: false,
      limit: 10_000
    }));
    mockedGetItems.mockResolvedValue(marketItems);
    mockedGetLatestPrices.mockResolvedValue(marketItems.map((item) => item.id === 130
      ? { id: item.id, low: 100_000, high: 102_100, lowTime: currentSeconds(), highTime: currentSeconds() }
      : { id: item.id, low: 1_000, high: 2_000 + item.id, lowTime: currentSeconds(), highTime: currentSeconds() }
    ));
    mockedGet24hPrices.mockResolvedValue(marketItems.map((item) => ({
      id: item.id,
      highPriceVolume: item.id === 130 ? 1_000_000 : 100,
      lowPriceVolume: item.id === 130 ? 1_000_000 : 100
    })));

    const response = await GET(new Request("http://localhost/api/flips"));

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledTimes(100);
    expect(mockedGetTimeseries).toHaveBeenCalledWith(130, "1h");
  });

  it("falls back to a bounded profit and ROI shortlist when 24-hour summaries fail", async () => {
    const marketItems = Array.from({ length: 130 }, (_, index) => ({
      id: index + 1,
      name: `Fallback ${index + 1}`,
      members: false,
      limit: 10_000
    }));
    mockedGetItems.mockResolvedValue(marketItems);
    mockedGetLatestPrices.mockResolvedValue(marketItems.map((item) => ({
      id: item.id,
      low: 1_000,
      high: 1_500 + item.id,
      lowTime: currentSeconds(),
      highTime: currentSeconds()
    })));
    mockedGet24hPrices.mockRejectedValue(new Error("summary unavailable"));

    const response = await GET(new Request("http://localhost/api/flips"));

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledTimes(100);
  });

  it("returns the separately modeled High Upside view on demand", async () => {
    mockedGetItems.mockResolvedValue([{ id: 1, name: "Upside rune", members: true, limit: 1_000 }]);
    mockedGetLatestPrices.mockResolvedValue([{
      id: 1,
      low: 1_000,
      high: 1_200,
      lowTime: currentSeconds() - 30,
      highTime: currentSeconds() - 20
    }]);
    mockedGetTimeseries.mockResolvedValue(recentFiveMinutePoints({ low: 1_000, high: 1_200, matchedVolume: 1_000 }));

    const response = await GET(new Request("http://localhost/api/flips?view=upside&minExpectedGpPerHour=1"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledWith(1, "5m");
    expect(payload.meta).toMatchObject({ view: "upside", modelVersion: "upside-v1" });
    expect(payload.data[0]).toMatchObject({
      view: "upside",
      name: "Upside rune",
      modelVersion: "upside-v1"
    });
    expect(payload.data[0].upsideAnalysis.riskAdjustedGpPerHour).toBeGreaterThan(0);
  });

  it("keeps High Upside available when one shortlisted history fails", async () => {
    mockedGetItems.mockResolvedValue([
      { id: 1, name: "Working", members: true, limit: 1_000 },
      { id: 2, name: "Unavailable", members: true, limit: 1_000 }
    ]);
    mockedGetLatestPrices.mockResolvedValue([1, 2].map((id) => ({
      id,
      low: 1_000,
      high: 1_200,
      lowTime: currentSeconds(),
      highTime: currentSeconds()
    })));
    mockedGetTimeseries.mockImplementation(async (id, timestep) => {
      expect(timestep).toBe("5m");
      if (id === 2) throw new Error("history unavailable");
      return recentFiveMinutePoints({ low: 1_000, high: 1_200, matchedVolume: 1_000 });
    });

    const response = await GET(new Request("http://localhost/api/flips?view=upside"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.map((candidate: { id: number }) => candidate.id)).toEqual([1]);
  });

  it("limits High Upside timeseries enrichment to ten concurrent requests", async () => {
    const marketItems = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `Upside ${index + 1}`,
      members: true,
      limit: 1_000
    }));
    mockedGetItems.mockResolvedValue(marketItems);
    mockedGetLatestPrices.mockResolvedValue(marketItems.map((item) => ({
      id: item.id,
      low: 1_000,
      high: 1_200 + item.id,
      lowTime: currentSeconds(),
      highTime: currentSeconds()
    })));
    mockedGet24hPrices.mockResolvedValue(marketItems.map((item) => ({
      id: item.id,
      highPriceVolume: 10_000,
      lowPriceVolume: 10_000
    })));
    let active = 0;
    let maximumActive = 0;
    mockedGetTimeseries.mockImplementation(async () => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return recentFiveMinutePoints({ low: 1_000, high: 1_300, matchedVolume: 1_000 });
    });

    const response = await GET(new Request("http://localhost/api/flips?view=upside"));

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledTimes(25);
    expect(maximumActive).toBeLessThanOrEqual(10);
  });

  it("returns a safe error without exposing upstream details", async () => {
    mockedGetItems.mockRejectedValue(new Error("private upstream payload"));

    const response = await GET(new Request("http://localhost/api/flips"));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to rank flips." });
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
  return Array.from({ length: 168 }, (_, index) => ({
    timestamp: nowSeconds - (167 - index) * 3_600,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: matchedVolume,
    lowPriceVolume: matchedVolume
  }));
}

function currentSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function recentFiveMinutePoints({
  low,
  high,
  matchedVolume
}: {
  low: number;
  high: number;
  matchedVolume: number;
}): PricePoint[] {
  const now = currentSeconds();
  return Array.from({ length: 288 }, (_, index) => ({
    timestamp: now - (287 - index) * 300,
    avgHighPrice: high,
    avgLowPrice: low,
    highPriceVolume: matchedVolume,
    lowPriceVolume: matchedVolume
  }));
}
