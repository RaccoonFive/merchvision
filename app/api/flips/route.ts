import { NextResponse } from "next/server";
import { parseFlipFilters } from "@/lib/query";
import { getItems, getLatestPrices, getTimeseries } from "@/lib/osrsWiki";
import { analyzeMarket, buildFlipCandidates, filterAndSortFlips, volumeFromTimeseries } from "@/lib/scoring";
import type { FlipCandidate, ItemMeta, MarketAnalysis, PricePoint } from "@/lib/types";

const VOLUME_SHORTLIST_SIZE = 100;
const ANALYSIS_SHORTLIST_SIZE = 100;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFlipFilters(searchParams);
    const [items, prices] = await Promise.all([getItems(), getLatestPrices()]);
    const preliminary = buildFlipCandidates({ items, prices });
    const volumeTargets = balancedShortlist(preliminary, VOLUME_SHORTLIST_SIZE).map((candidate) => candidate.id);
    const timeseriesByItem = await getRecentTimeseries(volumeTargets);
    const volumesByItem = volumesFromTimeseries(timeseriesByItem);
    const volumeRanked = buildFlipCandidates({ items, prices, volumesByItem });
    const analysisTargets = balancedShortlist(volumeRanked, ANALYSIS_SHORTLIST_SIZE);
    const analysesByItem = getMarketAnalyses(analysisTargets, items, timeseriesByItem);
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

function balancedShortlist(candidates: FlipCandidate[], limit: number): FlipCandidate[] {
  const selected = new Map<number, FlipCandidate>();
  const bucketSize = Math.ceil(limit / 3);

  for (const candidate of topBy(candidates, bucketSize, (candidate) => candidate.netProfit)) {
    selected.set(candidate.id, candidate);
  }
  for (const candidate of topBy(candidates, bucketSize, (candidate) => candidate.roi)) {
    selected.set(candidate.id, candidate);
  }
  for (const candidate of topBy(candidates, bucketSize, (candidate) => candidate.volume || candidate.score)) {
    selected.set(candidate.id, candidate);
  }

  return [...selected.values()].slice(0, limit);
}

function topBy(candidates: FlipCandidate[], limit: number, value: (candidate: FlipCandidate) => number): FlipCandidate[] {
  return [...candidates].sort((a, b) => value(b) - value(a)).slice(0, limit);
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
