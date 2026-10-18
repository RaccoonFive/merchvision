import { calculateGeTax } from "./tax";
import type { ItemMeta, LatestPrice, PricePoint } from "./types";

export const BANK_MAX_BYTES = 2 * 1024 * 1024;
export const BANK_MAX_ROWS = 2000;
export const BANK_TREND_BATCH_SIZE = 20;
export const BANK_PERIODS = [7, 30, 90] as const;
export type BankPeriod = typeof BANK_PERIODS[number];
export type BankHolding = { itemId: number; name: string; quantity: number };
export type BankSnapshot = { version: 1; importedAt: string; holdings: BankHolding[] };
export type BankDirection = "rising" | "falling" | "flat" | "mixed";
export type BankTrend = {
  status: "available" | "insufficient" | "stale";
  direction: BankDirection | null;
  change: number | null;
  unitGpChange: number | null;
  consistency: number | null;
  coverage: number;
  sampleCount: number;
  latestSampleTime: number | null;
};
export type BankItemTrends = {
  id: number;
  status: "available" | "failed" | "unsupported";
  periods: Record<BankPeriod, BankTrend> | null;
};
export type BankMarketItem = {
  id: number;
  item: ItemMeta | null;
  price: LatestPrice | null;
  matchedVolume: number | null;
};
export type BankMarketResponse = {
  data: BankMarketItem[];
  meta: { generatedAt: string; pricesAvailable: boolean; liquidityAvailable: boolean };
};
export type BankTrendsResponse = { data: BankItemTrends[]; meta: { generatedAt: string } };
export type BankRow = BankHolding & {
  item: ItemMeta | null;
  unitPrice: number | null;
  grossValue: number | null;
  netValue: number | null;
  quoteTime: number | null;
  stale: boolean;
  warnings: string[];
  matchedVolume: number | null;
};

const DAY = 86400;
const MAX_INTEGER = 2_147_483_647;
const whole = (value: number) => Number.isInteger(value) && value > 0 && value <= MAX_INTEGER;

export function parseBankImport(text: string, now = new Date()):
  { snapshot: BankSnapshot; ignored: number } | { error: string } {
  if (new TextEncoder().encode(text).length > BANK_MAX_BYTES) return { error: "Import exceeds the 2 MiB limit." };
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const headerIndex = lines.findIndex((line) => line.trim());
  const header = lines[headerIndex]?.trim().toLowerCase();
  if (header !== "item id\titem name\titem quantity") {
    return { error: "Expected the tab-separated header: Item id, Item name, Item quantity." };
  }
  const holdings = new Map<number, BankHolding>();
  let count = 0;
  let ignored = 0;
  for (let index = headerIndex + 1; index < lines.length; index++) {
    if (!lines[index].trim()) continue;
    if (++count > BANK_MAX_ROWS) return { error: `Import exceeds the ${BANK_MAX_ROWS.toLocaleString("en-US")} row limit.` };
    const columns = lines[index].split("\t");
    const [rawId, rawName, rawQuantity] = columns.map((column) => column.trim());
    const itemId = Number(rawId);
    const quantity = Number(rawQuantity);
    if (columns.length !== 3 || !/^\d+$/.test(rawId) || !whole(itemId) || !rawName || rawName.length > 200 ||
        !/^\d+$/.test(rawQuantity) || !Number.isInteger(quantity) || quantity < 0 || quantity > MAX_INTEGER) {
      return { error: `Line ${index + 1}: expected a positive item ID, an item name, and a non-negative whole quantity (maximum ${MAX_INTEGER}).` };
    }
    if (quantity === 0) { ignored++; continue; }
    const combined = (holdings.get(itemId)?.quantity ?? 0) + quantity;
    if (!whole(combined)) return { error: `Line ${index + 1}: combined quantity exceeds ${MAX_INTEGER}.` };
    holdings.set(itemId, { itemId, name: holdings.get(itemId)?.name ?? rawName, quantity: combined });
  }
  if (!holdings.size) return { error: "The export contains no items with a positive quantity." };
  return { snapshot: { version: 1, importedAt: now.toISOString(), holdings: [...holdings.values()] }, ignored };
}

export function isBankSnapshot(value: unknown): value is BankSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as BankSnapshot;
  if (snapshot.version !== 1 || typeof snapshot.importedAt !== "string" || !Number.isFinite(Date.parse(snapshot.importedAt)) ||
      !Array.isArray(snapshot.holdings) || !snapshot.holdings.length || snapshot.holdings.length > BANK_MAX_ROWS) return false;
  const ids = new Set<number>();
  return snapshot.holdings.every((row) => {
    if (!row || !whole(row.itemId) || !whole(row.quantity) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 200 || ids.has(row.itemId)) return false;
    ids.add(row.itemId);
    return true;
  });
}

export function parseBankIds(value: unknown, maximum: number): number[] | null {
  if (!value || typeof value !== "object" || !("itemIds" in value)) return null;
  const ids = value.itemIds;
  if (!Array.isArray(ids) || !ids.length || ids.length > maximum || !ids.every((id) => typeof id === "number" && whole(id)) || new Set(ids).size !== ids.length) return null;
  return ids;
}

export function valueBank(holdings: BankHolding[], market: BankMarketItem[], now = Date.now() / 1000): BankRow[] {
  const byId = new Map(market.map((row) => [row.id, row]));
  return holdings.map((holding) => {
    const observed = byId.get(holding.itemId);
    const coins = holding.itemId === 995;
    const low = observed?.price?.low;
    const unitPrice = coins ? 1 : typeof low === "number" && Number.isSafeInteger(low) && low > 0 && observed?.item ? low : null;
    const time = observed?.price?.lowTime;
    const quoteTime = coins || typeof time !== "number" || !Number.isFinite(time) || time <= 0 ? null : time;
    const stale = !coins && unitPrice !== null && (quoteTime === null || now - quoteTime > 3600);
    const gross = unitPrice === null ? null : unitPrice * holding.quantity;
    const net = unitPrice === null ? null : (unitPrice - (coins ? 0 : calculateGeTax(unitPrice))) * holding.quantity;
    const grossValue = gross !== null && Number.isSafeInteger(gross) ? gross : null;
    const netValue = net !== null && Number.isSafeInteger(net) ? net : null;
    const warnings: string[] = [];
    if (!coins && !observed?.item) warnings.push("No GE mapping");
    else if (unitPrice === null) warnings.push("Price unavailable");
    if (stale) warnings.push(quoteTime === null ? "Quote time unknown" : "Quote over one hour old");
    if (gross !== null && (grossValue === null || netValue === null)) warnings.push("Value exceeds safe arithmetic limit");
    if (observed?.matchedVolume !== null && observed?.matchedVolume !== undefined && observed.matchedVolume < 1000 && !coins) warnings.push("Thin 24h matched volume");
    return { ...holding, name: observed?.item?.name ?? holding.name, item: observed?.item ?? null, unitPrice, grossValue, netValue, quoteTime, stale, warnings, matchedVolume: observed?.matchedVolume ?? null };
  });
}

export function sumBankValues(rows: BankRow[], key: "grossValue" | "netValue"): number | null {
  let total = 0;
  for (const row of rows) {
    total += row[key] ?? 0;
    if (!Number.isSafeInteger(total)) return null;
  }
  return total;
}

export function bankGpMovement(trend: BankTrend | undefined, quantity: number): number | null {
  const value = trend?.unitGpChange === null || trend?.unitGpChange === undefined ? null : trend.unitGpChange * quantity;
  return value !== null && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER ? value : null;
}

export function analyzeBankHistory(points: PricePoint[], now = Math.floor(Date.now() / 1000)): Record<BankPeriod, BankTrend> {
  // One observation per UTC day prevents duplicates from inflating evidence coverage.
  const daily = new Map<number, { timestamp: number; price: number }>();
  for (const point of [...points].sort((a, b) => a.timestamp - b.timestamp)) {
    const { avgHighPrice: high, avgLowPrice: low, timestamp } = point;
    if (!Number.isFinite(timestamp) || timestamp > now || !Number.isFinite(high) || !Number.isFinite(low) || (high ?? 0) <= 0 || (low ?? 0) <= 0) continue;
    daily.set(Math.floor(timestamp / DAY), { timestamp, price: (high! + low!) / 2 });
  }
  const valid = [...daily.values()];
  const latestSampleTime = valid.at(-1)?.timestamp ?? null;
  return Object.fromEntries(BANK_PERIODS.map((days) => {
    const start = now - days * DAY;
    const samples = valid.filter((point) => point.timestamp >= start);
    const coverage = Math.min(samples.length / days, 1);
    const result: BankTrend = { status: "insufficient", direction: null, change: null, unitGpChange: null, consistency: null, coverage, sampleCount: samples.length, latestSampleTime };
    if (latestSampleTime !== null && now - latestSampleTime > 2 * DAY) {
      result.status = "stale";
      return [days, result];
    }
    const span = samples.length > 1 ? samples.at(-1)!.timestamp - samples[0].timestamp : 0;
    if (coverage < 0.7 || span < days * DAY * 0.8) return [days, result];
    const xs = samples.map((point) => (point.timestamp - start) / DAY);
    const ys = samples.map((point) => Math.log(point.price));
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
    const denominator = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
    const slope = xs.reduce((sum, x, index) => sum + (x - meanX) * (ys[index] - meanY), 0) / denominator;
    const change = Math.expm1(slope * days);
    const fittedStart = Math.exp(meanY - slope * meanX);
    const unitGpChange = fittedStart * change;
    if (!Number.isFinite(change) || !Number.isFinite(unitGpChange) || Math.abs(unitGpChange) > Number.MAX_SAFE_INTEGER) return [days, result];
    const agreeing = samples.slice(1).filter((point, index) => Math.sign(point.price - samples[index].price) === Math.sign(slope)).length;
    const consistency = agreeing / (samples.length - 1);
    return [days, { ...result, status: "available", change, unitGpChange, consistency,
      direction: Math.abs(change) <= 0.01 + 1e-12 ? "flat" : consistency < 0.6 ? "mixed" : change > 0 ? "rising" : "falling" } satisfies BankTrend];
  })) as Record<BankPeriod, BankTrend>;
}
