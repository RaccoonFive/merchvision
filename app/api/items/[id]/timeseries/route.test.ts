import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({ getItems: vi.fn(), getTimeseries: vi.fn() }));

import { getItems, getTimeseries } from "@/lib/osrsWiki";

const mockedGetItems = vi.mocked(getItems);
const mockedGetTimeseries = vi.mocked(getTimeseries);
const context = { params: Promise.resolve({ id: "4151" }) };

describe("GET /api/items/[id]/timeseries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetTimeseries.mockResolvedValue([
      { timestamp: 1, avgHighPrice: 1_100, avgLowPrice: 1_000, highPriceVolume: 100, lowPriceVolume: 80 }
    ]);
    mockedGetItems.mockResolvedValue([{ id: 4151, name: "Abyssal whip", members: true, limit: 70 }]);
  });

  it("returns normalized timeseries points by default", async () => {
    const response = await GET(new Request("http://localhost/api/items/4151/timeseries?timestep=6h"), context);

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledWith(4151, "6h");
    expect(mockedGetItems).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      data: [{ timestamp: 1, avgHighPrice: 1_100, avgLowPrice: 1_000, highPriceVolume: 100, lowPriceVolume: 80 }]
    });
  });

  it("adds canonical seven-day research using the item's buy limit when requested", async () => {
    const response = await GET(
      new Request("http://localhost/api/items/4151/timeseries?timestep=1h&includeResearch=true"),
      context
    );
    const payload = await response.json();

    expect(mockedGetItems).toHaveBeenCalledOnce();
    expect(payload).toMatchObject({
      data: [{ timestamp: 1 }],
      research: {
        market: {
          historicalNetMarginMedian: 78,
          positiveSpreadRatio: 1,
          medianMatchedHourlyVolume: 80,
          estimatedExecutableUnitsPerHour: 0.8,
          rawExpectedGpPerHour: 62.4,
          sampleCount: 1
        },
        sourcePointCount: 1,
        volumeSampleCount: 1,
        latestSampleTime: 1
      }
    });
  });

  it("adds a deterministic rhythm summary only when requested", async () => {
    const response = await GET(
      new Request("http://localhost/api/items/4151/timeseries?timestep=1h&includeRhythm=true"),
      context
    );
    const payload = await response.json();

    expect(payload).toMatchObject({
      data: [{ timestamp: 1 }],
      rhythm: {
        sampleCount: 1,
        sourcePointCount: 1,
        positiveSpreadRatio: 1,
        medianMatchedHourlyVolume: 80
      }
    });
  });

  it("rejects invalid item ids before making an upstream request", async () => {
    const response = await GET(new Request("http://localhost/api/items/nope/timeseries"), {
      params: Promise.resolve({ id: "nope" })
    });

    expect(response.status).toBe(400);
    expect(mockedGetTimeseries).not.toHaveBeenCalled();
  });

  it("returns a safe error when upstream history is unavailable", async () => {
    mockedGetTimeseries.mockRejectedValue(new Error("private upstream payload"));

    const response = await GET(new Request("http://localhost/api/items/4151/timeseries"), context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Unable to load item price history." });
  });
});
