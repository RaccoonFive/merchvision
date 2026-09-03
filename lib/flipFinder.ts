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
  LatestPrice,
  MarketAnalysis,
  MarketSummary,
  PricePoint,
  UpsideFlipCandidate,
  UpsideFlipFilters
} from "./types";

const RELIABLE_HISTORY_SHORTLIST_SIZE = 100;
const UPSIDE_HISTORY_BATCH_SIZE = 10;
const SNAPSHOT_TIME_BUCKET_SECONDS = 60;

type UniverseMemo<T> = {
  items: ItemMeta[];
  prices: LatestPrice[];
  summaries: MarketSummary[] | undefined;
  timeBucket: number;
  value: Promise<FlipUniverseResult<T>>;
};

export type FlipDataHealth = {
  summaryAvailable: boolean;
  historyRequested: number;
  historySucceeded: number;
  historyFailed: number;
  isPartial: boolean;
};

export type FlipLoadResult<T> = {
  data: T[];
  health: FlipDataHealth;
};

type FlipUniverseResult<T> = FlipLoadResult<T>;

type TimeseriesLoadResult = {
  pointsByItem: Map<number, PricePoint[]>;
  failed: number;
};

let reliableUniverseMemo: UniverseMemo<FlipCandidate> | undefined;
let upsideUniverseMemo: UniverseMemo<UpsideFlipCandidate> | undefined;

export async function loadReliableFlips(filters: FlipFilters): Promise<FlipCandidate[]> {
  return (await loadReliableFlipResult(filters)).data;
}

export async function loadReliableFlipResult(filters: FlipFilters): Promise<FlipLoadResult<FlipCandidate>> {
  const result = await loadReliableUniverseResult();
  return { data: filterAndSortFlips(result.data, filters), health: result.health };
}

export async function loadReliableCandidateUniverse(): Promise<FlipCandidate[]> {
  return (await loadReliableUniverseResult()).data;
}

async function loadReliableUniverseResult(): Promise<FlipUniverseResult<FlipCandidate>> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const [items, prices, summaries] = await Promise.all([
    getItems(),
    getLatestPrices(),
    get24hPrices().catch(() => undefined)
  ]);
  const timeBucket = Math.floor(nowSeconds / SNAPSHOT_TIME_BUCKET_SECONDS);

  if (memoMatches(reliableUniverseMemo, items, prices, summaries, timeBucket)) {
    return reliableUniverseMemo.value;
  }

  const value = (async () => {
    const preliminary = buildFlipCandidates({ items, prices, nowSeconds });
    const historyTargets = reliableHistoryShortlist(preliminary, summaries, RELIABLE_HISTORY_SHORTLIST_SIZE);
    const histories = await getRecentTimeseries(
      historyTargets.map((candidate) => candidate.id),
      "1h"
    );
    const volumesByItem = new Map(
      [...histories.pointsByItem.entries()].map(([id, points]) => [id, volumeFromTimeseries(points.slice(-12))])
    );
    const analysesByItem = reliableMarketAnalyses(historyTargets, items, histories.pointsByItem);
    return {
      data: buildFlipCandidates({ items, prices, volumesByItem, analysesByItem, nowSeconds }),
      health: dataHealth(summaries, historyTargets.length, histories.failed)
    };
  })();

  reliableUniverseMemo = { items, prices, summaries, timeBucket, value };
  value.catch(() => {
    if (reliableUniverseMemo?.value === value) reliableUniverseMemo = undefined;
  });
  return value;
}

export async function loadUpsideFlips(filters: UpsideFlipFilters): Promise<UpsideFlipCandidate[]> {
  return (await loadUpsideFlipResult(filters)).data;
}

export async function loadUpsideFlipResult(filters: UpsideFlipFilters): Promise<FlipLoadResult<UpsideFlipCandidate>> {
  const result = await loadUpsideUniverseResult();
  return { data: filterAndSortUpsideFlips(result.data, filters), health: result.health };
}

export async function loadUpsideCandidateUniverse(): Promise<UpsideFlipCandidate[]> {
  return (await loadUpsideUniverseResult()).data;
}

async function loadUpsideUniverseResult(): Promise<FlipUniverseResult<UpsideFlipCandidate>> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const [items, prices, summaries] = await Promise.all([
    getItems(),
    getLatestPrices(),
    get24hPrices().catch(() => undefined)
  ]);
  const timeBucket = Math.floor(nowSeconds / SNAPSHOT_TIME_BUCKET_SECONDS);

  if (memoMatches(upsideUniverseMemo, items, prices, summaries, timeBucket)) {
    return upsideUniverseMemo.value;
  }

  const value = (async () => {
    const preliminary = buildFlipCandidates({ items, prices, nowSeconds });
    const targets = buildUpsideShortlist(preliminary, summaries);
    const targetIds = new Set(targets.map((candidate) => candidate.id));
    const histories = await getRecentTimeseriesBatched(
      targets.map((candidate) => candidate.id),
      "5m",
      UPSIDE_HISTORY_BATCH_SIZE
    );

    return {
      data: buildUpsideCandidates({
        items,
        prices: prices.filter((price) => targetIds.has(price.id)),
        pointsByItem: histories.pointsByItem,
        nowSeconds
      }),
      health: dataHealth(summaries, targets.length, histories.failed)
    };
  })();

  upsideUniverseMemo = { items, prices, summaries, timeBucket, value };
  value.catch(() => {
    if (upsideUniverseMemo?.value === value) upsideUniverseMemo = undefined;
  });
  return value;
}

function memoMatches<T>(
  memo: UniverseMemo<T> | undefined,
  items: ItemMeta[],
  prices: LatestPrice[],
  summaries: MarketSummary[] | undefined,
  timeBucket: number
): memo is UniverseMemo<T> {
  return memo?.items === items &&
    memo.prices === prices &&
    memo.summaries === summaries &&
    memo.timeBucket === timeBucket;
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

async function getRecentTimeseries(ids: number[], timestep: "1h" | "5m"): Promise<TimeseriesLoadResult> {
  let failed = 0;
  const pairs = await Promise.all(
    ids.map(async (id) => {
      try {
        return [id, await getTimeseries(id, timestep)] as const;
      } catch {
        failed += 1;
        return [id, [] as PricePoint[]] as const;
      }
    })
  );
  return { pointsByItem: new Map(pairs), failed };
}

async function getRecentTimeseriesBatched(
  ids: number[],
  timestep: "5m",
  batchSize: number
): Promise<TimeseriesLoadResult> {
  const pairs: Array<readonly [number, PricePoint[]]> = [];
  let failed = 0;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batch = ids.slice(index, index + batchSize);
    const results = await Promise.all(
      batch.map(async (id) => {
        try {
          return [id, await getTimeseries(id, timestep)] as const;
        } catch {
          failed += 1;
          return [id, [] as PricePoint[]] as const;
        }
      })
    );
    pairs.push(...results);
  }

  return { pointsByItem: new Map(pairs), failed };
}

function dataHealth(
  summaries: MarketSummary[] | undefined,
  historyRequested: number,
  historyFailed: number
): FlipDataHealth {
  return {
    summaryAvailable: Boolean(summaries?.length),
    historyRequested,
    historySucceeded: historyRequested - historyFailed,
    historyFailed,
    isPartial: !summaries?.length || historyFailed > 0
  };
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
