import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const payload = { data: [], meta: { sources: [], notes: [], fetchedAt: "2026-10-04T12:00:00Z", pricedAt: "2026-10-04T12:00:00Z", lootPartial: false, pricesPartial: false } };

describe("client boss drop cache", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

  it("coalesces concurrent requests, reuses responses and expires after a minute", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn(async () => new Response(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetcher);
    const { loadBossDrops } = await import("@/lib/clientBossDrops");
    await Promise.all([loadBossDrops("vorkath"), loadBossDrops("vorkath")]);
    await loadBossDrops("vorkath");
    expect(fetcher).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_001);
    await loadBossDrops("vorkath");
    expect(fetcher).toHaveBeenCalledTimes(2);
    await loadBossDrops("vorkath", true);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("keeps independent selections separate even when responses arrive out of order", async () => {
    let finishFirst: (value: Response) => void = () => {};
    vi.stubGlobal("fetch", vi.fn().mockImplementationOnce(() => new Promise((resolve) => { finishFirst = resolve; }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, data: [{ name: "Second boss loot" }] }))));
    const { loadBossDrops } = await import("@/lib/clientBossDrops");
    const first = loadBossDrops("vorkath");
    const second = await loadBossDrops("zulrah");
    finishFirst(new Response(JSON.stringify(payload)));
    await first;
    expect(second.data[0].name).toBe("Second boss loot");
    expect((await loadBossDrops("zulrah")).data[0].name).toBe("Second boss loot");
  });

  it("does not cache rejected or malformed responses", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: "Upstream internals" }), { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    vi.stubGlobal("fetch", fetcher);
    const { loadBossDrops } = await import("@/lib/clientBossDrops");
    await expect(loadBossDrops("vorkath")).rejects.toThrow("Unable to load boss drops.");
    await expect(loadBossDrops("vorkath")).rejects.toThrow("Unable to load boss drops.");
    expect(await loadBossDrops("vorkath")).toEqual(payload);
  });
});
