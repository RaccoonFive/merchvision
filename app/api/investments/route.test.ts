import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({
  get24hPrices: vi.fn(),
  getItems: vi.fn(),
  getTimeseries: vi.fn()
}));

import { get24hPrices, getItems, getTimeseries } from "@/lib/osrsWiki";

const mockedGet24hPrices = vi.mocked(get24hPrices);
const mockedGetItems = vi.mocked(getItems);
const mockedGetTimeseries = vi.mocked(getTimeseries);
const hour = 60 * 60;
const now = 1_700_000_000;

function history(multiplier = 1.001) {
  return Array.from({ length: 168 }, (_, index) => {
    const midpoint = 100 * multiplier ** index;
    return {
      timestamp: now - (167 - index) * hour,
      avgHighPrice: midpoint + 1,
      avgLowPrice: midpoint - 1
    };
  });
}

describe("GET /api/investments", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetItems.mockResolvedValue(Array.from({ length: 105 }, (_, index) => ({
      id: index + 1,
      name: index === 0 ? "Air rune" : `Item ${index + 1}`,
      members: false
    })));
    mockedGet24hPrices.mockResolvedValue(Array.from({ length: 105 }, (_, index) => ({
      id: index + 1,
      highPriceVolume: 105 - index,
      lowPriceVolume: 105 - index
    })));
    mockedGetTimeseries.mockResolvedValue(history());
  });

  it("shortlists the top 100 liquid items and returns filtered investments", async () => {
    const response = await GET(new Request("http://localhost/api/investments?search=air"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledTimes(100);
    expect(mockedGetTimeseries).not.toHaveBeenCalledWith(105, "1h");
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({ id: 1, name: "Air rune" });
    expect(payload.meta).toMatchObject({ shortlisted: 100, analyzed: 100, skipped: 0 });
  });

  it("tolerates individual timeseries failures", async () => {
    mockedGetTimeseries.mockImplementation(async (id) => {
      if (id === 1) throw new Error("history unavailable");
      return history();
    });

    const response = await GET(new Request("http://localhost/api/investments"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.some((candidate: { id: number }) => candidate.id === 1)).toBe(false);
    expect(payload.meta).toMatchObject({ analyzed: 99, skipped: 1 });
  });

  it("returns a server error when the market summary cannot load", async () => {
    mockedGet24hPrices.mockRejectedValue(new Error("market unavailable"));
    const response = await GET(new Request("http://localhost/api/investments"));
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("market unavailable");
  });
});
