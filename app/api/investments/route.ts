import { NextResponse } from "next/server";
import { buildInvestmentCandidates, filterAndSortInvestments, matchedVolume } from "@/lib/investments";
import { get24hPrices, getItems, getTimeseries } from "@/lib/osrsWiki";
import { parseInvestmentFilters } from "@/lib/query";
import type { PricePoint } from "@/lib/types";

const SHORTLIST_SIZE = 100;
const HISTORY_CONCURRENCY = 10;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseInvestmentFilters(searchParams);
    const [items, summaries] = await Promise.all([getItems(), get24hPrices()]);
    const itemIds = new Set(items.map((item) => item.id));
    const shortlist = summaries
      .filter((summary) => itemIds.has(summary.id))
      .sort((a, b) => matchedVolume(b) - matchedVolume(a))
      .slice(0, SHORTLIST_SIZE);
    const histories = await loadHistories(shortlist.map((summary) => summary.id));
    const candidates = buildInvestmentCandidates({ items, summaries: shortlist, histories });
    const data = filterAndSortInvestments(candidates, filters);

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
        shortlisted: shortlist.length,
        analyzed: histories.size,
        skipped: shortlist.length - histories.size,
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
