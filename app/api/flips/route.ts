import { NextResponse } from "next/server";
import { parseFlipFilters } from "@/lib/query";
import { getItems, getLatestPrices, getRecentVolumes } from "@/lib/osrsWiki";
import { buildFlipCandidates, filterAndSortFlips } from "@/lib/scoring";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const filters = parseFlipFilters(searchParams);
    const [items, prices] = await Promise.all([getItems(), getLatestPrices()]);
    const preliminary = buildFlipCandidates({ items, prices });
    const volumeTargets = preliminary
      .sort((a, b) => b.netProfit - a.netProfit)
      .slice(0, 100)
      .map((candidate) => candidate.id);
    const volumesByItem = await getRecentVolumes(volumeTargets);
    const candidates = buildFlipCandidates({ items, prices, volumesByItem });
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
