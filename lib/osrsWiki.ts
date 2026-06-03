import type { ItemMeta, LatestPrice, PricePoint } from "./types";

const BASE_URL = "https://prices.runescape.wiki/api/v1/osrs";
const WIKI_IMAGE_BASE_URL = "https://oldschool.runescape.wiki/images";

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const cache = new Map<string, CacheEntry<unknown>>();

export async function getItems(): Promise<ItemMeta[]> {
  const rows = await getMappingRows();
  return rows.map(normalizeItem).sort((a, b) => a.name.localeCompare(b.name));
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
}

export async function getRecentVolumes(ids: number[]): Promise<Map<number, number>> {
  const uniqueIds = ids.slice(0, 100);
  const pairs = await Promise.all(
    uniqueIds.map(async (id) => {
      try {
        const points = await getTimeseries(id, "1h");
        const volume = points
          .slice(-12)
          .reduce((total, point) => total + (point.highPriceVolume ?? 0) + (point.lowPriceVolume ?? 0), 0);
        return [id, volume] as const;
      } catch {
        return [id, 0] as const;
      }
    })
  );

  return new Map(pairs);
}

async function getMappingRows(): Promise<WikiMappingItem[]> {
  return cached("mapping:raw", mappingCacheMs(), () => wikiFetch<WikiMappingItem[]>("/mapping"));
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

  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

function latestCacheMs(): number {
  return envSeconds("OSRS_LATEST_CACHE_SECONDS", 60) * 1000;
}

function mappingCacheMs(): number {
  return envSeconds("OSRS_MAPPING_CACHE_SECONDS", 86_400) * 1000;
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
