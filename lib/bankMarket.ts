import { analyzeBankHistory, type BankItemTrends, type BankMarketResponse } from "./bank";
import { get24hPrices, getItems, getLatestPrices, getTimeseries } from "./osrsWiki";

// Shared across batches and callers in this process, independently of browser scheduling.
let historyActive = 0;
const historyWaiters: Array<() => void> = [];

async function withHistorySlot<T>(load: () => Promise<T>): Promise<T> {
  if (historyActive >= 4) await new Promise<void>((resolve) => historyWaiters.push(resolve));
  else historyActive++;
  try { return await load(); }
  finally {
    const next = historyWaiters.shift();
    if (next) next();
    else historyActive--;
  }
}

export async function getBankMarket(ids: number[]): Promise<BankMarketResponse> {
  const [mapping, latest, volumes] = await Promise.allSettled([getItems(), getLatestPrices(), get24hPrices()]);
  if (mapping.status === "rejected") throw new Error("Item metadata unavailable");
  const items = new Map(mapping.value.map((item) => [item.id, item]));
  const prices = new Map((latest.status === "fulfilled" ? latest.value : []).map((price) => [price.id, price]));
  const summaries = new Map((volumes.status === "fulfilled" ? volumes.value : []).map((row) => [row.id, row]));
  return {
    data: ids.map((id) => {
      const summary = summaries.get(id);
      const hasVolume = summary && Number.isFinite(summary.lowPriceVolume) && Number.isFinite(summary.highPriceVolume) && summary.lowPriceVolume! >= 0 && summary.highPriceVolume! >= 0;
      return { id, item: items.get(id) ?? null, price: prices.get(id) ?? null,
        matchedVolume: hasVolume ? Math.min(summary.lowPriceVolume!, summary.highPriceVolume!) : null };
    }),
    meta: { generatedAt: new Date().toISOString(), pricesAvailable: latest.status === "fulfilled", liquidityAvailable: volumes.status === "fulfilled" }
  };
}

export async function getBankTrends(ids: number[], signal?: AbortSignal): Promise<BankItemTrends[]> {
  const items = new Set((await getItems()).map((item) => item.id));
  const now = Math.floor(Date.now() / 1000);
  return Promise.all(ids.map(async (id): Promise<BankItemTrends> => {
    if (id === 995 || !items.has(id)) return { id, status: "unsupported", periods: null };
    try {
      const history = await withHistorySlot(() => {
        // A disconnected caller must not start more upstream requests from the queue.
        signal?.throwIfAborted();
        return getTimeseries(id, "24h");
      });
      return { id, status: "available", periods: analyzeBankHistory(history, now) };
    } catch {
      return { id, status: "failed", periods: null };
    }
  }));
}
