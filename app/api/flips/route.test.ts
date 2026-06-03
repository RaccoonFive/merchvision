import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({
  getItems: vi.fn(),
  getLatestPrices: vi.fn(),
  getRecentVolumes: vi.fn()
}));

import { getItems, getLatestPrices, getRecentVolumes } from "@/lib/osrsWiki";

const mockedGetItems = vi.mocked(getItems);
const mockedGetLatestPrices = vi.mocked(getLatestPrices);
const mockedGetRecentVolumes = vi.mocked(getRecentVolumes);

describe("GET /api/flips", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetItems.mockResolvedValue([{ id: 1, name: "Air rune", members: false, limit: 30_000 }]);
    mockedGetLatestPrices.mockResolvedValue([
      { id: 1, low: 4, high: 6, lowTime: Math.floor(Date.now() / 1000), highTime: Math.floor(Date.now() / 1000) }
    ]);
    mockedGetRecentVolumes.mockResolvedValue(new Map([[1, 10_000]]));
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
      volume: 10_000
    });
  });
});
