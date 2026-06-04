import type { FlipFilters, InvestmentFilters } from "./types";

export function parseFlipFilters(searchParams: URLSearchParams): FlipFilters {
  const members = searchParams.get("members");
  const sort = searchParams.get("sort");

  return {
    search: searchParams.get("search") ?? undefined,
    minProfit: numericParam(searchParams, "minProfit"),
    minRoi: numericParam(searchParams, "minRoi"),
    minVolume: numericParam(searchParams, "minVolume"),
    maxPrice: numericParam(searchParams, "maxPrice"),
    members: members === "members" || members === "f2p" ? members : "all",
    includeStale: searchParams.get("includeStale") === "true",
    sort:
      sort === "profit" || sort === "roi" || sort === "volume" || sort === "freshness" || sort === "score"
        ? sort
        : "score"
  };
}

export function parseInvestmentFilters(searchParams: URLSearchParams): InvestmentFilters {
  const members = searchParams.get("members");
  const sort = searchParams.get("sort");

  return {
    search: searchParams.get("search") ?? undefined,
    minShortTrend: numericParam(searchParams, "minShortTrend"),
    minMediumTrend: numericParam(searchParams, "minMediumTrend"),
    minVolume: numericParam(searchParams, "minVolume"),
    maxPrice: numericParam(searchParams, "maxPrice"),
    members: members === "members" || members === "f2p" ? members : "all",
    sort:
      sort === "shortTrend" ||
      sort === "mediumTrend" ||
      sort === "volume" ||
      sort === "volatility" ||
      sort === "score"
        ? sort
        : "score"
  };
}

function numericParam(searchParams: URLSearchParams, key: string): number | undefined {
  const value = Number(searchParams.get(key));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}
