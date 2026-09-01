import { get24hPrices, getItems, getLatestPrices, getTimeseries } from "./osrsWiki";
import { analyzeMarket, buildFlipCandidates, filterAndSortFlips, volumeFromTimeseries } from "./scoring";
import {
  buildUpsideCandidates,
  buildUpsideShortlist,
  filterAndSortUpsideFlips
} from "./upsideScoring";
import type {
  FlipCandidate,
  FlipFilters,
  ItemMeta,
  MarketAnalysis,
  MarketSummary,
  PricePoint,
  UpsideFlipCandidate,
  UpsideFlipFilters
} from "./types";

const RELIABLE_HISTORY_SHORTLIST_SIZE = 100;
const UPSIDE_HISTORY_BATCH_SIZE = 10;

export async function loadReliableFlips(filters: FlipFilters): Promise<FlipCandidate[]> {
  return filterAndSortFlips(await loadReliableCandidateUniverse(), filters);
}

export async function loadReliableCandidateUniverse(): Promise<FlipCandidate[]> {
  const [items, prices, summaries] = await Promise.all([
    getItems(),
    getLatestPrices(),
    get24hPrices().catch(() => undefined)
  ]);
  const preliminary = buildFlipCandidates({ items, prices });
  const historyTargets = reliableHistoryShortlist(preliminary, summaries, RELIABLE_HISTORY_SHORTLIST_SIZE);
  const timeseriesByItem = await getRecentTimeseries(
    historyTargets.map((candidate) => candidate.id),
    "1h"
  );
  const volumesByItem = new Map(
    [...timeseriesByItem.entries()].map(([id, points]) => [id, volumeFromTimeseries(points.slice(-12))])
  );
  const analysesByItem = reliableMarketAnalyses(historyTargets, items, timeseriesByItem);
  return buildFlipCandidates({ items, prices, volumesByItem, analysesByItem });
}

export async function loadUpsideFlips(filters: UpsideFlipFilters): Promise<UpsideFlipCandidate[]> {
  return filterAndSortUpsideFlips(await loadUpsideCandidateUniverse(), filters);
}

export async function loadUpsideCandidateUniverse(): Promise<UpsideFlipCandidate[]> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const [items, prices, summaries] = await Promise.all([
    getItems(),
    getLatestPrices(),
    get24hPrices().catch(() => undefined)
  ]);
  const preliminary = buildFlipCandidates({ items, prices, nowSeconds });
  const targets = buildUpsideShortlist(preliminary, summaries);
  const targetIds = new Set(targets.map((candidate) => candidate.id));
  const timeseriesByItem = await getRecentTimeseriesBatched(
    targets.map((candidate) => candidate.id),
    "5m",
    UPSIDE_HISTORY_BATCH_SIZE
  );

  return buildUpsideCandidates({
    items,
    prices: prices.filter((price) => targetIds.has(price.id)),
    pointsByItem: timeseriesByItem,
    nowSeconds
  });
}

function reliableHistoryShortlist(
  candidates: FlipCandidate[],
  summaries: MarketSummary[] | undefined,
  limit: number
): FlipCandidate[] {
  const selected = new Map<number, FlipCandidate>();
  const profitRanked = topBy(candidates, (candidate) => candidate.netProfit);
  const roiRanked = topBy(candidates, (candidate) => candidate.roi);

  if (!summaries || summaries.length === 0) {
    addCandidates(selected, profitRanked.slice(0, Math.ceil(limit / 2)), limit);
    addCandidates(selected, roiRanked.slice(0, Math.floor(limit / 2)), limit);
    for (let index = 0; selected.size < limit && index < candidates.length; index += 1) {
      addCandidates(selected, [profitRanked[index], roiRanked[index]], limit);
    }
    return [...selected.values()];
  }

  const matchedVolumeByItem = new Map(
    summaries.map((summary) => [summary.id, matchedSummaryVolume(summary)])
  );
  const liquidityRanked = topBy(candidates, (candidate) => matchedVolumeByItem.get(candidate.id) ?? 0);

  addCandidates(selected, liquidityRanked.slice(0, Math.ceil(limit / 2)), limit);
  addCandidates(selected, profitRanked.slice(0, Math.ceil(limit / 4)), limit);
  addCandidates(selected, roiRanked.slice(0, Math.floor(limit / 4)), limit);
  addCandidates(selected, liquidityRanked, limit);
  return [...selected.values()];
}

async function getRecentTimeseries(ids: number[], timestep: "1h" | "5m"): Promise<Map<number, PricePoint[]>> {
  const pairs = await Promise.all(
    ids.map(async (id) => {
      try {
        return [id, await getTimeseries(id, timestep)] as const;
      } catch {
        return [id, [] as PricePoint[]] as const;
      }
    })
  );
  return new Map(pairs);
}

async function getRecentTimeseriesBatched(
  ids: number[],
  timestep: "5m",
  batchSize: number
): Promise<Map<number, PricePoint[]>> {
  const pairs: Array<readonly [number, PricePoint[]]> = [];

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return [id, await getTimeseries(id, timestep)] as const;
        } catch {
          return [id, [] as PricePoint[]] as const;
        }
      })
    );
    pairs.push(...results);
  }

  return new Map(pairs);
}

function reliableMarketAnalyses(
  candidates: FlipCandidate[],
  items: ItemMeta[],
  timeseriesByItem: Map<number, PricePoint[]>
): Map<number, MarketAnalysis> {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return new Map(candidates.map((candidate) => [
    candidate.id,
    analyzeMarket(timeseriesByItem.get(candidate.id) ?? [], itemsById.get(candidate.id)?.limit)
  ]));
}

function topBy(candidates: FlipCandidate[], value: (candidate: FlipCandidate) => number): FlipCandidate[] {
  return [...candidates].sort((a, b) => value(b) - value(a) || a.id - b.id);
}

function addCandidates(
  selected: Map<number, FlipCandidate>,
  candidates: Array<FlipCandidate | undefined>,
  limit: number
) {
  for (const candidate of candidates) {
    if (!candidate || selected.size >= limit) break;
    selected.set(candidate.id, candidate);
  }
}

function matchedSummaryVolume(summary: MarketSummary): number {
  const highVolume = summary.highPriceVolume;
  const lowVolume = summary.lowPriceVolume;
  if (
    highVolume === undefined ||
    lowVolume === undefined ||
    !Number.isFinite(highVolume) ||
    !Number.isFinite(lowVolume) ||
    highVolume < 0 ||
    lowVolume < 0
  ) return 0;
  return Math.min(highVolume, lowVolume);
}
