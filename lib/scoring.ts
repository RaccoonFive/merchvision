import { calculateGeTax } from "./tax";
import type { FlipCandidate, FlipFilters, ItemMeta, LatestPrice, PricePoint } from "./types";

const STALE_AFTER_SECONDS = 15 * 60;
const VERY_STALE_AFTER_SECONDS = 60 * 60;

type BuildCandidatesInput = {
  items: ItemMeta[];
  prices: LatestPrice[];
  volumesByItem?: Map<number, number>;
  nowSeconds?: number;
};

export function buildFlipCandidates({
  items,
  prices,
  volumesByItem = new Map<number, number>(),
  nowSeconds = Math.floor(Date.now() / 1000)
}: BuildCandidatesInput): FlipCandidate[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const candidates: FlipCandidate[] = [];

  for (const price of prices) {
    const item = itemsById.get(price.id);
    if (!item || !price.high || !price.low || !price.highTime || !price.lowTime) {
      continue;
    }

    const buyPrice = price.low;
    const sellPrice = price.high;
    const margin = sellPrice - buyPrice;
    const tax = calculateGeTax(sellPrice);
    const netProfit = margin - tax;
    const roi = buyPrice > 0 ? netProfit / buyPrice : 0;
    const freshestTrade = Math.max(price.highTime, price.lowTime);
    const freshnessSeconds = Math.max(0, nowSeconds - freshestTrade);
    const volume = volumesByItem.get(price.id) ?? 0;
    const warnings = buildWarnings({ item, netProfit, freshnessSeconds, volume });
    const score = scoreFlip({ netProfit, roi, volume, freshnessSeconds, buyLimit: item.limit });

    if (netProfit <= 0) {
      continue;
    }

    candidates.push({
      id: item.id,
      name: item.name,
      members: item.members,
      icon: item.icon,
      buyLimit: item.limit,
      buyPrice,
      sellPrice,
      margin,
      tax,
      netProfit,
      roi,
      highTime: price.highTime,
      lowTime: price.lowTime,
      freshnessSeconds,
      volume,
      score,
      warnings
    });
  }

  return candidates;
}

export function filterAndSortFlips(candidates: FlipCandidate[], filters: FlipFilters): FlipCandidate[] {
  const search = filters.search?.trim().toLowerCase();
  const includeStale = filters.includeStale ?? false;
  const sort = filters.sort ?? "score";

  return candidates
    .filter((candidate) => {
      if (search && !candidate.name.toLowerCase().includes(search)) return false;
      if ((filters.minProfit ?? 0) > candidate.netProfit) return false;
      if ((filters.minRoi ?? 0) / 100 > candidate.roi) return false;
      if ((filters.minVolume ?? 0) > candidate.volume) return false;
      if ((filters.maxPrice ?? 0) > 0 && candidate.buyPrice > (filters.maxPrice ?? 0)) return false;
      if (filters.members === "members" && !candidate.members) return false;
      if (filters.members === "f2p" && candidate.members) return false;
      if (!includeStale && candidate.freshnessSeconds > VERY_STALE_AFTER_SECONDS) return false;
      return true;
    })
    .sort((a, b) => getSortValue(b, sort) - getSortValue(a, sort))
    .slice(0, 250);
}

export function volumeFromTimeseries(points: PricePoint[]): number {
  return points.reduce((total, point) => total + (point.highPriceVolume ?? 0) + (point.lowPriceVolume ?? 0), 0);
}

function buildWarnings({
  item,
  netProfit,
  freshnessSeconds,
  volume
}: {
  item: ItemMeta;
  netProfit: number;
  freshnessSeconds: number;
  volume: number;
}): string[] {
  const warnings: string[] = [];
  if (!item.limit) warnings.push("Unknown buy limit");
  if (volume < 100) warnings.push("Thin volume");
  if (freshnessSeconds > STALE_AFTER_SECONDS) warnings.push("Stale quotes");
  if (netProfit < 100) warnings.push("Small margin");
  return warnings;
}

function scoreFlip({
  netProfit,
  roi,
  volume,
  freshnessSeconds,
  buyLimit
}: {
  netProfit: number;
  roi: number;
  volume: number;
  freshnessSeconds: number;
  buyLimit?: number;
}): number {
  const profitScore = Math.log10(Math.max(netProfit, 1)) * 22;
  const roiScore = Math.min(Math.max(roi, 0), 0.2) * 180;
  const volumeScore = Math.min(Math.log10(Math.max(volume, 1)) * 12, 48);
  const limitScore = buyLimit ? Math.min(Math.log10(buyLimit) * 5, 20) : -15;
  const stalePenalty = Math.min(freshnessSeconds / 90, 45);

  return Math.max(0, Math.round(profitScore + roiScore + volumeScore + limitScore - stalePenalty));
}

function getSortValue(candidate: FlipCandidate, sort: NonNullable<FlipFilters["sort"]>): number {
  switch (sort) {
    case "profit":
      return candidate.netProfit;
    case "roi":
      return candidate.roi;
    case "volume":
      return candidate.volume;
    case "freshness":
      return -candidate.freshnessSeconds;
    case "score":
    default:
      return candidate.score;
  }
}
