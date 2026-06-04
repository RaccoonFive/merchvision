export type ItemMeta = {
  id: number;
  name: string;
  examine?: string;
  members: boolean;
  lowalch?: number;
  highalch?: number;
  limit?: number;
  icon?: string;
};

export type LatestPrice = {
  id: number;
  high?: number;
  highTime?: number;
  low?: number;
  lowTime?: number;
};

export type ItemQuote = {
  high: number | null;
  low: number | null;
  highTime: number | null;
  lowTime: number | null;
  margin: number | null;
  tax: number | null;
  netProfit: number | null;
  roi: number | null;
  freshnessSeconds: number | null;
};

export type ItemQuoteResponse = {
  item: ItemMeta;
  quote: ItemQuote;
};

export type FavoriteItem = ItemQuoteResponse & {
  favoritedAt: string;
};

export type PricePoint = {
  timestamp: number;
  avgHighPrice?: number;
  avgLowPrice?: number;
  highPriceVolume?: number;
  lowPriceVolume?: number;
};

export type MarketSummary = {
  id: number;
  avgHighPrice?: number;
  highPriceVolume?: number;
  avgLowPrice?: number;
  lowPriceVolume?: number;
};

export type InvestmentAnalysis = {
  currentMidpoint: number;
  shortTrend: number;
  mediumTrend: number;
  volatility: number;
  consistency: number;
  confidence: number;
  shortCoverage: number;
  mediumCoverage: number;
  sampleCount: number;
};

export type InvestmentCandidate = InvestmentAnalysis & {
  id: number;
  name: string;
  members: boolean;
  icon?: string;
  buyLimit?: number;
  matchedVolume: number;
  liquidityPercentile: number;
  score: number;
  warnings: string[];
};

export type InvestmentFilters = {
  search?: string;
  minShortTrend?: number;
  minMediumTrend?: number;
  minVolume?: number;
  maxPrice?: number;
  members?: "all" | "members" | "f2p";
  sort?: "score" | "shortTrend" | "mediumTrend" | "volume" | "volatility";
};

export type FlipCandidate = {
  id: number;
  name: string;
  members: boolean;
  icon?: string;
  buyLimit?: number;
  buyPrice: number;
  sellPrice: number;
  margin: number;
  tax: number;
  netProfit: number;
  roi: number;
  highTime: number;
  lowTime: number;
  freshnessSeconds: number;
  volume: number;
  score: number;
  warnings: string[];
};

export type FlipFilters = {
  search?: string;
  minProfit?: number;
  minRoi?: number;
  minVolume?: number;
  maxPrice?: number;
  members?: "all" | "members" | "f2p";
  includeStale?: boolean;
  sort?: "score" | "profit" | "roi" | "volume" | "freshness";
};

export type TaxConfig = {
  rate: number;
  cap: number;
};
