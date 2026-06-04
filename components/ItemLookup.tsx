"use client";

import { AlertTriangle, RefreshCw, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, type Theme } from "@/components/AppShell";
import { searchItems } from "@/lib/itemSearch";
import { buildItemQuoteWarnings } from "@/lib/quote";
import type { ItemMeta, ItemQuoteResponse, PricePoint } from "@/lib/types";

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

type ItemLookupProps = {
  initialItemId?: number;
};

export function ItemLookup({ initialItemId }: ItemLookupProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [query, setQuery] = useState("");
  const [quoteData, setQuoteData] = useState<ItemQuoteResponse | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(Boolean(initialItemId));
  const [error, setError] = useState<string | null>(null);
  const suggestions = useMemo(() => searchItems(items, query), [items, query]);

  useEffect(() => {
    fetch("/api/items")
      .then(async (response) => {
        const payload = (await response.json()) as ApiResponse<ItemMeta[]>;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load items.");
        setItems(payload.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load items."))
      .finally(() => setItemsLoading(false));
  }, []);

  useEffect(() => {
    if (!initialItemId) {
      setQuoteData(null);
      setChartData([]);
      setQuoteLoading(false);
      return;
    }

    let alive = true;
    setQuoteLoading(true);
    setError(null);

    Promise.allSettled([
      fetch(`/api/items/${initialItemId}/quote`).then(async (response) => {
        const payload = (await response.json()) as ItemQuoteResponse & { error?: string };
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load item quote.");
        return payload;
      }),
      fetch(`/api/items/${initialItemId}/timeseries?timestep=1h`).then(async (response) => {
        const payload = (await response.json()) as ApiResponse<PricePoint[]>;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load item chart.");
        return payload.data ?? [];
      })
    ])
      .then(([quoteResult, chartResult]) => {
        if (!alive) return;
        if (quoteResult.status === "rejected") throw quoteResult.reason;
        setQuoteData(quoteResult.value);
        setChartData(chartResult.status === "fulfilled" ? chartResult.value : []);
        setQuery(quoteResult.value.item.name);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : "Unable to load item.");
      })
      .finally(() => {
        if (alive) setQuoteLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [initialItemId]);

  function selectItem(item: ItemMeta) {
    setQuery(item.name);
    router.push(`/lookup/${item.id}`);
  }

  return (
    <AppShell activePath="/lookup" title="Item Lookup" subtitle="Inspect the latest margin for any tradeable GE item">
      {(theme) => (
        <div className="lookup-layout">
          <section className="lookup-search-panel" aria-label="Item search">
            <div className="field lookup-search-field">
              <label htmlFor="item-search">
                <Search size={13} /> Search every item
              </label>
              <input
                autoComplete="off"
                id="item-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Mystic boots (dark)..."
                value={query}
              />
            </div>
            {itemsLoading ? <p className="muted">Loading item list...</p> : null}
            {!itemsLoading && query.trim() && suggestions.length === 0 ? <p className="muted">No matching items.</p> : null}
            {suggestions.length > 0 && query !== quoteData?.item.name ? (
              <div className="lookup-suggestions" role="listbox" aria-label="Matching items">
                {suggestions.map((item) => (
                  <button key={item.id} onClick={() => selectItem(item)} role="option" type="button">
                    <ItemIcon item={item} className="item-icon" />
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.members ? "Members" : "Free-to-play"}</small>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="lookup-result" aria-label="Item quote">
            {error ? <div className="error">{error}</div> : null}
            {quoteLoading ? <div className="empty">Loading item quote...</div> : null}
            {!initialItemId && !error ? <div className="empty">Search for an item to inspect its current margin.</div> : null}
            {!quoteLoading && quoteData ? <QuoteDetails data={quoteData} chartData={chartData} theme={theme} /> : null}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function QuoteDetails({ data, chartData, theme }: { data: ItemQuoteResponse; chartData: PricePoint[]; theme: Theme }) {
  const { item, quote } = data;
  const warnings = buildItemQuoteWarnings(quote);
  const colors = chartColors(theme);

  return (
    <>
      <div className="lookup-detail-head">
        <div className="detail-head">
          <ItemIcon item={item} className="detail-icon" />
          <div>
            <h2>{item.name}</h2>
            <p className="subtitle">{item.members ? "Members item" : "Free-to-play item"}</p>
          </div>
        </div>
        <div className="quote-status">
          <RefreshCw size={14} />
          {quote.freshnessSeconds === null ? "No recent quote" : `Freshest trade ${formatAge(quote.freshnessSeconds)} ago`}
        </div>
      </div>

      {warnings.length > 0 ? (
        <div className="warning-list">
          {warnings.map((warning) => (
            <div key={warning} className="warning-banner"><AlertTriangle size={15} /> {warning}</div>
          ))}
        </div>
      ) : null}

      <div className="lookup-metric-grid">
        <Metric label="Buy price (latest low)" value={formatNullableGp(quote.low)} detail={formatTimestamp(quote.lowTime)} />
        <Metric label="Sell price (latest high)" value={formatNullableGp(quote.high)} detail={formatTimestamp(quote.highTime)} />
        <Metric label="Gross margin" value={formatNullableGp(quote.margin)} tone={valueTone(quote.margin)} />
        <Metric label="GE tax" value={formatNullableGp(quote.tax)} />
        <Metric label="Net margin" value={formatNullableGp(quote.netProfit)} tone={valueTone(quote.netProfit)} />
        <Metric label="ROI" value={quote.roi === null ? "Unavailable" : formatPercent(quote.roi)} tone={valueTone(quote.roi)} />
        <Metric label="Buy limit" value={item.limit ? formatNumber(item.limit) : "Unknown"} />
        <Metric label="Freshness" value={quote.freshnessSeconds === null ? "Unavailable" : formatAge(quote.freshnessSeconds)} />
      </div>

      <div className="lookup-chart-panel">
        <h3>Recent prices</h3>
        <div className="lookup-chart">
          {chartData.length === 0 ? (
            <div className="empty">No recent chart data is available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.map(toChartPoint)}>
                <CartesianGrid stroke={colors.grid} vertical={false} />
                <XAxis dataKey="time" stroke={colors.axis} tick={{ fontSize: 11 }} />
                <YAxis stroke={colors.axis} tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompact} />
                <Tooltip
                  contentStyle={{ background: colors.tooltip, border: 0, borderRadius: 8, color: colors.axis }}
                  formatter={(value) => formatGp(Number(value))}
                />
                <Area dataKey="high" stroke={colors.high} fill={`${colors.high}26`} name="High" />
                <Area dataKey="low" stroke={colors.low} fill={`${colors.low}26`} name="Low" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "positive" | "negative" | "muted" }) {
  return (
    <div className="metric lookup-metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
      {detail ? <small>{detail}</small> : null}
    </div>
  );
}

function ItemIcon({ item, className }: { item: ItemMeta; className: string }) {
  return item.icon ? <img alt="" className={className} src={item.icon} /> : <div className={className} aria-hidden="true" />;
}

function valueTone(value: number | null): "positive" | "negative" | "muted" {
  if (value === null || value === 0) return "muted";
  return value > 0 ? "positive" : "negative";
}

function chartColors(theme: Theme) {
  return theme === "dark"
    ? { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", high: "#72b99b", low: "#8fa7bb" }
    : { grid: "#e9edf1", axis: "#7d9ab3", tooltip: "#ffffff", high: "#398066", low: "#587b9b" };
}

function toChartPoint(point: PricePoint) {
  return {
    time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    high: point.avgHighPrice,
    low: point.avgLowPrice
  };
}

function formatNullableGp(value: number | null): string {
  return value === null ? "Unavailable" : formatGp(value);
}

function formatGp(value: number): string {
  return `${formatNumber(value)} gp`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function formatTimestamp(timestamp: number | null): string {
  return timestamp === null ? "No trade timestamp" : new Date(timestamp * 1000).toLocaleString();
}
