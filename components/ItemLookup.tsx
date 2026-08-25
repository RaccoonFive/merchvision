"use client";

import { AlertTriangle, RefreshCw, Search, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, type Theme } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { formatAge, formatCompact, formatGp, formatNullableGp, formatNumber, formatPercent, formatTimestamp } from "@/lib/format";
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

type ChartRange = "1D" | "7D" | "3M" | "1Y";

const CHART_RANGES: { label: ChartRange; timestep: string }[] = [
  { label: "1D", timestep: "5m" },
  { label: "7D", timestep: "1h" },
  { label: "3M", timestep: "6h" },
  { label: "1Y", timestep: "24h" }
];

export function ItemLookup({ initialItemId }: ItemLookupProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [query, setQuery] = useState("");
  const [quoteData, setQuoteData] = useState<ItemQuoteResponse | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [chartRange, setChartRange] = useState<ChartRange>("7D");
  const [chartLoading, setChartLoading] = useState(Boolean(initialItemId));
  const [itemsLoading, setItemsLoading] = useState(true);
  const [quoteLoading, setQuoteLoading] = useState(Boolean(initialItemId));
  const [favorited, setFavorited] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
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
      setQuoteLoading(false);
      return;
    }

    let alive = true;
    setQuoteLoading(true);
    setError(null);

    fetch(`/api/items/${initialItemId}/quote`)
      .then(async (response) => {
        const payload = (await response.json()) as ItemQuoteResponse & { error?: string };
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load item quote.");
        return payload;
      })
      .then((quote) => {
        if (!alive) return;
        setQuoteData(quote);
        setQuery(quote.item.name);
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

  useEffect(() => {
    if (!initialItemId) {
      setChartData([]);
      setChartLoading(false);
      return;
    }

    const timestep = CHART_RANGES.find((range) => range.label === chartRange)?.timestep ?? "1h";
    let alive = true;
    setChartLoading(true);

    fetch(`/api/items/${initialItemId}/timeseries?timestep=${timestep}`)
      .then(async (response) => {
        const payload = (await response.json()) as ApiResponse<PricePoint[]>;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load item chart.");
        if (alive) setChartData(payload.data ?? []);
      })
      .catch(() => {
        if (alive) setChartData([]);
      })
      .finally(() => {
        if (alive) setChartLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [chartRange, initialItemId]);

  useEffect(() => {
    if (!initialItemId) {
      setFavorited(false);
      return;
    }

    let alive = true;
    fetch(`/api/favorites/${initialItemId}`)
      .then(async (response) => {
        if (response.status === 401) return { favorited: false };
        const payload = (await response.json()) as { favorited?: boolean; error?: string };
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to check favorite.");
        return payload;
      })
      .then((payload) => {
        if (alive) setFavorited(Boolean(payload.favorited));
      })
      .catch(() => {
        if (alive) setFavorited(false);
      });

    return () => {
      alive = false;
    };
  }, [initialItemId]);

  function selectItem(item: ItemMeta) {
    setQuery(item.name);
    router.push(`/lookup/${item.id}`);
  }

  async function toggleFavorite() {
    if (!initialItemId) return;
    setFavoriteLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/favorites/${initialItemId}`, { method: favorited ? "DELETE" : "PUT" });
      if (response.status === 401) {
        router.push(`/account?callbackUrl=${encodeURIComponent(`/lookup/${initialItemId}`)}`);
        return;
      }

      const payload = (await response.json()) as { favorited?: boolean; error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to update favorite.");
      setFavorited(Boolean(payload.favorited));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update favorite.");
    } finally {
      setFavoriteLoading(false);
    }
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
            {itemsLoading ? <LoadingSpinner label="Loading item list..." size="small" variant="inline" /> : null}
            {!itemsLoading && query.trim() && suggestions.length === 0 ? <p className="muted">No matching items.</p> : null}
            {suggestions.length > 0 && query !== quoteData?.item.name ? (
              <div className="lookup-suggestions" role="listbox" aria-label="Matching items">
                {suggestions.map((item) => (
                  <button key={item.id} onClick={() => selectItem(item)} role="option" type="button">
                    <ItemIcon icon={item.icon} className="item-icon" />
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
            {quoteLoading ? <LoadingSpinner label="Loading item quote..." /> : null}
            {!initialItemId && !error ? <div className="empty">Search for an item to inspect its current margin.</div> : null}
            {!quoteLoading && quoteData ? (
              <QuoteDetails
                chartData={chartData}
                chartLoading={chartLoading}
                chartRange={chartRange}
                data={quoteData}
                favoriteLoading={favoriteLoading}
                favorited={favorited}
                onToggleFavorite={toggleFavorite}
                onChartRangeChange={setChartRange}
                theme={theme}
              />
            ) : null}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function QuoteDetails({
  data,
  chartData,
  chartLoading,
  chartRange,
  theme,
  favorited,
  favoriteLoading,
  onToggleFavorite,
  onChartRangeChange
}: {
  data: ItemQuoteResponse;
  chartData: PricePoint[];
  chartLoading: boolean;
  chartRange: ChartRange;
  theme: Theme;
  favorited: boolean;
  favoriteLoading: boolean;
  onToggleFavorite: () => void;
  onChartRangeChange: (range: ChartRange) => void;
}) {
  const { item, quote } = data;
  const warnings = buildItemQuoteWarnings(quote);
  const colors = chartColors(theme);
  const chartPoints = chartData.map((point) => toChartPoint(point, chartRange));
  const yDomain = chartYDomain(chartPoints);

  return (
    <>
      <div className="lookup-detail-head">
        <div className="detail-head">
          <ItemIcon icon={item.icon} className="detail-icon" />
          <div>
            <h2>{item.name}</h2>
            <p className="subtitle">{item.members ? "Members item" : "Free-to-play item"}</p>
          </div>
        </div>
        <div className="lookup-detail-actions">
          <div className="quote-status">
            <RefreshCw size={14} />
            {quote.freshnessSeconds === null ? "No recent quote" : `Freshest trade ${formatAge(quote.freshnessSeconds)} ago`}
          </div>
          <button
            aria-label={favorited ? `Remove ${item.name} from favorites` : `Add ${item.name} to favorites`}
            aria-pressed={favorited}
            className={`favorite-toggle${favorited ? " active" : ""}`}
            disabled={favoriteLoading}
            onClick={onToggleFavorite}
            title={favorited ? "Remove favorite" : "Add favorite"}
            type="button"
          >
            {favoriteLoading ? (
              <LoadingSpinner label="Updating..." size="small" variant="button" />
            ) : (
              <>
                <Star fill={favorited ? "currentColor" : "none"} size={17} />
                <span>{favorited ? "Favorited" : "Favorite"}</span>
              </>
            )}
          </button>
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
        <Metric label="Buy price (latest low)" value={formatNullableGp(quote.low)} detail={formatTimestamp(quote.lowTime)} className="lookup-metric" />
        <Metric label="Sell price (latest high)" value={formatNullableGp(quote.high)} detail={formatTimestamp(quote.highTime)} className="lookup-metric" />
        <Metric label="Gross margin" value={formatNullableGp(quote.margin)} tone={valueTone(quote.margin)} className="lookup-metric" />
        <Metric label="GE tax" value={formatNullableGp(quote.tax)} className="lookup-metric" />
        <Metric label="Net margin" value={formatNullableGp(quote.netProfit)} tone={valueTone(quote.netProfit)} className="lookup-metric" />
        <Metric label="ROI" value={quote.roi === null ? "Unavailable" : formatPercent(quote.roi)} tone={valueTone(quote.roi)} className="lookup-metric" />
        <Metric label="Buy limit" value={item.limit ? formatNumber(item.limit) : "Unknown"} className="lookup-metric" />
        <Metric label="Freshness" value={quote.freshnessSeconds === null ? "Unavailable" : formatAge(quote.freshnessSeconds)} className="lookup-metric" />
      </div>

      <div className="lookup-chart-panel">
        <div className="lookup-chart-head">
          <div>
            <h3>Price history</h3>
            <p className="muted">{chartRange} view using {chartIntervalLabel(chartRange)} samples</p>
          </div>
          <div className="chart-range-selector" aria-label="Chart timespan">
            {CHART_RANGES.map((range) => (
              <button
                aria-pressed={chartRange === range.label}
                className={chartRange === range.label ? "active" : ""}
                key={range.label}
                onClick={() => onChartRangeChange(range.label)}
                type="button"
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lookup-chart">
          {chartLoading ? (
            <LoadingSpinner label={`Loading ${chartRange} price history...`} />
          ) : chartData.length === 0 ? (
            <div className="empty">No recent chart data is available.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartPoints}>
                <CartesianGrid stroke={colors.grid} vertical={false} />
                <XAxis dataKey="time" stroke={colors.axis} tick={{ fontSize: 11 }} minTickGap={24} />
                <YAxis
                  domain={yDomain}
                  stroke={colors.axis}
                  tick={{ fontSize: 11 }}
                  width={72}
                  tickFormatter={formatCompact}
                />
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

function valueTone(value: number | null): "positive" | "negative" | "muted" {
  if (value === null || value === 0) return "muted";
  return value > 0 ? "positive" : "negative";
}

function chartColors(theme: Theme) {
  return theme === "dark"
    ? { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", high: "#72b99b", low: "#8fa7bb" }
    : { grid: "#e1ddd0", axis: "#756f5f", tooltip: "#fffdf8", high: "#287255", low: "#3e745a" };
}

function toChartPoint(point: PricePoint, range: ChartRange) {
  const date = new Date(point.timestamp * 1000);
  return {
    time:
      range === "1D"
        ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        : range === "7D"
          ? date.toLocaleDateString([], { weekday: "short", hour: "2-digit" })
          : date.toLocaleDateString([], { month: "short", day: "numeric" }),
    high: point.avgHighPrice,
    low: point.avgLowPrice
  };
}

function chartYDomain(points: ReturnType<typeof toChartPoint>[]): [number, number] {
  const prices = points.flatMap((point) =>
    [point.high, point.low].filter((price): price is number => Number.isFinite(price))
  );
  if (prices.length === 0) return [0, 1];

  // A padded observed range keeps small price movements legible without implying a zero-price baseline.
  const minimum = Math.min(...prices);
  const maximum = Math.max(...prices);
  const padding = Math.max((maximum - minimum) * 0.05, maximum * 0.002, 1);
  return [Math.max(0, Math.floor(minimum - padding)), Math.ceil(maximum + padding)];
}

function chartIntervalLabel(range: ChartRange): string {
  switch (range) {
    case "1D":
      return "5-minute";
    case "3M":
      return "6-hour";
    case "1Y":
      return "daily";
    case "7D":
    default:
      return "hourly";
  }
}
