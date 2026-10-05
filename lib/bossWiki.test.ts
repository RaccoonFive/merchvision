import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BossDefinition } from "./bossTypes";

const html = '<h2 id="Drops">Drops</h2><table class="item-drops"><tr><th>Item</th><th>Quantity</th><th>Rarity</th></tr><tr><td>Dragon bones</td><td>1</td><td>Always</td></tr></table>';
const response = (text = html) => new Response(JSON.stringify({ parse: { text, revid: 123 } }));
const boss = (name = "Test boss"): BossDefinition => ({ slug: "test", name, category: "Combat", image: "", encounters: [], sources: [{ page: name, sections: ["Drops"] }] });

describe("cached Wiki boss loot", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("USER_AGENT_CONTACT", "tests@example.invalid");
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it("coalesces requests, identifies itself, caches for 24 hours and sets a timeout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-04T12:00:00Z"));
    const fetcher = vi.fn(async () => response());
    vi.stubGlobal("fetch", fetcher);
    const { getBossLoot } = await import("./osrsWiki");
    const [a, b] = await Promise.all([getBossLoot(boss()), getBossLoot(boss())]);
    expect(a.drops).toEqual(b.drops);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("action=parse");
    expect(options.headers).toMatchObject({ "User-Agent": "Merchvision/0.1 (tests@example.invalid)" });
    expect(options.signal).toBeInstanceOf(AbortSignal);
    await getBossLoot(boss());
    expect(fetcher).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-05T12:00:01Z"));
    await getBossLoot(boss());
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not cache failures or silently accept empty changed markup", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: "missingtitle" } })))
      .mockResolvedValueOnce(response("<p>Changed markup</p>"))
      .mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetcher);
    const { getBossLoot } = await import("./osrsWiki");
    await expect(getBossLoot(boss())).rejects.toThrow("Unable to load boss drops.");
    await expect(getBossLoot(boss())).rejects.toThrow("Unable to load boss drops.");
    expect((await getBossLoot(boss())).drops).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("retries failed supporting sources without refetching healthy ones", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response()).mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(response());
    vi.stubGlobal("fetch", fetcher);
    const { getBossLoot } = await import("./osrsWiki");
    const entry = boss();
    entry.sources.push({ page: "Supporting page", sections: ["Drops"] });
    expect((await getBossLoot(entry)).partial).toBe(true);
    expect((await getBossLoot(entry)).partial).toBe(false);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("bounds simultaneous page requests across independent bosses to two", async () => {
    let active = 0;
    let maximum = 0;
    const releases: (() => void)[] = [];
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => {
      active++; maximum = Math.max(maximum, active);
      releases.push(() => { active--; resolve(response()); });
    })));
    const { getBossLoot } = await import("./osrsWiki");
    const requests = ["A", "B", "C", "D"].map((name) => getBossLoot(boss(name)));
    await vi.waitFor(() => expect(releases.length).toBe(2));
    releases.splice(0).forEach((release) => release());
    await vi.waitFor(() => expect(releases.length).toBe(2));
    releases.splice(0).forEach((release) => release());
    await Promise.all(requests);
    expect(maximum).toBe(2);
  });

  it("rejects timed-out requests and permits a subsequent retry", async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(), ms);
      return controller.signal;
    });
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new Error("Aborted")));
    }));
    vi.stubGlobal("fetch", fetcher);
    const { getBossLoot } = await import("./osrsWiki");
    const rejected = expect(getBossLoot(boss())).rejects.toThrow("Unable to load boss drops.");
    await vi.advanceTimersByTimeAsync(10_000);
    await rejected;
    vi.stubGlobal("fetch", vi.fn(async () => response()));
    expect((await getBossLoot(boss())).drops.length).toBe(1);
  });

  it("expands only allowlisted shared tables with explicit conditional labels", async () => {
    const base = html.replace("Dragon bones", '<a title="Gem drop table" href="/w/Gem_drop_table">Gem drop table</a>');
    const shared = html.replace('id="Drops"', 'id="Gem_Drop_Table"').replace("Dragon bones", "Uncut sapphire");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response(base)).mockResolvedValueOnce(response(shared)));
    const { getBossLoot } = await import("./osrsWiki");
    const loot = await getBossLoot(boss());
    expect(loot.drops[1]).toMatchObject({ name: "Uncut sapphire", group: expect.stringContaining("conditional") });
    expect(loot.notes.join(" ")).toContain("not directly per boss kill");
    expect(loot.sources).toHaveLength(2);
  });
});
