"use client";

import { useEffect, useRef, useState } from "react";
import { BANK_TREND_BATCH_SIZE, valueBank, type BankItemTrends, type BankMarketResponse, type BankSnapshot, type BankTrendsResponse } from "./bank";
import { sortTableRows } from "./tableSort";

async function post<T>(path: string, ids: number[], signal: AbortSignal): Promise<T> {
  const response = await fetch(path, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemIds: ids }), signal, cache: "no-store"
  });
  if (!response.ok) throw new Error("Market request failed");
  return response.json() as Promise<T>;
}

export function useBankAnalysis(snapshot: BankSnapshot | null) {
  const source = useRef(snapshot);
  source.current = snapshot;
  const [marketState, setMarket] = useState<{ source: BankSnapshot; response: BankMarketResponse } | null>(null);
  const [trendState, setTrends] = useState<{ source: BankSnapshot; data: Record<number, BankItemTrends> } | null>(null);
  const results = useRef<{ source: BankSnapshot | null; data: Record<number, BankItemTrends> }>({ source: null, data: {} });
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [retry, setRetry] = useState(0);
  const worker = useRef<AbortController | null>(null);
  const market = marketState?.source === snapshot ? marketState.response : null;
  const trends = trendState?.source === snapshot ? trendState.data : {};

  useEffect(() => {
    const controller = new AbortController();
    worker.current?.abort();
    setMarketError(null);
    setPaused(false);
    if (!snapshot) { setMarketLoading(false); return () => controller.abort(); }
    const bank = snapshot;
    setMarketLoading(true);
    async function load() {
      try {
        const response = await post<BankMarketResponse>("/api/bank/market", bank.holdings.map((row) => row.itemId), controller.signal);
        if (controller.signal.aborted || source.current !== bank) return;
        results.current = { source: bank, data: {} };
        setTrends({ source: bank, data: {} });
        setMarket({ source: bank, response });
      } catch {
        if (!controller.signal.aborted && source.current === bank) setMarketError("Unable to refresh bank market data. Previous available values are retained. Please try again.");
      } finally {
        if (!controller.signal.aborted && source.current === bank) setMarketLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [snapshot, refresh]);

  useEffect(() => {
    if (!snapshot || !market || paused || marketLoading) return;
    const bank = snapshot;
    const controller = new AbortController();
    worker.current = controller;
    if (results.current.source !== bank) results.current = { source: bank, data: {} };
    const pending = sortTableRows(valueBank(bank.holdings, market.data), (row) => row.grossValue, "desc")
      .filter((row) => row.itemId !== 995 && row.item && !results.current.data[row.itemId])
      .map((row) => row.itemId);
    async function analyze() {
      for (let index = 0; index < pending.length; index += BANK_TREND_BATCH_SIZE) {
        if (controller.signal.aborted) return;
        const batch = pending.slice(index, index + BANK_TREND_BATCH_SIZE);
        let data: BankItemTrends[];
        try {
          const response = await post<BankTrendsResponse>("/api/bank/trends", batch, controller.signal);
          data = response.data;
        } catch {
          if (controller.signal.aborted) return;
          data = [];
        }
        // Fetch may resolve before abort; response-body completion needs its own guard.
        if (controller.signal.aborted || source.current !== bank) return;
        const returned = new Map(data.map((row) => [row.id, row]));
        const updated = { ...results.current.data };
        for (const id of batch) updated[id] = returned.get(id) ?? { id, status: "failed", periods: null };
        results.current = { source: bank, data: updated };
        setTrends({ source: bank, data: updated });
      }
    }
    void analyze();
    return () => controller.abort();
  }, [snapshot, market, paused, marketLoading, retry]);

  function retryFailed() {
    worker.current?.abort();
    if (results.current.source !== snapshot) return;
    const data = Object.fromEntries(Object.entries(results.current.data).filter(([, item]) => item.status !== "failed"));
    results.current = { source: snapshot, data };
    if (snapshot) setTrends({ source: snapshot, data });
    setPaused(false);
    setRetry((value) => value + 1);
  }

  return { market, trends, marketLoading, marketError, paused,
    refresh: () => { worker.current?.abort(); setRefresh((value) => value + 1); },
    stop: () => { worker.current?.abort(); setPaused(true); },
    resume: () => setPaused(false), retryFailed };
}
