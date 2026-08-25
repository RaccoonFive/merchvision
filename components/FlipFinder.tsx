"use client";

import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
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
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
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
  includeStale: false,
  includeLowConfidence: false
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
        if (value) params.set(key, "true");
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
  }

  function updateRanking(sort: FlipSortKey) {
    updateFilter("sort", sort === "netProfit" ? "profit" : sort === "freshnessSeconds" ? "freshness" : sort);
    setTableSort({ key: sort, direction: sort === "freshnessSeconds" ? "asc" : "desc" });
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
          <section className="toolbar" aria-label="Flip filters">
          <div className="field">
            <label htmlFor="search">
              <Search size={13} /> Search
            </label>
            <input
              id="search"
              value={filters.search}
              onChange={(event) => updateFilter("search", event.target.value)}
              placeholder="Nature rune, bowstring..."
            />
          </div>
          <NumberField id="minProfit" label="Min profit" value={filters.minProfit} onChange={(value) => updateFilter("minProfit", value)} />
          <NumberField id="minRoi" label="Min ROI %" value={filters.minRoi} onChange={(value) => updateFilter("minRoi", value)} />
          <NumberField id="minVolume" label="Min volume" value={filters.minVolume} onChange={(value) => updateFilter("minVolume", value)} />
          <NumberField id="minConfidence" label="Min conf. %" value={filters.minConfidence} onChange={(value) => updateFilter("minConfidence", value)} />
          <NumberField id="minStability" label="Min stable %" value={filters.minStability} onChange={(value) => updateFilter("minStability", value)} />
          <NumberField id="minTotalBuyLimitProfit" label="Min limit profit" value={filters.minTotalBuyLimitProfit} onChange={(value) => updateFilter("minTotalBuyLimitProfit", value)} />
          <NumberField id="maxPrice" label="Max buy price" value={filters.maxPrice} onChange={(value) => updateFilter("maxPrice", value)} />
          <div className="field">
            <label htmlFor="members">Market</label>
            <select id="members" value={filters.members} onChange={(event) => updateFilter("members", event.target.value)}>
              <option value="all">All items</option>
              <option value="f2p">F2P only</option>
              <option value="members">Members</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sort">
              <SlidersHorizontal size={13} /> Sort
            </label>
            <select
              id="sort"
              value={filters.sort}
              onChange={(event) => updateRanking(event.target.value === "profit" ? "netProfit" : event.target.value === "freshness" ? "freshnessSeconds" : event.target.value as FlipSortKey)}
            >
              <option value="score">Score</option>
              <option value="confidence">Confidence</option>
              <option value="stability">Stability</option>
              <option value="totalBuyLimitProfit">Buy-limit profit</option>
              <option value="profit">Profit</option>
              <option value="roi">ROI</option>
              <option value="volume">Volume</option>
              <option value="freshness">Freshness</option>
            </select>
          </div>
          <div className="field field-toggle">
            <label htmlFor="includeWeakData">
              <input
                checked={filters.includeStale && filters.includeLowConfidence}
                id="includeWeakData"
                onChange={(event) => {
                  updateFilter("includeStale", event.target.checked);
                  updateFilter("includeLowConfidence", event.target.checked);
                }}
                type="checkbox"
              />
              Include weak data
            </label>
            <p>Default results exclude quotes over 1 hour old and confidence below 45%.</p>
          </div>
          </section>

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
                    <SortableTableHeader label="Item" active={tableSort.key === "name"} direction={tableSort.direction} onSort={() => toggleTableSort("name")} />
                    <SortableTableHeader label="Buy" active={tableSort.key === "buyPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("buyPrice")} />
                    <SortableTableHeader label="Sell" active={tableSort.key === "sellPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("sellPrice")} />
                    <SortableTableHeader label="Margin" active={tableSort.key === "margin"} direction={tableSort.direction} onSort={() => toggleTableSort("margin")} />
                    <SortableTableHeader label="Tax" active={tableSort.key === "tax"} direction={tableSort.direction} onSort={() => toggleTableSort("tax")} />
                    <SortableTableHeader label="Net" active={tableSort.key === "netProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("netProfit")} />
                    <SortableTableHeader label="ROI" active={tableSort.key === "roi"} direction={tableSort.direction} onSort={() => toggleTableSort("roi")} />
                    <SortableTableHeader label="Score" active={tableSort.key === "score"} direction={tableSort.direction} onSort={() => toggleTableSort("score")} />
                    <SortableTableHeader label="Conf." active={tableSort.key === "confidence"} direction={tableSort.direction} onSort={() => toggleTableSort("confidence")} />
                    <SortableTableHeader label="Volume" active={tableSort.key === "volume"} direction={tableSort.direction} onSort={() => toggleTableSort("volume")} />
                    <SortableTableHeader label="Fresh" active={tableSort.key === "freshnessSeconds"} direction={tableSort.direction} onSort={() => toggleTableSort("freshnessSeconds")} />
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
                          <ItemIcon flip={flip} className="item-icon" />
                          <div>
                            <div className="item-name">{flip.name}</div>
                            <div className="item-meta">
                              {flip.members ? "Members" : "F2P"}
                              {flip.warnings.length > 0 ? (
                                <span
                                  aria-label={`Market notes: ${flip.warnings.join(", ")}`}
                                  className="item-warning"
                                  title={flip.warnings.join("; ")}
                                >
                                  {flip.warnings[0]}{flip.warnings.length > 1 ? ` +${flip.warnings.length - 1}` : ""}
                                </span>
                              ) : null}
                            </div>
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
                  <ItemIcon flip={selected} className="detail-icon" />
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
              {selected.warnings.length > 0 ? (
                <div className="warning-chips" aria-label="Market notes">
                  {selected.warnings.map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))}
                </div>
              ) : null}
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
                  <span>Rounded from {formatScorePoints(selected.scoreBreakdown.rawScore)}</span>
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

function NumberField({
  id,
  label,
  value,
  onChange
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}

function ItemIcon({ flip, className }: { flip: FlipCandidate; className: string }) {
  if (!flip.icon) {
    return <div className={className} aria-hidden="true" />;
  }

  return <img alt="" className={className} src={flip.icon} />;
}

function toChartPoint(point: PricePoint) {
  return {
    time: new Date(point.timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    high: point.avgHighPrice,
    low: point.avgLowPrice
  };
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

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatScorePoints(value: number, signed = false): string {
  const prefix = signed && value > 0 ? "+" : "";
  return `${prefix}${value.toFixed(2)} pts`;
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
