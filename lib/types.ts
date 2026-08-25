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

export type InvestmentLotInput = {
  itemId: number;
  quantity: number;
  unitPricePaid: number;
};

export type InvestmentLotUpdateInput = Omit<InvestmentLotInput, "itemId">;

export type PersistedInvestmentLot = InvestmentLotInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

export type TrackedInvestmentLot = PersistedInvestmentLot & {
  item: ItemMeta | null;
  instantSellPrice: number | null;
  instantSellTime: number | null;
  freshnessSeconds: number | null;
  taxPerUnit: number | null;
  netLiquidationPrice: number | null;
  totalCost: number;
  currentNetValue: number | null;
  currentProfit: number | null;
  roi: number | null;
  warnings: string[];
};

export type InvestmentTrackerSummary = {
  lotCount: number;
  totalCost: number;
  valuedCost: number;
  currentNetValue: number;
  currentProfit: number;
  roi: number | null;
  unavailableLotCount: number;
  isPartial: boolean;
  generatedAt: string;
};

export type PricePoint = {
  timestamp: number;
  avgHighPrice?: number;
  avgLowPrice?: number;
  highPriceVolume?: number;
  lowPriceVolume?: number;
};

export type MarketRhythmSample = {
  timestamp: number;
  netMargin: number;
  matchedVolume: number | null;
};

export type MarketRhythm = {
  samples: MarketRhythmSample[];
  sampleCount: number;
  sourcePointCount: number;
  positiveSpreadRatio: number;
  medianMatchedHourlyVolume: number | null;
  midpointPriceVolatility: number;
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

export type MarketAnalysis = {
  historicalNetMarginMedian: number;
  historicalNetMarginVariability: number;
  positiveSpreadRatio: number;
  midpointPriceVolatility: number;
  medianMatchedHourlyVolume: number;
  sampleCount: number;
  sampleCoverage: number;
  estimatedExecutableUnitsPerHour: number;
  rawExpectedGpPerHour: number;
  confidence: number;
  volatilityPenalty: number;
};

export type FlipScoreComponent = {
  label: string;
  points: number;
  kind: "driver" | "penalty";
};

export type FlipScoreBreakdown = {
  components: FlipScoreComponent[];
  rawScore: number;
  score: number;
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
  repeatableNetProfit: number | null;
  conservativeExpectedGpPerHour: number | null;
  score: number;
  scoreBreakdown: FlipScoreBreakdown;
  marketAnalysis?: MarketAnalysis;
  confidence: number;
  stability: number;
  totalBuyLimitProfit: number;
  warnings: string[];
};

export type FlipFilters = {
  search?: string;
  minProfit?: number;
  minRoi?: number;
  minVolume?: number;
  minConfidence?: number;
  minStability?: number;
  minTotalBuyLimitProfit?: number;
  maxPrice?: number;
  members?: "all" | "members" | "f2p";
  includeStale?: boolean;
  includeLowConfidence?: boolean;
  sort?: "score" | "confidence" | "stability" | "totalBuyLimitProfit" | "profit" | "typicalProfit" | "expectedGpPerHour" | "roi" | "volume" | "freshness";
};

export type TaxConfig = {
  rate: number;
  cap: number;
};
