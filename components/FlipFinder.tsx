"use client";

import { RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import type { FlipCandidate, PricePoint } from "@/lib/types";
import { AppShell, type Theme } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { formatAge, formatClock, formatCompact, formatGp, formatNumber, formatPercent } from "@/lib/format";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";

type FlipsResponse = {
  data?: FlipCandidate[];
  error?: string;
  meta?: {
    generatedAt: string;
  };
};

type TimeseriesResponse = {
  data?: PricePoint[];
  error?: string;
};

type Filters = {
  search: string;
  minProfit: string;
  minRoi: string;
  minVolume: string;
  minConfidence: string;
  minStability: string;
  minTotalBuyLimitProfit: string;
  maxPrice: string;
  members: string;
  sort: string;
  includeStale: boolean;
  includeLowConfidence: boolean;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  minProfit: "",
  minRoi: "0.5",
  minVolume: "",
  minConfidence: "",
  minStability: "",
  minTotalBuyLimitProfit: "",
  maxPrice: "",
  members: "all",
  sort: "score",
  includeStale: true,
  includeLowConfidence: true
};

type FlipSortKey =
  | "name"
  | "buyPrice"
  | "sellPrice"
  | "margin"
  | "tax"
  | "netProfit"
  | "roi"
  | "score"
  | "confidence"
  | "stability"
  | "totalBuyLimitProfit"
  | "volume"
  | "freshnessSeconds"
  | "buyLimit";

export function FlipFinder() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [flips, setFlips] = useState<FlipCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<{ key: FlipSortKey; direction: SortDirection }>({
    key: "score",
    direction: "desc"
  });

  const selected = flips.find((flip) => flip.id === selectedId);
  const sortedFlips = useMemo(
    () => sortTableRows(flips, (flip) => flipSortValue(flip, tableSort.key), tableSort.direction),
    [flips, tableSort]
  );
  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (typeof value === "boolean") {
        if (!value) params.set(key, "false");
      } else if (value) {
        params.set(key, value);
      }
    });
    return params.toString();
  }, [filters]);

  const loadFlips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flips?${query}`);
      const payload = (await response.json()) as FlipsResponse;
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load flips.");
      const nextFlips = payload.data ?? [];
      setFlips(nextFlips);
      setGeneratedAt(payload.meta?.generatedAt ?? null);
      setSelectedId((current) => (current && nextFlips.some((flip) => flip.id === current) ? current : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load flips.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadFlips();
  }, [loadFlips]);

  useEffect(() => {
    if (!detailPanelOpen || !selected?.id) {
      setChartData([]);
      return;
    }

    let alive = true;
    setChartLoading(true);
    fetch(`/api/items/${selected.id}/timeseries?timestep=1h`)
      .then(async (response) => {
        const payload = (await response.json()) as TimeseriesResponse;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load chart.");
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
  }, [detailPanelOpen, selected?.id]);

  function updateFilter(key: keyof Filters, value: string | boolean) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleTableSort(key: FlipSortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
    const sort = flipFilterSort(key);
    if (sort) updateFilter("sort", sort);
  }

  return (
    <AppShell
      activePath="/"
      title="Flip Finder"
      subtitle="Live OSRS Grand Exchange flip finder"
      headerActions={
        <div className="status-pill">
          <RefreshCw size={15} />
          {generatedAt ? `Updated ${formatClock(generatedAt)}` : "Waiting for prices"}
          <button className="refresh-btn" disabled={loading} onClick={loadFlips} type="button" aria-label="Refresh flips">
            {loading ? <LoadingSpinner label="Refreshing..." size="small" variant="button" /> : <><RefreshCw size={16} /> Refresh</>}
          </button>
        </div>
      }
    >
      {(theme) => (
        <>
          <div className={`main-grid${detailPanelOpen ? "" : " detail-panel-closed"}`}>
          <section className="table-wrap" aria-label="Ranked flips">
          {error ? <div className="error">{error}</div> : null}
          {loading ? <LoadingSpinner label="Loading live margins..." /> : null}
          {!loading && !error && flips.length === 0 ? <div className="empty">No flips match these filters.</div> : null}
          {!loading && !error && flips.length > 0 ? (
            <StickyTable>
              <table>
                <thead>
                  <tr>
                    <SortableTableHeader label="Item" active={tableSort.key === "name"} direction={tableSort.direction} onSort={() => toggleTableSort("name")} filter={{
                      active: Boolean(filters.search) || filters.members !== "all",
                      fields: [
                        { id: "search", label: "Search items", placeholder: "Nature rune, bowstring...", value: filters.search },
                        { clearValue: "all", id: "members", label: "Market", options: [{ label: "All items", value: "all" }, { label: "F2P only", value: "f2p" }, { label: "Members", value: "members" }], type: "select", value: filters.members }
                      ],
                      onApply: (values) => {
                        updateFilter("search", String(values.search));
                        updateFilter("members", String(values.members));
                      }
                    }} />
                    <SortableTableHeader label="Buy" active={tableSort.key === "buyPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("buyPrice")} filter={{
                      active: Boolean(filters.maxPrice),
                      fields: [{ id: "maxPrice", label: "Maximum buy price", type: "number", value: filters.maxPrice }],
                      onApply: (values) => updateFilter("maxPrice", String(values.maxPrice))
                    }} />
                    <SortableTableHeader label="Sell" active={tableSort.key === "sellPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("sellPrice")} />
                    <SortableTableHeader label="Margin" active={tableSort.key === "margin"} direction={tableSort.direction} onSort={() => toggleTableSort("margin")} />
                    <SortableTableHeader label="Tax" active={tableSort.key === "tax"} direction={tableSort.direction} onSort={() => toggleTableSort("tax")} />
                    <SortableTableHeader label="Net" active={tableSort.key === "netProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("netProfit")} filter={{
                      active: Boolean(filters.minProfit),
                      fields: [{ id: "minProfit", label: "Minimum net profit", type: "number", value: filters.minProfit }],
                      onApply: (values) => updateFilter("minProfit", String(values.minProfit))
                    }} />
                    <SortableTableHeader label="ROI" active={tableSort.key === "roi"} direction={tableSort.direction} onSort={() => toggleTableSort("roi")} filter={{
                      active: Boolean(filters.minRoi),
                      fields: [{ id: "minRoi", label: "Minimum ROI %", type: "number", value: filters.minRoi }],
                      onApply: (values) => updateFilter("minRoi", String(values.minRoi))
                    }} />
                    <SortableTableHeader label="Score" active={tableSort.key === "score"} direction={tableSort.direction} onSort={() => toggleTableSort("score")} filter={{
                      active: Boolean(filters.minStability),
                      fields: [{ id: "minStability", label: "Minimum historical stability %", type: "number", value: filters.minStability }],
                      onApply: (values) => updateFilter("minStability", String(values.minStability))
                    }} />
                    <SortableTableHeader label="Conf." active={tableSort.key === "confidence"} direction={tableSort.direction} onSort={() => toggleTableSort("confidence")} filter={{
                      active: Boolean(filters.minConfidence) || !filters.includeLowConfidence,
                      fields: [
                        { id: "minConfidence", label: "Minimum confidence %", type: "number", value: filters.minConfidence },
                        { clearValue: true, id: "includeLowConfidence", label: "Include results below 45% confidence", type: "checkbox", value: filters.includeLowConfidence }
                      ],
                      onApply: (values) => {
                        updateFilter("minConfidence", String(values.minConfidence));
                        updateFilter("includeLowConfidence", values.includeLowConfidence === true);
                      }
                    }} />
                    <SortableTableHeader label="Volume" active={tableSort.key === "volume"} direction={tableSort.direction} onSort={() => toggleTableSort("volume")} filter={{
                      active: Boolean(filters.minVolume),
                      fields: [{ id: "minVolume", label: "Minimum trailing volume", type: "number", value: filters.minVolume }],
                      onApply: (values) => updateFilter("minVolume", String(values.minVolume))
                    }} />
                    <SortableTableHeader label="Fresh" active={tableSort.key === "freshnessSeconds"} direction={tableSort.direction} onSort={() => toggleTableSort("freshnessSeconds")} filter={{
                      active: !filters.includeStale,
                      fields: [{ clearValue: true, id: "includeStale", label: "Include quotes older than 1 hour", type: "checkbox", value: filters.includeStale }],
                      onApply: (values) => updateFilter("includeStale", values.includeStale === true)
                    }} />
                    <SortableTableHeader label="Limit" active={tableSort.key === "buyLimit"} direction={tableSort.direction} onSort={() => toggleTableSort("buyLimit")} filter={{
                      active: Boolean(filters.minTotalBuyLimitProfit),
                      fields: [{ id: "minTotalBuyLimitProfit", label: "Minimum buy-limit profit", type: "number", value: filters.minTotalBuyLimitProfit }],
                      onApply: (values) => updateFilter("minTotalBuyLimitProfit", String(values.minTotalBuyLimitProfit))
                    }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedFlips.map((flip) => (
                    <tr
                      aria-label={`Select ${flip.name}`}
                      className={detailPanelOpen && selected?.id === flip.id ? "selected" : ""}
                      key={flip.id}
                      onClick={() => {
                        setSelectedId(flip.id);
                        setDetailPanelOpen(true);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          setSelectedId(flip.id);
                          setDetailPanelOpen(true);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>
                        <div className="item-cell">
                          <ItemIcon icon={flip.icon} className="item-icon" />
                          <div>
                            <div className="item-name">{flip.name}</div>
                            <div className="item-meta">{flip.members ? "Members" : "F2P"}</div>
                          </div>
                        </div>
                      </td>
                      <td>{formatGp(flip.buyPrice)}</td>
                      <td>{formatGp(flip.sellPrice)}</td>
                      <td>{formatGp(flip.margin)}</td>
                      <td>{formatGp(flip.tax)}</td>
                      <td className="profit">{formatGp(flip.netProfit)}</td>
                      <td>{formatPercent(flip.roi)}</td>
                      <td className="score">{flip.score}</td>
                      <td>{formatPercent(flip.confidence)}</td>
                      <td>{formatNumber(flip.volume)}</td>
                      <td>{formatAge(flip.freshnessSeconds)}</td>
                      <td>{flip.buyLimit ? formatNumber(flip.buyLimit) : "?"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </StickyTable>
          ) : null}
          </section>

        {detailPanelOpen ? <aside className="detail-panel" aria-label="Selected item details">
          {selected ? (
            <>
              <div className="detail-panel-head">
                <div className="detail-head">
                  <ItemIcon icon={selected.icon} className="detail-icon" />
                  <div>
                    <h2>
                      <Link className="detail-title-link" href={`/lookup/${selected.id}`}>
                        {selected.name}
                      </Link>
                    </h2>
                    <p className="subtitle">{selected.members ? "Members item" : "Free-to-play item"}</p>
                  </div>
                </div>
                <button
                  aria-label="Close item details"
                  className="detail-panel-close"
                  onClick={() => setDetailPanelOpen(false)}
                  title="Close item details"
                  type="button"
                >
                  <X size={17} />
                </button>
              </div>
              <div className="score-summary">
                <span>Score</span>
                <strong>{selected.score}</strong>
              </div>
              <div className="metric-grid compact">
                <Metric label="Current net profit" value={formatGp(selected.netProfit)} tone="profit" />
                <Metric label="Current ROI" value={formatPercent(selected.roi)} />
                <Metric label="Buy limit" value={selected.buyLimit ? formatNumber(selected.buyLimit) : "Unknown"} />
                <Metric label="Buy-limit profit (estimate)" value={formatGp(selected.totalBuyLimitProfit)} tone="profit" />
                <Metric label="Historical confidence" value={formatPercent(selected.confidence)} />
                <Metric label="Historical matched vol/hr" value={formatNumber(selected.marketAnalysis?.medianMatchedHourlyVolume ?? 0)} />
                <Metric label="Estimated units/hr" value={formatNumber(selected.marketAnalysis?.estimatedExecutableUnitsPerHour ?? 0)} />
                <Metric label="Current quote age" value={formatAge(selected.freshnessSeconds)} />
                <Metric label="Historical stability" value={formatPercent(selected.stability)} />
              </div>
              <p className="research-note">
                Trailing traded volume combines recent high- and low-side trades. Matched volume is the lower side per hour;
                estimated units assume 1% of that median and are capped by a known four-hour buy limit.
              </p>
              <div>
                <h3>Recent prices</h3>
                <div className="chart">
                  {chartLoading ? (
                    <LoadingSpinner label="Loading chart..." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.map(toChartPoint)}>
                        <CartesianGrid stroke={chartColors(theme).grid} vertical={false} />
                        <XAxis dataKey="time" stroke={chartColors(theme).axis} tick={{ fontSize: 11 }} />
                        <YAxis stroke={chartColors(theme).axis} tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompact} />
                        <Tooltip
                          contentStyle={{ background: chartColors(theme).tooltip, border: 0, borderRadius: 8, color: chartColors(theme).axis }}
                          formatter={(value) => formatGp(Number(value))}
                        />
                        <Area dataKey="high" stroke={chartColors(theme).high} fill={`${chartColors(theme).high}26`} name="High" />
                        <Area dataKey="low" stroke={chartColors(theme).low} fill={`${chartColors(theme).low}26`} name="Low" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <section className="score-breakdown" aria-label="How this score is calculated">
                <div className="score-breakdown-head">
                  <h3>How this score is calculated</h3>
                </div>
                <p className="muted">Current observations, historical measures, and execution estimates are scored separately.</p>
                <ul>
                  {selected.scoreBreakdown.components.map((component) => (
                    <li className={component.kind} key={component.label}>
                      <span>{component.label}</span>
                      <strong>{formatScorePoints(component.points, true)}</strong>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          ) : (
            <div className="empty">Select a flip to inspect the math.</div>
          )}
          </aside> : null}
          </div>
        </>
      )}
    </AppShell>
  );
}

function chartColors(theme: Theme) {
  return theme === "dark"
    ? { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", high: "#72b99b", low: "#8fa7bb" }
    : { grid: "#e1ddd0", axis: "#756f5f", tooltip: "#fffdf8", high: "#287255", low: "#3e745a" };
}

function toChartPoint(point: PricePoint) {
  return {
    time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    high: point.avgHighPrice,
    low: point.avgLowPrice
  };
}

function formatScorePoints(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} pts`;
}

function flipFilterSort(key: FlipSortKey): Filters["sort"] | undefined {
  switch (key) {
    case "score":
    case "confidence":
    case "stability":
    case "totalBuyLimitProfit":
    case "roi":
    case "volume":
      return key;
    case "netProfit":
      return "profit";
    case "freshnessSeconds":
      return "freshness";
    default:
      return undefined;
  }
}

function flipSortValue(flip: FlipCandidate, key: FlipSortKey): number | string | undefined {
  switch (key) {
    case "name": return flip.name;
    case "buyPrice": return flip.buyPrice;
    case "sellPrice": return flip.sellPrice;
    case "margin": return flip.margin;
    case "tax": return flip.tax;
    case "netProfit": return flip.netProfit;
    case "roi": return flip.roi;
    case "score": return flip.score;
    case "confidence": return flip.confidence;
    case "stability": return flip.stability;
    case "totalBuyLimitProfit": return flip.totalBuyLimitProfit;
    case "volume": return flip.volume;
    case "freshnessSeconds": return flip.freshnessSeconds;
    case "buyLimit": return flip.buyLimit;
  }
}
