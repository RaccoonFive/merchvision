import { load } from "cheerio/slim";
import type { BossDrop, BossDropsResponse, BossLoot, BossSource, ParsedBossDrop } from "./bossTypes";
import type { ItemMeta, LatestPrice } from "./types";

const WIKI_ORIGIN = "https://oldschool.runescape.wiki";

export const SHARED_DROP_SOURCES: Record<string, BossSource> = {
  "Rare drop table": { page: "Rare drop table", sections: ["Rare_drop_table"] },
  "Gem drop table": { page: "Gem drop table", sections: ["Gem_Drop_Table"] },
  "Mega-rare drop table": { page: "Rare drop table", sections: ["Mega-rare_drop_table", "Talisman"] },
  "Herb drop table": { page: "Drop table", sections: ["Herb_drop_table"] },
  "General seed drop table": { page: "Drop table", sections: ["General_seed_drop_table"] },
  "Allotment seed drop table": { page: "Drop table", sections: ["Allotment_seed_drop_table"] },
  "Tree-herb seed drop table": { page: "Drop table", sections: ["Tree-herb_seed_drop_table"] }
};
export const SHARED_DROP_PAGES = Object.keys(SHARED_DROP_SOURCES);

export function wikiPageUrl(page: string): string {
  return `${WIKI_ORIGIN}/w/${encodeURIComponent(page.replaceAll(" ", "_"))}`;
}

// Upstream links/images are data, never URLs to fetch or HTML to render as-is.
export function safeWikiUrl(value?: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, WIKI_ORIGIN);
    return url.origin === WIKI_ORIGIN && /^\/(images|w)\//.test(url.pathname) ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeDropName(value: string): string {
  return value.normalize("NFKC").replaceAll("_", " ").replaceAll(/[’‘]/g, "'").replaceAll(/\s+/g, " ").trim().toLowerCase();
}

export function parseBossDropHtml(html: string, source: BossSource) {
  const $ = load(html);
  const cleanText = (element: ReturnType<typeof $>): string => {
    const copy = element.clone();
    copy.find("script,style,.mw-editsection,.reference,.mw-cite-backlink").remove();
    copy.find("br").replaceWith("; ");
    return copy.text().replaceAll(/\s+/g, " ").trim();
  };
  const root = $(".mw-parser-output").first();
  const selector = "h2,h3,h4,h5,h6,p,table";
  const nodes = root.length ? root.find(selector) : $.root().find(selector);
  const headings: { level: number; id: string; text: string }[] = [];
  const drops: ParsedBossDrop[] = [];
  const notes = new Set<string>();
  const sharedTables = new Set<string>();
  const foundSections = new Set<string>();
  let partial = false;
  let tableCount = 0;

  nodes.each((_, element) => {
    const node = $(element);
    if (node.parents("table").length) return;
    const tag = element.tagName;
    if (/^h[2-6]$/.test(tag)) {
      const level = Number(tag[1]);
      while (headings.length && headings[headings.length - 1].level >= level) headings.pop();
      const id = node.attr("id") ?? node.find("[id]").first().attr("id") ?? "";
      headings.push({ level, id, text: cleanText(node) });
      if (source.sections.includes(id)) foundSections.add(id);
      return;
    }
    if (source.sections.length && !headings.some((heading) => source.sections.includes(heading.id))) return;

    node.find('a[href^="/w/"]').each((_, link) => {
      const title = $(link).attr("title") ?? cleanText($(link));
      if (SHARED_DROP_PAGES.includes(title)) sharedTables.add(title);
    });

    if (tag === "p") {
      const text = cleanText(node);
      if (text && !/^The average /i.test(text)) notes.add(text);
      return;
    }

    const headerRow = node.find("tr").filter((_, row) => $(row).children("th").length > 0).first();
    const headers = headerRow.children("th,td").map((_, cell) => cleanText($(cell)).toLowerCase()).get();
    const itemColumn = headers.indexOf("item");
    const quantityColumn = headers.indexOf("quantity");
    const rarityColumn = headers.findIndex((header) => ["rarity", "rate", "chance"].includes(header));
    if (itemColumn < 0 || quantityColumn < 0 || rarityColumn < 0) {
      if (node.hasClass("item-drops") || (itemColumn >= 0 && quantityColumn >= 0)) partial = true;
      return;
    }
    tableCount++;
    const group = [source.label, ...headings.map((heading) => heading.text)].filter(Boolean).join(" › ") || source.page;
    node.find("tr").each((_, row) => {
      const cells = $(row).children("td");
      if (!cells.length) return;
      if (cells.length < headers.length) {
        // Section separators use a single spanning cell; other short rows
        // signal a changed table shape rather than a trustworthy empty result.
        if (!(cells.length === 1 && cells.first().attr("colspan"))) partial = true;
        return;
      }
      const itemCell = cells.eq(itemColumn);
      const name = cleanText(itemCell);
      const quantity = cleanText(cells.eq(quantityColumn));
      const rarity = cleanText(cells.eq(rarityColumn));
      if (!name || !quantity || !rarity) { partial = true; return; }
      const rowNotes = new Set<string>();
      $(row).find('a[href^="#cite_note-"]').each((_, reference) => {
        const id = $(reference).attr("href")?.slice(1);
        const footnote = $("[id]").filter((_, entry) => $(entry).attr("id") === id).first();
        const text = cleanText(footnote);
        if (text) rowNotes.add(text.replace(/^\^\s*/, ""));
        else partial = true;
      });
      const idText = $(row).attr("data-item-id") ?? itemCell.attr("data-item-id");
      const id = Number(idText);
      const geCell = cells.filter(".ge-column").first();
      const nameLink = itemCell.find('a[href^="/w/"]').first();
      drops.push({
        name,
        itemId: Number.isSafeInteger(id) && id > 0 ? id : null,
        icon: safeWikiUrl($(row).find("img").first().attr("src")),
        quantity,
        rarity,
        group,
        notes: [...rowNotes],
        wikiUrl: safeWikiUrl(nameLink.attr("href")) ?? wikiPageUrl(source.page),
        notSoldOnGe: /not sold/i.test(cleanText(geCell)) || /cannot be traded on the Grand Exchange/i.test(geCell.attr("title") ?? "")
      });
    });
  });
  if (!tableCount || !drops.length || (source.sections.length && !foundSections.size)) partial = true;
  if (source.requiredSections?.some((section) => !foundSections.has(section))) partial = true;
  // Many boss pages already expand shared tables inline. Do not append the
  // generic table a second time or imply its conditional rate is per kill.
  const missingSharedTables = [...sharedTables].filter((page) => !drops.some((drop) =>
    !SHARED_DROP_PAGES.includes(drop.name) && normalizeDropName(drop.group).includes(normalizeDropName(page))));
  return { drops, notes: [...notes], partial, sharedTables: missingSharedTables };
}

export function enrichBossDrops(loot: BossLoot, items: ItemMeta[] | null, prices: LatestPrice[] | null, now = Date.now()): BossDropsResponse {
  const byId = new Map(items?.map((item) => [item.id, item]));
  const byName = new Map<string, ItemMeta[]>();
  for (const item of items ?? []) {
    const name = normalizeDropName(item.name);
    byName.set(name, [...(byName.get(name) ?? []), item]);
  }
  const byPrice = new Map(prices?.map((price) => [price.id, price]));
  const data: BossDrop[] = loot.drops.map(({ notSoldOnGe, ...drop }) => {
    const matches = byName.get(normalizeDropName(drop.name)) ?? [];
    const item = drop.itemId ? byId.get(drop.itemId) : matches.length === 1 ? matches[0] : undefined;
    const price = item && !notSoldOnGe ? byPrice.get(item.id) : undefined;
    const low = price?.low;
    const timestamp = price?.lowTime;
    const instantSellPrice = typeof low === "number" && Number.isFinite(low) && low > 0 ? low : null;
    const instantSellTime = typeof timestamp === "number" && Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    return {
      ...drop,
      itemId: item?.id ?? null,
      icon: drop.icon ?? safeWikiUrl(item?.icon),
      geStatus: notSoldOnGe ? "not-sold" : !items ? "unavailable" : !item ? "unmatched" : instantSellPrice === null ? "unavailable" : "available",
      instantSellPrice,
      instantSellTime
    };
  });
  return {
    data,
    meta: {
      sources: loot.sources,
      notes: loot.notes,
      fetchedAt: loot.fetchedAt,
      pricedAt: new Date(now).toISOString(),
      lootPartial: loot.partial,
      pricesPartial: !items || !prices || data.some((drop) => drop.geStatus === "unmatched" || drop.geStatus === "unavailable" || (drop.geStatus === "available" && drop.instantSellTime === null))
    }
  };
}
