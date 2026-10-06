import type { ItemMeta, LatestPrice, MarketSummary, PricePoint } from "./types";
import type { BossDefinition, BossLoot, BossSource } from "./bossTypes";
import { parseBossDropHtml, SHARED_DROP_SOURCES, wikiPageUrl } from "./bossDrops";

const BASE_URL = "https://prices.runescape.wiki/api/v1/osrs";
const WIKI_IMAGE_BASE_URL = "https://oldschool.runescape.wiki/images";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();
const pending = new Map<string, Promise<unknown>>();

const LOOT_CACHE_MS = 24 * 60 * 60 * 1000;
let activeLootRequests = 0;
const lootRequestQueue: (() => void)[] = [];

async function withLootRequestSlot<T>(request: () => Promise<T>): Promise<T> {
  if (activeLootRequests >= 2) await new Promise<void>((resolve) => lootRequestQueue.push(resolve));
  else activeLootRequests++;
  try {
    return await request();
  } finally {
    const next = lootRequestQueue.shift();
    if (next) next();
    else activeLootRequests--;
  }
}

async function getWikiLootSource(source: BossSource) {
  return cached(`boss-source:${JSON.stringify(source)}`, LOOT_CACHE_MS, () => withLootRequestSlot(async () => {
    const contact = process.env.USER_AGENT_CONTACT;
    if (!contact) throw new Error("Unable to load boss drops.");
    const query = new URLSearchParams({
      action: "parse", page: source.page, prop: "text|revid", redirects: "1", format: "json", formatversion: "2"
    });
    const response = await fetch(`https://oldschool.runescape.wiki/api.php?${query}`, {
      headers: { "User-Agent": `Merchvision/0.1 (${contact})`, Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 0 }
    });
    if (!response.ok) throw new Error("Unable to load boss drops.");
    const payload = await response.json() as { parse?: { text?: unknown; revid?: unknown } };
    if (typeof payload.parse?.text !== "string" || typeof payload.parse.revid !== "number") {
      throw new Error("Unable to load boss drops.");
    }
    const parsed = parseBossDropHtml(payload.parse.text, source);
    if (!parsed.drops.length) throw new Error("Unable to load boss drops.");
    return {
      ...parsed,
      source: { page: source.page, url: wikiPageUrl(source.page), revision: payload.parse.revid },
      fetchedAt: new Date().toISOString()
    };
  }));
}

export async function getBossLoot(boss: BossDefinition): Promise<BossLoot> {
  // Cache successful sources, rather than degraded aggregates, so a failed
  // supporting page can be retried without refetching healthy pages.
  const results = await Promise.allSettled(boss.sources.map(getWikiLootSource));
  const fulfilled = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  if (!fulfilled.length) throw new Error("Unable to load boss drops.");
  const drops = fulfilled.flatMap((result) => result.drops);
  const notes = fulfilled.flatMap((result) => result.notes);
  const sources = fulfilled.map((result) => result.source);
  const fetchedTimes = fulfilled.map((result) => result.fetchedAt);
  let partial = results.some((result) => result.status === "rejected") || fulfilled.some((result) => result.partial);
  const seen = new Set(boss.sources.map((source) => source.page));
  const queue = fulfilled.flatMap((result) => result.sharedTables);
  while (queue.length && seen.size < boss.sources.length + 7) {
    const page = queue.shift()!;
    if (seen.has(page)) continue;
    seen.add(page);
    try {
      const shared = await getWikiLootSource(SHARED_DROP_SOURCES[page]);
      drops.push(...shared.drops.map((drop) => ({ ...drop, group: `${page} (conditional) › ${drop.group}` })));
      notes.push(`Rates in ${page} apply after rolling that shared table, not directly per boss kill.`, ...shared.notes);
      if (!sources.some((source) => source.page === shared.source.page)) sources.push(shared.source);
      fetchedTimes.push(shared.fetchedAt);
      queue.push(...shared.sharedTables);
      partial ||= shared.partial;
    } catch {
      partial = true;
    }
  }
  if (queue.some((page) => !seen.has(page))) partial = true;
  return {
    drops, notes: [...new Set(notes)], sources,
    fetchedAt: fetchedTimes.sort()[0], partial
  };
}

export async function getItems(): Promise<ItemMeta[]> {
  return cached("mapping", mappingCacheMs(), async () => {
    const rows = await wikiFetch<WikiMappingItem[]>("/mapping");
    return rows.map(normalizeItem).sort((a, b) => a.name.localeCompare(b.name));
  });
}

export async function getLatestPrices(): Promise<LatestPrice[]> {
  return cached("latest", latestCacheMs(), async () => {
    const response = await wikiFetch<{ data: Record<string, WikiLatestPrice> }>("/latest");
    return Object.entries(response.data).map(([id, price]) => ({
      id: Number(id),
      high: price.high,
      highTime: price.highTime,
      low: price.low,
      lowTime: price.lowTime
    }));
  });
}

export async function getTimeseries(id: number, timestep: string): Promise<PricePoint[]> {
  const safeTimestep = ["5m", "1h", "6h", "24h"].includes(timestep) ? timestep : "1h";
  return cached(`timeseries:${id}:${safeTimestep}`, timeseriesCacheMs(), async () => {
    const response = await wikiFetch<{ data: WikiTimeseriesPoint[] }>(
      `/timeseries?id=${id}&timestep=${safeTimestep}`
    );

    return response.data.map((point) => ({
      timestamp: point.timestamp,
      avgHighPrice: point.avgHighPrice,
      avgLowPrice: point.avgLowPrice,
      highPriceVolume: point.highPriceVolume,
      lowPriceVolume: point.lowPriceVolume
    }));
  });
}

export async function get24hPrices(): Promise<MarketSummary[]> {
  return cached("24h", timeseriesCacheMs(), async () => {
    const response = await wikiFetch<{ data: Record<string, WikiMarketSummary> }>("/24h");
    return Object.entries(response.data).map(([id, summary]) => ({
      id: Number(id),
      avgHighPrice: summary.avgHighPrice,
      highPriceVolume: summary.highPriceVolume,
      avgLowPrice: summary.avgLowPrice,
      lowPriceVolume: summary.lowPriceVolume
    }));
  });
}

async function wikiFetch<T>(path: string): Promise<T> {
  const contact = process.env.USER_AGENT_CONTACT;
  if (!contact) {
    throw new Error("USER_AGENT_CONTACT is required for OSRS Wiki API requests.");
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "User-Agent": `Merchvision/0.1 (${contact})`,
      Accept: "application/json"
    },
    next: { revalidate: 0 }
  });

  if (!response.ok) {
    throw new Error(`OSRS Wiki API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}

async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const existing = cache.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > Date.now()) {
    return existing.value;
  }

  const inFlight = pending.get(key) as Promise<T> | undefined;
  if (inFlight) {
    return inFlight;
  }

  const request = loader()
    .then((value) => {
      cache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}

function latestCacheMs(): number {
  return envSeconds("OSRS_LATEST_CACHE_SECONDS", 60) * 1000;
}

function mappingCacheMs(): number {
  return envSeconds("OSRS_MAPPING_CACHE_SECONDS", 86_400) * 1000;
}

function timeseriesCacheMs(): number {
  return envSeconds("OSRS_TIMESERIES_CACHE_SECONDS", 300) * 1000;
}

function envSeconds(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeItem(item: WikiMappingItem): ItemMeta {
  return {
    id: item.id,
    name: item.name,
    examine: item.examine,
    members: item.members,
    lowalch: item.lowalch,
    highalch: item.highalch,
    limit: item.limit,
    icon: toWikiImageUrl(item.icon)
  };
}

export function toWikiImageUrl(icon?: string): string | undefined {
  if (!icon) {
    return undefined;
  }

  if (icon.startsWith("http://") || icon.startsWith("https://")) {
    return icon;
  }

  const filename = icon.trim().replaceAll(" ", "_");
  return `${WIKI_IMAGE_BASE_URL}/${encodeURIComponent(filename)}`;
}

type WikiMappingItem = {
  id: number;
  name: string;
  examine?: string;
  members: boolean;
  lowalch?: number;
  highalch?: number;
  limit?: number;
  icon?: string;
};

type WikiLatestPrice = {
  high?: number;
  highTime?: number;
  low?: number;
  lowTime?: number;
};

type WikiTimeseriesPoint = {
  timestamp: number;
  avgHighPrice?: number;
  avgLowPrice?: number;
  highPriceVolume?: number;
  lowPriceVolume?: number;
};

type WikiMarketSummary = {
  avgHighPrice?: number;
  highPriceVolume?: number;
  avgLowPrice?: number;
  lowPriceVolume?: number;
};
