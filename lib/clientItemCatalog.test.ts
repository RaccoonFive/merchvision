import { afterEach, describe, expect, it, vi } from "vitest";

describe("loadItemCatalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("shares one request between concurrent item selectors", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [{ id: 1, name: "Air rune", members: false }]
    })));
    vi.stubGlobal("fetch", fetchMock);
    const { loadItemCatalog } = await import("./clientItemCatalog");

    const [headerItems, pageItems] = await Promise.all([loadItemCatalog(), loadItemCatalog()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(pageItems).toBe(headerItems);
  });

  it("allows a retry after a failed catalog request", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal("fetch", fetchMock);
    const { loadItemCatalog } = await import("./clientItemCatalog");

    await expect(loadItemCatalog()).rejects.toThrow("temporary failure");
    await expect(loadItemCatalog()).resolves.toEqual([]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
