import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({ getTimeseries: vi.fn() }));

import { getTimeseries } from "@/lib/osrsWiki";

const mockedGetTimeseries = vi.mocked(getTimeseries);
const context = { params: Promise.resolve({ id: "4151" }) };

describe("GET /api/items/[id]/timeseries", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetTimeseries.mockResolvedValue([
      { timestamp: 1, avgHighPrice: 1_100, avgLowPrice: 1_000, highPriceVolume: 100, lowPriceVolume: 80 }
    ]);
  });

  it("returns normalized timeseries points by default", async () => {
    const response = await GET(new Request("http://localhost/api/items/4151/timeseries?timestep=6h"), context);

    expect(response.status).toBe(200);
    expect(mockedGetTimeseries).toHaveBeenCalledWith(4151, "6h");
    expect(await response.json()).toEqual({
      data: [{ timestamp: 1, avgHighPrice: 1_100, avgLowPrice: 1_000, highPriceVolume: 100, lowPriceVolume: 80 }]
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
