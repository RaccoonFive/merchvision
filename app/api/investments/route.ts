import { NextResponse } from "next/server";
import { buildInvestmentCandidates, filterAndSortInvestments, matchedVolume } from "@/lib/investments";
import { get24hPrices, getItems, getTimeseries } from "@/lib/osrsWiki";
import { parseInvestmentFilters } from "@/lib/query";
import type { InvestmentCandidate, ItemMeta, MarketSummary, PricePoint } from "@/lib/types";

const SHORTLIST_SIZE = 250;
const HISTORY_CONCURRENCY = 10;

type InvestmentUniverse = {
  candidates: InvestmentCandidate[];
  shortlisted: number;
  analyzed: number;
  skipped: number;
};

let universeMemo: {
  items: ItemMeta[];
  summaries: MarketSummary[];
  value: Promise<InvestmentUniverse>;
} | undefined;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseInvestmentFilters(searchParams);
    const [items, summaries] = await Promise.all([getItems(), get24hPrices()]);
    const universe = await loadCandidateUniverse(items, summaries);
    const data = filterAndSortInvestments(universe.candidates, filters);

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
        qualified: universe.candidates.length,
        shortlisted: universe.shortlisted,
        analyzed: universe.analyzed,
        skipped: universe.skipped,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to find investments." },
      { status: 500 }
    );
  }
}

async function loadCandidateUniverse(
  items: ItemMeta[],
  summaries: MarketSummary[]
): Promise<InvestmentUniverse> {
  if (universeMemo?.items === items && universeMemo.summaries === summaries) {
    return universeMemo.value;
  }

  const value = (async () => {
    const itemIds = new Set(items.map((item) => item.id));
    const shortlist = summaries
      .filter((summary) => itemIds.has(summary.id))
      .sort((a, b) => matchedVolume(b) - matchedVolume(a))
      .slice(0, SHORTLIST_SIZE);
    const histories = await loadHistories(shortlist.map((summary) => summary.id));
    const candidates = buildInvestmentCandidates({ items, summaries: shortlist, histories });
    return {
      candidates,
      shortlisted: shortlist.length,
      analyzed: histories.size,
      skipped: shortlist.length - histories.size
    };
  })();

  universeMemo = { items, summaries, value };
  value.catch(() => {
    if (universeMemo?.value === value) universeMemo = undefined;
  });
  return value;
}

async function loadHistories(ids: number[]): Promise<Map<number, PricePoint[]>> {
  const histories = new Map<number, PricePoint[]>();

  for (let index = 0; index < ids.length; index += HISTORY_CONCURRENCY) {
    const batch = ids.slice(index, index + HISTORY_CONCURRENCY);
    const results = await Promise.allSettled(batch.map((id) => getTimeseries(id, "1h")));
    results.forEach((result, resultIndex) => {
      if (result.status === "fulfilled") {
        histories.set(batch[resultIndex], result.value);
      }
    });
  }

  return histories;
}
