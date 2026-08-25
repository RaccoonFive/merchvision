import { NextResponse } from "next/server";
import { parseFlipFilters } from "@/lib/query";
import { get24hPrices, getItems, getLatestPrices, getTimeseries } from "@/lib/osrsWiki";
import { analyzeMarket, buildFlipCandidates, filterAndSortFlips, volumeFromTimeseries } from "@/lib/scoring";
import type { FlipCandidate, ItemMeta, MarketAnalysis, MarketSummary, PricePoint } from "@/lib/types";

const HISTORY_SHORTLIST_SIZE = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFlipFilters(searchParams);
    const [items, prices, summaries] = await Promise.all([
      getItems(),
      getLatestPrices(),
      get24hPrices().catch(() => undefined)
    ]);
    const preliminary = buildFlipCandidates({ items, prices });
    const historyTargets = historyShortlist(preliminary, summaries, HISTORY_SHORTLIST_SIZE);
    const timeseriesByItem = await getRecentTimeseries(historyTargets.map((candidate) => candidate.id));
    const volumesByItem = volumesFromTimeseries(timeseriesByItem);
    const analysesByItem = getMarketAnalyses(historyTargets, items, timeseriesByItem);
    const candidates = buildFlipCandidates({ items, prices, volumesByItem, analysesByItem });
    const data = filterAndSortFlips(candidates, filters);

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to rank flips." },
      { status: 500 }
    );
  }
}

function historyShortlist(
  candidates: FlipCandidate[],
  summaries: MarketSummary[] | undefined,
  limit: number
): FlipCandidate[] {
  const selected = new Map<number, FlipCandidate>();
  const profitRanked = topBy(candidates, candidates.length, (candidate) => candidate.netProfit);
  const roiRanked = topBy(candidates, candidates.length, (candidate) => candidate.roi);

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
  const liquidityRanked = topBy(
    candidates,
    candidates.length,
    (candidate) => matchedVolumeByItem.get(candidate.id) ?? 0
  );

  addCandidates(selected, liquidityRanked.slice(0, Math.ceil(limit / 2)), limit);
  addCandidates(selected, profitRanked.slice(0, Math.ceil(limit / 4)), limit);
  addCandidates(selected, roiRanked.slice(0, Math.floor(limit / 4)), limit);
  addCandidates(selected, liquidityRanked, limit);

  return [...selected.values()];
}

function topBy(candidates: FlipCandidate[], limit: number, value: (candidate: FlipCandidate) => number): FlipCandidate[] {
  return [...candidates].sort((a, b) => value(b) - value(a)).slice(0, limit);
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
  ) {
    return 0;
  }

  return Math.min(highVolume, lowVolume);
}

async function getRecentTimeseries(ids: number[]): Promise<Map<number, PricePoint[]>> {
  const pairs = await Promise.all(
    ids.map(async (id) => {
      try {
        return [id, await getTimeseries(id, "1h")] as const;
      } catch {
        return [id, [] as PricePoint[]] as const;
      }
    })
  );

  return new Map(pairs);
}

function volumesFromTimeseries(timeseriesByItem: Map<number, PricePoint[]>): Map<number, number> {
  return new Map(
    [...timeseriesByItem.entries()].map(([id, points]) => [id, volumeFromTimeseries(points.slice(-12))])
  );
}

function getMarketAnalyses(
  candidates: FlipCandidate[],
  items: ItemMeta[],
  timeseriesByItem: Map<number, PricePoint[]>
): Map<number, MarketAnalysis> {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const pairs = candidates.map(
    (candidate) =>
      [candidate.id, analyzeMarket(timeseriesByItem.get(candidate.id) ?? [], itemsById.get(candidate.id)?.limit)] as const
  );

  return new Map(pairs);
}
