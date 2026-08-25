import { getItems, getLatestPrices } from "./osrsWiki";
import { prisma } from "./prisma";
import { calculateGeTax } from "./tax";
import type {
  InvestmentLotInput,
  InvestmentLotUpdateInput,
  InvestmentTrackerSummary,
  ItemMeta,
  LatestPrice,
  PersistedInvestmentLot,
  TrackedInvestmentLot
} from "./types";

const STALE_AFTER_SECONDS = 60 * 60;
const MAX_DATABASE_INTEGER = 2_147_483_647;

type StoredInvestmentLot = {
  id: string;
  itemId: number;
  quantity: number;
  unitPricePaid: number;
  createdAt: Date;
  updatedAt: Date;
};

export async function getInvestmentTracker(userId: string): Promise<{
  data: TrackedInvestmentLot[];
  meta: InvestmentTrackerSummary;
}> {
  const [lots, items, prices] = await Promise.all([
    prisma.investmentLot.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getItems(),
    getLatestPrices()
  ]);

  return buildInvestmentTracker(lots, items, prices);
}

export async function investmentItemExists(itemId: number): Promise<boolean> {
  const items = await getItems();
  return items.some((item) => item.id === itemId);
}

export function buildInvestmentTracker(
  lots: StoredInvestmentLot[],
  items: ItemMeta[],
  prices: LatestPrice[],
  nowSeconds = Math.floor(Date.now() / 1000)
): { data: TrackedInvestmentLot[]; meta: InvestmentTrackerSummary } {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const pricesById = new Map(prices.map((price) => [price.id, price]));
  const data = lots.map((lot) => enrichInvestmentLot(lot, itemsById.get(lot.itemId), pricesById.get(lot.itemId), nowSeconds));
  const valuedLots = data.filter(
    (lot): lot is TrackedInvestmentLot & { currentNetValue: number; currentProfit: number } =>
      lot.currentNetValue !== null && lot.currentProfit !== null
  );
  const totalCost = sum(data.map((lot) => lot.totalCost));
  const valuedCost = sum(valuedLots.map((lot) => lot.totalCost));
  const currentNetValue = sum(valuedLots.map((lot) => lot.currentNetValue));
  const currentProfit = sum(valuedLots.map((lot) => lot.currentProfit));
  const unavailableLotCount = data.length - valuedLots.length;

  return {
    data,
    meta: {
      lotCount: data.length,
      totalCost,
      valuedCost,
      currentNetValue,
      currentProfit,
      roi: valuedCost > 0 ? currentProfit / valuedCost : null,
      unavailableLotCount,
      isPartial: unavailableLotCount > 0,
      generatedAt: new Date(nowSeconds * 1000).toISOString()
    }
  };
}

export function parseInvestmentLotInput(value: unknown):
  | { data: InvestmentLotInput }
  | { error: string } {
  if (!isRecord(value)) return { error: "Request body must be a JSON object." };

  const itemId = positiveDatabaseInteger(value.itemId);
  const quantity = positiveDatabaseInteger(value.quantity);
  const unitPricePaid = positiveDatabaseInteger(value.unitPricePaid);
  if (!itemId) return { error: "Item id must be a positive integer." };
  if (!quantity) return { error: "Quantity must be a positive integer." };
  if (!unitPricePaid) return { error: "Price paid must be a positive whole GP amount." };
  if (!Number.isSafeInteger(quantity * unitPricePaid)) {
    return { error: "Total cost is too large to track safely." };
  }

  return { data: { itemId, quantity, unitPricePaid } };
}

export function parseInvestmentLotUpdate(value: unknown):
  | { data: InvestmentLotUpdateInput }
  | { error: string } {
  if (!isRecord(value)) return { error: "Request body must be a JSON object." };

  const quantity = positiveDatabaseInteger(value.quantity);
  const unitPricePaid = positiveDatabaseInteger(value.unitPricePaid);
  if (!quantity) return { error: "Quantity must be a positive integer." };
  if (!unitPricePaid) return { error: "Price paid must be a positive whole GP amount." };
  if (!Number.isSafeInteger(quantity * unitPricePaid)) {
    return { error: "Total cost is too large to track safely." };
  }

  return { data: { quantity, unitPricePaid } };
}

export function serializeInvestmentLot(lot: StoredInvestmentLot): PersistedInvestmentLot {
  return {
    id: lot.id,
    itemId: lot.itemId,
    quantity: lot.quantity,
    unitPricePaid: lot.unitPricePaid,
    createdAt: lot.createdAt.toISOString(),
    updatedAt: lot.updatedAt.toISOString()
  };
}

function enrichInvestmentLot(
  lot: StoredInvestmentLot,
  item: ItemMeta | undefined,
  price: LatestPrice | undefined,
  nowSeconds: number
): TrackedInvestmentLot {
  const instantSellPrice = positiveInteger(price?.low);
  const instantSellTime = positiveInteger(price?.lowTime);
  const freshnessSeconds = instantSellTime === null ? null : Math.max(0, nowSeconds - instantSellTime);
  const taxPerUnit = instantSellPrice === null ? null : calculateGeTax(instantSellPrice);
  const netLiquidationPrice = instantSellPrice === null || taxPerUnit === null
    ? null
    : instantSellPrice - taxPerUnit;
  const totalCost = lot.quantity * lot.unitPricePaid;
  const candidateCurrentValue = netLiquidationPrice === null ? null : netLiquidationPrice * lot.quantity;
  const currentNetValue = candidateCurrentValue !== null && Number.isSafeInteger(candidateCurrentValue)
    ? candidateCurrentValue
    : null;
  const currentProfit = currentNetValue === null ? null : currentNetValue - totalCost;
  const warnings: string[] = [];

  if (!item) warnings.push("Item metadata is unavailable.");
  if (instantSellPrice === null) warnings.push("Current instant-sell price is unavailable.");
  if (instantSellPrice !== null && instantSellTime === null) warnings.push("Instant-sell quote time is unavailable.");
  if (freshnessSeconds !== null && freshnessSeconds > STALE_AFTER_SECONDS) {
    warnings.push("Instant-sell quote is over one hour old.");
  }
  if (candidateCurrentValue !== null && currentNetValue === null) {
    warnings.push("Current position value is too large to calculate safely.");
  }

  return {
    ...serializeInvestmentLot(lot),
    item: item ?? null,
    instantSellPrice,
    instantSellTime,
    freshnessSeconds,
    taxPerUnit,
    netLiquidationPrice,
    totalCost,
    currentNetValue,
    currentProfit,
    roi: currentProfit === null ? null : currentProfit / totalCost,
    warnings
  };
}

function positiveDatabaseInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_DATABASE_INTEGER
    ? value
    : null;
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
