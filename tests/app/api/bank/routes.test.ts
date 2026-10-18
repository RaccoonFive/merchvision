import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as marketPost } from "@/app/api/bank/market/route";
import { POST as trendsPost } from "@/app/api/bank/trends/route";
import { getBankTrends } from "@/lib/bankMarket";
import { get24hPrices, getItems, getLatestPrices, getTimeseries } from "@/lib/osrsWiki";

vi.mock("@/lib/osrsWiki", () => ({ get24hPrices: vi.fn(), getItems: vi.fn(), getLatestPrices: vi.fn(), getTimeseries: vi.fn() }));
const now = 1_800_000_000;
const history = Array.from({ length: 91 }, (_, index) => ({ timestamp: now - (90 - index) * 86400, avgHighPrice: 101 + index, avgLowPrice: 99 + index }));
const request = (ids: unknown) => new Request("http://localhost/api/bank", { method: "POST", body: JSON.stringify({ itemIds: ids }) });

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  vi.mocked(getItems).mockResolvedValue(Array.from({ length: 40 }, (_, index) => ({ id: index + 1, name: `Item ${index + 1}`, members: false })));
  vi.mocked(getLatestPrices).mockResolvedValue([{ id: 1, low: 100, lowTime: now, high: 120 }]);
  vi.mocked(get24hPrices).mockResolvedValue([{ id: 1, highPriceVolume: 5000, lowPriceVolume: 3000 }]);
  vi.mocked(getTimeseries).mockResolvedValue(history);
});
afterEach(() => vi.restoreAllMocks());

describe.each([{ label: "market", post: marketPost, limit: 2000 }, { label: "trends", post: trendsPost, limit: 20 }])("bank $label boundary", ({ post, limit }) => {
  it.each([undefined, [], [1, 1], [0], [-1], [1.2], ["1"], [2147483648]])("rejects invalid IDs: %j", async (ids) => {
    expect((await post(request(ids))).status).toBe(400);
    expect(getItems).not.toHaveBeenCalled();
  });
  it("enforces batch limits and handles invalid JSON", async () => {
    expect((await post(request(Array.from({ length: limit + 1 }, (_, index) => index + 1)))).status).toBe(400);
    const response = await post(new Request("http://localhost/api/bank", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid JSON body." });
  });
  it("returns a safe failure when metadata is unavailable", async () => {
    vi.mocked(getItems).mockRejectedValue(new Error("secret database/password upstream payload"));
    const response = await post(request([1]));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("Unable to load bank");
    expect(JSON.stringify(body)).not.toMatch(/secret|password|payload/);
  });
});

describe("bank market enrichment", () => {
  it("returns only requested IDs with canonical metadata, low quotes, liquidity, and unknown states", async () => {
    const response = await marketPost(request([1, 995, 9999]));
    expect(response.status).toBe(200);
    const { data, meta } = await response.json();
    expect(data).toHaveLength(3);
    expect(data[0]).toMatchObject({ id: 1, item: { name: "Item 1" }, price: { low: 100 }, matchedVolume: 3000 });
    expect(data[2]).toEqual({ id: 9999, item: null, price: null, matchedVolume: null });
    expect(meta).toMatchObject({ pricesAvailable: true, liquidityAvailable: true });
    expect(getItems).toHaveBeenCalledTimes(1);
    expect(getLatestPrices).toHaveBeenCalledTimes(1);
    expect(getTimeseries).not.toHaveBeenCalled();
  });
  it("preserves metadata when quotes and volume fail and never invents zero volume", async () => {
    vi.mocked(getLatestPrices).mockRejectedValue(new Error("private detail"));
    vi.mocked(get24hPrices).mockRejectedValue(new Error("private detail"));
    const response = await marketPost(request([1]));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data[0]).toMatchObject({ item: { id: 1 }, price: null, matchedVolume: null });
    expect(body.meta).toMatchObject({ pricesAvailable: false, liquidityAvailable: false });
    expect(JSON.stringify(body)).not.toContain("private detail");
  });
});

describe("bank history enrichment", () => {
  it("loads one daily series per supported item and retains individual failures", async () => {
    vi.mocked(getTimeseries).mockImplementation(async (id) => { if (id === 2) throw new Error("secret upstream detail"); return history; });
    const response = await trendsPost(request([1, 2, 995, 9999]));
    const { data } = await response.json();
    expect(response.status).toBe(200);
    expect(data[0]).toMatchObject({ id: 1, status: "available", periods: { 7: { direction: "rising" }, 30: { direction: "rising" }, 90: { direction: "rising" } } });
    expect(data[1]).toEqual({ id: 2, status: "failed", periods: null });
    expect(data[2].status).toBe("unsupported");
    expect(data[3].status).toBe("unsupported");
    expect(getTimeseries).toHaveBeenCalledTimes(2);
    expect(getTimeseries).toHaveBeenCalledWith(1, "24h");
    expect(JSON.stringify(data)).not.toContain("secret");
  });
  it("limits histories to four requests across simultaneous batches", async () => {
    let active = 0;
    let peak = 0;
    vi.mocked(getTimeseries).mockImplementation(async () => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 2));
      active--;
      return history;
    });
    const [first, second] = await Promise.all([
      getBankTrends(Array.from({ length: 20 }, (_, index) => index + 1)),
      getBankTrends(Array.from({ length: 20 }, (_, index) => index + 21))
    ]);
    expect(peak).toBe(4);
    expect(first.concat(second).every((row) => row.status === "available")).toBe(true);
    expect(active).toBe(0);
  });
  it("does not start queued upstream work for an aborted request", async () => {
    const controller = new AbortController();
    const release: Array<() => void> = [];
    vi.mocked(getTimeseries).mockImplementation(() => new Promise((resolve) => release.push(() => resolve(history))));
    const pending = getBankTrends([1, 2, 3, 4, 5, 6, 7, 8], controller.signal);
    await vi.waitFor(() => expect(release).toHaveLength(4));
    controller.abort();
    release.forEach((finish) => finish());
    const rows = await pending;
    expect(getTimeseries).toHaveBeenCalledTimes(4);
    expect(rows.filter((row) => row.status === "failed")).toHaveLength(4);
  });
});
