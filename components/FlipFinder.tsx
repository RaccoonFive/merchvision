"use client";

import { AlertTriangle, ExternalLink, RefreshCw, X } from "lucide-react";
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
import { ItemLookupDialog } from "@/components/ItemLookupDialog";
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
  | "historicalNetMarginMedian"
  | "conservativeExpectedGpPerHour"
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
  const [lookupItemId, setLookupItemId] = useState<number | null>(null);
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
                    <SortableTableHeader label="7d median net" active={tableSort.key === "historicalNetMarginMedian"} direction={tableSort.direction} onSort={() => toggleTableSort("historicalNetMarginMedian")} />
                    <SortableTableHeader label="Est. GP/hr" active={tableSort.key === "conservativeExpectedGpPerHour"} direction={tableSort.direction} onSort={() => toggleTableSort("conservativeExpectedGpPerHour")} />
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
                    <SortableTableHeader label="Current limit profit (est.)" active={tableSort.key === "totalBuyLimitProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("totalBuyLimitProfit")} filter={{
                      active: Boolean(filters.minTotalBuyLimitProfit),
                      fields: [{ id: "minTotalBuyLimitProfit", label: "Minimum buy-limit profit", type: "number", value: filters.minTotalBuyLimitProfit }],
                      onApply: (values) => updateFilter("minTotalBuyLimitProfit", String(values.minTotalBuyLimitProfit))
                    }} />
                    <SortableTableHeader label="Limit" active={tableSort.key === "buyLimit"} direction={tableSort.direction} onSort={() => toggleTableSort("buyLimit")} />
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
                            <div className="item-meta">
                              {flip.members ? "Members" : "F2P"}
                              {flip.warnings.length > 0 ? ` · ${flip.warnings.length} warning${flip.warnings.length === 1 ? "" : "s"}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>{formatGp(flip.buyPrice)}</td>
                      <td>{formatGp(flip.sellPrice)}</td>
                      <td>{formatGp(flip.margin)}</td>
                      <td>{formatGp(flip.tax)}</td>
                      <td className="profit">{formatGp(flip.netProfit)}</td>
                      <td>{flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatGp(flip.marketAnalysis.historicalNetMarginMedian) : "Unavailable"}</td>
                      <td>{flip.conservativeExpectedGpPerHour === null ? "Unavailable" : formatGp(flip.conservativeExpectedGpPerHour)}</td>
                      <td>{formatPercent(flip.roi)}</td>
                      <td className="score">{flip.score}</td>
                      <td>{flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatPercent(flip.confidence) : "Unavailable"}</td>
                      <td>{formatNumber(flip.volume)}</td>
                      <td>{formatAge(flip.freshnessSeconds)}</td>
                      <td className="profit">{flip.buyLimit ? formatGp(flip.totalBuyLimitProfit) : "Unavailable"}</td>
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
                    <div className="detail-title-actions">
                      <h2>
                        <button className="detail-title-link" onClick={() => setLookupItemId(selected.id)} type="button">
                          {selected.name}
                        </button>
                      </h2>
                      <Link aria-label={`Open ${selected.name} in a new tab`} className="detail-title-new-tab" href={`/lookup/${selected.id}`} rel="noreferrer" target="_blank" title="Open in a new tab">
                        <ExternalLink aria-hidden="true" size={14} />
                      </Link>
                    </div>
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
                <span>Repeatability score</span>
                <strong>{selected.score}/100</strong>
              </div>
              {selected.warnings.length > 0 ? (
                <div className="warning-list" aria-label="Market warnings">
                  {selected.warnings.map((warning) => (
                    <div className="warning-banner" key={warning}>
                      <AlertTriangle aria-hidden="true" size={16} />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="metric-grid compact">
                <Metric label="Current net profit" value={formatGp(selected.netProfit)} tone="profit" />
                <Metric label="Current ROI" value={formatPercent(selected.roi)} />
                <Metric label="7d median net margin" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatGp(selected.marketAnalysis.historicalNetMarginMedian) : "Unavailable"} />
                <Metric label="Repeatable net profit" value={selected.repeatableNetProfit === null ? "Unavailable" : formatGp(selected.repeatableNetProfit)} tone="profit" />
                <Metric label="Conservative GP/hr (estimate)" value={selected.conservativeExpectedGpPerHour === null ? "Unavailable" : formatGp(selected.conservativeExpectedGpPerHour)} tone="profit" />
                <Metric label="Positive after-tax hours" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatPercent(selected.marketAnalysis.positiveSpreadRatio) : "Unavailable"} />
                <Metric label="Buy limit" value={selected.buyLimit ? formatNumber(selected.buyLimit) : "Unknown"} />
                <Metric label="Current buy-limit profit (estimate)" value={formatGp(selected.totalBuyLimitProfit)} tone="profit" />
                <Metric label="Historical confidence" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatPercent(selected.confidence) : "Unavailable"} />
                <Metric label="Historical matched vol/hr" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatNumber(selected.marketAnalysis.medianMatchedHourlyVolume) : "Unavailable"} />
                <Metric label="Estimated units/hr" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatNumber(selected.marketAnalysis.estimatedExecutableUnitsPerHour) : "Unavailable"} />
                <Metric label="Current quote age" value={formatAge(selected.freshnessSeconds)} />
                <Metric label="Historical stability" value={selected.marketAnalysis && selected.marketAnalysis.sampleCount > 0 ? formatPercent(selected.stability) : "Unavailable"} />
              </div>
              <p className="research-note">
                The seven-day median resists isolated margin spikes. Repeatable profit uses the lower of the current net
                margin and that median. Estimated GP/hour then assumes 1% of median matched hourly volume and is capped
                by a known four-hour buy limit. The displayed buy-limit total uses the current margin; scoring uses the
                repeatable margin instead. These are conservative estimates, not guaranteed fills or profit.
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
                <p className="muted">The 0–100 score balances conservative profit potential with seven-day liquidity and market quality, then subtracts freshness, spike, and missing-limit penalties.</p>
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
          {lookupItemId ? (
            <ItemLookupDialog
              itemId={lookupItemId}
              itemName={flips.find((flip) => flip.id === lookupItemId)?.name ?? "item"}
              onClose={() => setLookupItemId(null)}
              theme={theme}
            />
          ) : null}
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
    case "historicalNetMarginMedian":
      return "typicalProfit";
    case "conservativeExpectedGpPerHour":
      return "expectedGpPerHour";
    case "netProfit":
      return "profit";
    case "freshnessSeconds":
      return "freshness";
    default:
      return undefined;
  }
}

function flipSortValue(flip: FlipCandidate, key: FlipSortKey): number | string | null | undefined {
  switch (key) {
    case "name": return flip.name;
    case "buyPrice": return flip.buyPrice;
    case "sellPrice": return flip.sellPrice;
    case "margin": return flip.margin;
    case "tax": return flip.tax;
    case "netProfit": return flip.netProfit;
    case "historicalNetMarginMedian": return flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? flip.marketAnalysis.historicalNetMarginMedian : null;
    case "conservativeExpectedGpPerHour": return flip.conservativeExpectedGpPerHour;
    case "roi": return flip.roi;
    case "score": return flip.score;
    case "confidence": return flip.confidence;
    case "stability": return flip.stability;
    case "totalBuyLimitProfit": return flip.buyLimit ? flip.totalBuyLimitProfit : null;
    case "volume": return flip.volume;
    case "freshnessSeconds": return flip.freshnessSeconds;
    case "buyLimit": return flip.buyLimit;
  }
}
