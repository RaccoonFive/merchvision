import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/prayer-potions/route";
import { getLatestPrices } from "@/lib/osrsWiki";

vi.mock("@/lib/osrsWiki", () => ({ getLatestPrices: vi.fn() }));

describe("GET /api/prayer-potions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("returns a bounded pair of purchase quotes from one shared snapshot", async () => {
    vi.mocked(getLatestPrices).mockResolvedValue([
      { id: 2434, high: 9600, highTime: 100, low: 9000 },
      { id: 3024, high: 9900, highTime: 101 },
      { id: 999, high: 1000 }
    ]);
    const response = await GET();
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data).toEqual([
      { id: 2434, price: 9600, timestamp: 100 },
      { id: 3024, price: 9900, timestamp: 101 }
    ]);
    expect(Number.isFinite(Date.parse(payload.meta.generatedAt))).toBe(true);
    expect(getLatestPrices).toHaveBeenCalledTimes(1);
  });

  it("preserves missing quotes as unavailable", async () => {
    vi.mocked(getLatestPrices).mockResolvedValue([{ id: 2434, high: 0, low: 9000 }]);
    const response = await GET();
    expect((await response.json()).data).toEqual([
      { id: 2434, price: null, timestamp: null },
      { id: 3024, price: null, timestamp: null }
    ]);
  });

  it("returns a safe JSON error when the upstream fails", async () => {
    vi.mocked(getLatestPrices).mockRejectedValue(new Error("private upstream details"));
    const response = await GET();
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "Unable to load potion prices. Please try again." });
  });
});
