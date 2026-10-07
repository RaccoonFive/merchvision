import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BOSSES, filterBosses, findBoss } from "@/lib/bossCatalog";
import { enrichBossDrops, parseBossDropHtml, safeWikiUrl } from "@/lib/bossDrops";
import type { BossLoot, ParsedBossDrop } from "@/lib/bossTypes";

const fixture = (name: string) => readFileSync(new URL(`../fixtures/boss-drops/${name}.html`, import.meta.url), "utf8");
const parse = (fixtureName: string, bossSlug: string) => parseBossDropHtml(fixture(fixtureName), findBoss(bossSlug)!.sources[0]);
const drop: ParsedBossDrop = {
  name: "Dragon bones", itemId: null, icon: null, quantity: "2–3 (noted)", rarity: "2 × 1/30",
  group: "Drops › Bones", notes: [], wikiUrl: "https://oldschool.runescape.wiki/w/Dragon_bones", notSoldOnGe: false
};
const loot = (drops: ParsedBossDrop[]): BossLoot => ({ drops, notes: [], sources: [], fetchedAt: "2026-10-04T12:00:00.000Z", partial: false });

describe("boss catalog", () => {
  it("has unique stable slugs, all categories, and current repeatable bosses", () => {
    expect(new Set(BOSSES.map((boss) => boss.slug)).size).toBe(BOSSES.length);
    for (const boss of BOSSES) expect(boss.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(new Set(BOSSES.map((boss) => boss.category)).size).toBe(6);
    expect(findBoss("doom-of-mokhaiotl")).toBeDefined();
    expect(findBoss("shellbane-gryphon")).toBeDefined();
    expect(filterBosses("great olm", "Raids").map((boss) => boss.name)).toEqual(["Chambers of Xeric"]);
    expect(filterBosses(" zulrah ", "All").map((boss) => boss.name)).toEqual(["Zulrah"]);
    expect(filterBosses("zulrah", "Slayer")).toEqual([]);
    expect(filterBosses("does not exist", "All")).toEqual([]);
  });
});

describe("Wiki drop extraction", () => {
  it("extracts ordinary drops, icons, quantities and multi-roll rates from live markup", () => {
    const parsed = parse("vorkath", "vorkath");
    expect(parsed.drops[0]).toMatchObject({ name: "Superior dragon bones", quantity: "2", rarity: "Always" });
    expect(parsed.drops[0].icon).toMatch(/^https:\/\/oldschool.runescape.wiki\/images\//);
    expect(parsed.drops.some((entry) => entry.name === "Vorkath's head" && entry.notes.some((note) => note.includes("50th")))).toBe(true);
  });

  it("uses a shared chest's rewards and retains source-specific conditions", () => {
    const parsed = parse("barrows", "barrows");
    expect(parsed.drops[0]).toMatchObject({ name: "Ahrim's hood", rarity: "7 × 1/2,448" });
    expect(parsed.drops.every((entry) => entry.group.startsWith("Rewards"))).toBe(true);
  });

  it("preserves conditional raid unique rates and guaranteed rewards", () => {
    const parsed = parse("raid", "chambers-of-xeric");
    expect(parsed.drops[0]).toMatchObject({ name: "Dexterous prayer scroll", rarity: "14/60" });
    expect(parsed.drops[0].notes.length).toBeGreaterThan(0);
    expect(parsed.notes.join(" ")).toMatch(/unique|points/i);
  });

  it("keeps both Titans' drops in distinct groups", () => {
    const parsed = parse("royal-titans", "royal-titans");
    expect(parsed.drops.some((entry) => entry.group.includes("Branda"))).toBe(true);
    expect(parsed.drops.some((entry) => entry.group.includes("Eldric"))).toBe(true);
    expect(new Set(parsed.drops.map((entry) => entry.group)).size).toBe(2);
    expect(parsed.partial).toBe(false);
    const missingVariant = fixture("royal-titans").replace('id="Eldric_the_Ice_King_drops"', 'id="Renamed_variant"');
    const incomplete = parseBossDropHtml(missingVariant, findBoss("royal-titans")!.sources[0]);
    expect(incomplete.partial).toBe(true);
    expect(incomplete.drops.some((entry) => entry.group.includes("Branda"))).toBe(true);
  });

  it("preserves skilling reward ranges and confirmed not-sold states", () => {
    const parsed = parse("skilling", "tempoross");
    expect(parsed.drops[0]).toMatchObject({ name: "Spirit flakes", quantity: "32–64", notSoldOnGe: true });
  });

  it("keeps regular and corrupted Gauntlet reward variants separate", () => {
    const parsed = parse("gauntlet", "the-gauntlet");
    expect(parsed.drops.some((entry) => entry.group.includes("Regular loot table"))).toBe(true);
    expect(parsed.drops.some((entry) => entry.group.includes("Corrupted loot table"))).toBe(true);
  });

  it("discovers allowlisted shared subtables without treating rates as per kill", () => {
    const parsed = parseBossDropHtml(fixture("shared"), { page: "Rare drop table", sections: [] });
    expect(parsed.sharedTables).toContain("Gem drop table");
    expect(parsed.drops[0]).toMatchObject({ name: "Nature rune", quantity: "67", rarity: "3/128" });
  });

  it("ignores unrelated sections and marks missing or unsupported loot partial", () => {
    const html = '<h2 id="Collection_log">Log</h2><table class="item-drops"><tr><th>Item</th><th>Quantity</th></tr></table>';
    expect(parseBossDropHtml(html, { page: "Boss", sections: ["Drops"] })).toMatchObject({ drops: [], partial: true });
    expect(parseBossDropHtml(html, { page: "Boss", sections: [] }).partial).toBe(true);
    expect(parseBossDropHtml("<p>Changed layout</p>", { page: "Boss", sections: ["Drops"] }).partial).toBe(true);
  });

  it("never accepts external, executable, or unexpected Wiki paths", () => {
    expect(safeWikiUrl("javascript:alert(1)")).toBeNull();
    expect(safeWikiUrl("//evil.example/image.png")).toBeNull();
    expect(safeWikiUrl("https://oldschool.runescape.wiki/api.php")).toBeNull();
    expect(safeWikiUrl("/images/Bones.png")).toBe("https://oldschool.runescape.wiki/images/Bones.png");
  });
});

describe("boss drop market enrichment", () => {
  it("matches IDs before exact normalized names and uses the low quote before tax", () => {
    const response = enrichBossDrops(loot([{ ...drop, name: "Different label", itemId: 536 }, { ...drop, name: "  DRAGON_bones " }]),
      [{ id: 536, name: "Dragon bones", members: true }], [{ id: 536, low: 2000, high: 5000, lowTime: 1 }]);
    expect(response.data.map((entry) => entry.instantSellPrice)).toEqual([2000, 2000]);
    expect(response.data[0]).toMatchObject({ itemId: 536, geStatus: "available", instantSellTime: 1 });
    expect(response.meta.pricesPartial).toBe(false);
  });

  it("never fuzzy matches, chooses an ambiguous name, or overwrites explicit unmatched IDs", () => {
    const response = enrichBossDrops(loot([{ ...drop, name: "Dragon bone" }, { ...drop, itemId: 999 }, drop]),
      [{ id: 536, name: "Dragon bones", members: true }, { id: 537, name: "Dragon bones", members: true }], []);
    expect(response.data.every((entry) => entry.geStatus === "unmatched" && entry.itemId === null)).toBe(true);
    expect(response.meta.pricesPartial).toBe(true);
  });

  it("keeps pets distinct from unknown items and survives market failures", () => {
    const response = enrichBossDrops(loot([{ ...drop, name: "Vorki", notSoldOnGe: true }, drop]), null, null);
    expect(response.data.map((entry) => entry.geStatus)).toEqual(["not-sold", "unavailable"]);
    expect(response.data.every((entry) => entry.instantSellPrice === null)).toBe(true);
    expect(response.data[1].quantity).toBe("2–3 (noted)");
  });

  it("treats missing or invalid lows and missing timestamps explicitly", () => {
    const items = [{ id: 536, name: "Dragon bones", members: true }];
    for (const low of [undefined, 0, -1, NaN]) {
      expect(enrichBossDrops(loot([drop]), items, [{ id: 536, low }]).data[0].geStatus).toBe("unavailable");
    }
    const response = enrichBossDrops(loot([drop]), items, [{ id: 536, low: 2000 }]);
    expect(response.data[0].instantSellTime).toBeNull();
    expect(response.meta.pricesPartial).toBe(true);
  });
});
