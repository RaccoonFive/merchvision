import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/osrsWiki", () => ({
  getItems: vi.fn(),
  getLatestPrices: vi.fn()
}));

import { getItems, getLatestPrices } from "@/lib/osrsWiki";

const mockedGetItems = vi.mocked(getItems);
const mockedGetLatestPrices = vi.mocked(getLatestPrices);

describe("GET /api/items/[id]/quote", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetItems.mockResolvedValue([{ id: 4107, name: "Mystic boots (dark)", members: true, limit: 70 }]);
    mockedGetLatestPrices.mockResolvedValue([{ id: 4107, high: 83_037, low: 83_599 }]);
  });

  it("returns negative margins", async () => {
    const response = await GET(new Request("http://localhost/api/items/4107/quote"), {
      params: Promise.resolve({ id: "4107" })
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.item.name).toBe("Mystic boots (dark)");
    expect(payload.quote).toMatchObject({ margin: -562, tax: 1660, netProfit: -2222 });
  });

  it("returns partial quotes", async () => {
    mockedGetLatestPrices.mockResolvedValue([{ id: 4107, high: 83_037, highTime: 100 }]);
    const response = await GET(new Request("http://localhost/api/items/4107/quote"), {
      params: Promise.resolve({ id: "4107" })
    });
    const payload = await response.json();

    expect(payload.quote).toMatchObject({ high: 83_037, low: null, netProfit: null });
  });

  it("returns 400 for invalid ids and 404 for unknown items", async () => {
    const invalid = await GET(new Request("http://localhost/api/items/nope/quote"), {
      params: Promise.resolve({ id: "nope" })
    });
    const missing = await GET(new Request("http://localhost/api/items/99/quote"), {
      params: Promise.resolve({ id: "99" })
    });

    expect(invalid.status).toBe(400);
    expect(missing.status).toBe(404);
  });
});
