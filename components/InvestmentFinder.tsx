"use client";

import { ExternalLink, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, type Theme } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { ItemLookupDialog } from "@/components/ItemLookupDialog";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { formatClock, formatCompact, formatGp, formatNumber, formatPercent } from "@/lib/format";
import type { InvestmentCandidate, PricePoint } from "@/lib/types";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";

type InvestmentsResponse = {
  data?: InvestmentCandidate[];
  error?: string;
  meta?: {
    generatedAt: string;
    analyzed: number;
    qualified: number;
    skipped: number;
  };
};

type TimeseriesResponse = {
  data?: PricePoint[];
  error?: string;
};

type Filters = {
  search: string;
  minShortTrend: string;
  minMediumTrend: string;
  minVolume: string;
  maxPrice: string;
  members: string;
  sort: string;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  minShortTrend: "",
  minMediumTrend: "",
  minVolume: "",
  maxPrice: "",
  members: "all",
  sort: "score"
};

type InvestmentSortKey =
  | "name"
  | "currentMidpoint"
  | "shortTrend"
  | "mediumTrend"
  | "matchedVolume"
  | "volatility"
  | "confidence"
  | "score";

export function InvestmentFinder() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investments, setInvestments] = useState<InvestmentCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [lookupItemId, setLookupItemId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("Waiting for market data");
  const [tableSort, setTableSort] = useState<{ key: InvestmentSortKey; direction: SortDirection }>({
    key: "score",
    direction: "desc"
  });

  const selected = investments.find((candidate) => candidate.id === selectedId);
  const sortedInvestments = useMemo(
    () => sortTableRows(investments, (candidate) => investmentSortValue(candidate, tableSort.key), tableSort.direction),
    [investments, tableSort]
  );
  const query = useMemo(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    return params.toString();
  }, [filters]);

  const loadInvestments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/investments?${query}`);
      const payload = (await response.json()) as InvestmentsResponse;
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load investments.");
      const nextInvestments = payload.data ?? [];
      setInvestments(nextInvestments);
      setGeneratedAt(payload.meta?.generatedAt ?? null);
      setAnalysisStatus(
        payload.meta
          ? `${payload.meta.qualified} opportunities from ${payload.meta.analyzed} liquid items${payload.meta.skipped ? `, skipped ${payload.meta.skipped}` : ""}`
          : "Market analysis complete"
      );
      setSelectedId((current) =>
        current && nextInvestments.some((candidate) => candidate.id === current)
          ? current
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load investments.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    loadInvestments();
  }, [loadInvestments]);

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

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function toggleTableSort(key: InvestmentSortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
    const sort = investmentFilterSort(key);
    if (sort) updateFilter("sort", sort);
  }

  return (
    <AppShell
      activePath="/investments"
      title="Investment Finder"
      headerActions={
        <div className="status-pill">
          <span className="status-pill-copy" title={generatedAt ? `${analysisStatus} · Updated ${formatClock(generatedAt)}` : analysisStatus}>
            {generatedAt ? `${analysisStatus} · Updated ${formatClock(generatedAt)}` : analysisStatus}
          </span>
          <button className="refresh-btn" disabled={loading} onClick={loadInvestments} type="button" aria-label={loading ? "Refreshing investments" : "Refresh investments"} title={loading ? "Refreshing investments" : "Refresh investments"}>
            {loading ? <LoadingSpinner size="small" variant="button" /> : <RefreshCw aria-hidden="true" size={14} />}
          </button>
        </div>
      }
    >
      {(theme) => (
        <>
          <div className={`main-grid${detailPanelOpen ? "" : " detail-panel-closed"}`}>
            <section className="table-wrap" aria-label="Ranked investments">
              {error ? <div className="error">{error}</div> : null}
              {loading ? <LoadingSpinner label="Analyzing liquid markets and price history..." /> : null}
              {!loading && !error && investments.length === 0 ? <div className="empty">No investments match these filters.</div> : null}
              {!loading && !error && investments.length > 0 ? (
                <StickyTable>
                  <table>
                    <thead>
                      <tr>
                        <SortableTableHeader label="Item" active={tableSort.key === "name"} direction={tableSort.direction} onSort={() => toggleTableSort("name")} filter={{
                          active: Boolean(filters.search) || filters.members !== "all",
                          fields: [
                            { id: "search", label: "Search items", placeholder: "Rune, potion, ore...", value: filters.search },
                            { clearValue: "all", id: "members", label: "Market", options: [{ label: "All items", value: "all" }, { label: "F2P only", value: "f2p" }, { label: "Members", value: "members" }], type: "select", value: filters.members }
                          ],
                          onApply: (values) => {
                            updateFilter("search", String(values.search));
                            updateFilter("members", String(values.members));
                          }
                        }} />
                        <SortableTableHeader label="Midpoint" active={tableSort.key === "currentMidpoint"} direction={tableSort.direction} onSort={() => toggleTableSort("currentMidpoint")} filter={{
                          active: Boolean(filters.maxPrice),
                          fields: [{ id: "maxPrice", label: "Maximum midpoint price", type: "number", value: filters.maxPrice }],
                          onApply: (values) => updateFilter("maxPrice", String(values.maxPrice))
                        }} />
                        <SortableTableHeader label="24h trend" active={tableSort.key === "shortTrend"} direction={tableSort.direction} onSort={() => toggleTableSort("shortTrend")} filter={{
                          active: Boolean(filters.minShortTrend),
                          fields: [{ id: "minShortTrend", label: "Minimum 24h trend %", type: "number", value: filters.minShortTrend }],
                          onApply: (values) => updateFilter("minShortTrend", String(values.minShortTrend))
                        }} />
                        <SortableTableHeader label="7d trend" active={tableSort.key === "mediumTrend"} direction={tableSort.direction} onSort={() => toggleTableSort("mediumTrend")} filter={{
                          active: Boolean(filters.minMediumTrend),
                          fields: [{ id: "minMediumTrend", label: "Minimum 7d trend %", type: "number", value: filters.minMediumTrend }],
                          onApply: (values) => updateFilter("minMediumTrend", String(values.minMediumTrend))
                        }} />
                        <SortableTableHeader label="24h volume" active={tableSort.key === "matchedVolume"} direction={tableSort.direction} onSort={() => toggleTableSort("matchedVolume")} filter={{
                          active: Boolean(filters.minVolume),
                          fields: [{ id: "minVolume", label: "Minimum 24h volume", type: "number", value: filters.minVolume }],
                          onApply: (values) => updateFilter("minVolume", String(values.minVolume))
                        }} />
                        <SortableTableHeader label="Volatility" active={tableSort.key === "volatility"} direction={tableSort.direction} onSort={() => toggleTableSort("volatility")} />
                        <SortableTableHeader label="Confidence" active={tableSort.key === "confidence"} direction={tableSort.direction} onSort={() => toggleTableSort("confidence")} />
                        <SortableTableHeader label="Score" active={tableSort.key === "score"} direction={tableSort.direction} onSort={() => toggleTableSort("score")} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedInvestments.map((candidate) => (
                        <tr
                          aria-label={`Select ${candidate.name}`}
                          className={detailPanelOpen && selected?.id === candidate.id ? "selected" : ""}
                          key={candidate.id}
                          onClick={() => {
                            setSelectedId(candidate.id);
                            setDetailPanelOpen(true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              setSelectedId(candidate.id);
                              setDetailPanelOpen(true);
                            }
                          }}
                          tabIndex={0}
                        >
                          <td>
                            <div className="item-cell">
                              <ItemIcon icon={candidate.icon} className="item-icon" />
                              <div>
                                <div className="item-name">{candidate.name}</div>
                                <div className="item-meta">{candidate.members ? "Members" : "F2P"} {candidate.warnings[0] ? `- ${candidate.warnings[0]}` : ""}</div>
                              </div>
                            </div>
                          </td>
                          <td>{formatGp(candidate.currentMidpoint)}</td>
                          <td className="profit">{formatPercent(candidate.shortTrend)}</td>
                          <td className="profit">{formatPercent(candidate.mediumTrend)}</td>
                          <td>{formatNumber(candidate.matchedVolume)}</td>
                          <td>{formatPercent(candidate.volatility)}</td>
                          <td>{formatPercent(candidate.confidence)}</td>
                          <td className="score">{candidate.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </StickyTable>
              ) : null}
            </section>

            {detailPanelOpen ? (
              <aside className="detail-panel" aria-label="Selected investment details">
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
                        aria-label="Close investment details"
                        className="detail-panel-close"
                        onClick={() => setDetailPanelOpen(false)}
                        title="Close investment details"
                        type="button"
                      >
                        <X size={17} />
                      </button>
                    </div>

                    <div className="metric-grid">
                      <Metric label="24h trend" value={formatPercent(selected.shortTrend)} tone="profit" />
                      <Metric label="7d trend" value={formatPercent(selected.mediumTrend)} tone="profit" />
                      <Metric label="Trend consistency" value={formatPercent(selected.consistency)} />
                      <Metric label="Confidence" value={formatPercent(selected.confidence)} />
                      <Metric label="Hourly volatility" value={formatPercent(selected.volatility)} />
                      <Metric label="Liquidity percentile" value={formatPercent(selected.liquidityPercentile)} />
                    </div>

                    {selected.warnings.length > 0 ? (
                      <div className="warning-list">
                        {selected.warnings.map((warning) => <div className="warning-banner" key={warning}>{warning}</div>)}
                      </div>
                    ) : null}

                    <div>
                      <h3>7-day midpoint price</h3>
                      <div className="chart">
                        {chartLoading ? <LoadingSpinner label="Loading chart..." /> : chartData.length === 0 ? (
                          <div className="empty">No recent chart data is available.</div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={toSevenDayChart(chartData)}>
                              <CartesianGrid stroke={chartColors(theme).grid} vertical={false} />
                              <XAxis dataKey="time" stroke={chartColors(theme).axis} tick={{ fontSize: 11 }} minTickGap={28} />
                              <YAxis stroke={chartColors(theme).axis} tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompact} domain={["auto", "auto"]} />
                              <Tooltip
                                contentStyle={{ background: chartColors(theme).tooltip, border: 0, borderRadius: 8, color: chartColors(theme).axis }}
                                formatter={(value) => formatGp(Number(value))}
                              />
                              <Area dataKey="midpoint" stroke={chartColors(theme).trend} fill={`${chartColors(theme).trend}26`} name="Midpoint" />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>

                    <p className="muted">
                      Score combines 40% short-term and 60% medium-term momentum, then rewards confidence,
                      consistency, and liquidity while penalizing volatility. Positive historical momentum does not
                      guarantee continued price growth.
                    </p>
                  </>
                ) : <div className="empty">Select an investment to inspect its trend.</div>}
              </aside>
            ) : null}
          </div>
          {lookupItemId ? (
            <ItemLookupDialog
              itemId={lookupItemId}
              itemName={investments.find((candidate) => candidate.id === lookupItemId)?.name ?? "item"}
              onClose={() => setLookupItemId(null)}
              theme={theme}
            />
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function toChartPoint(point: PricePoint) {
  const hasPrices = (point.avgHighPrice ?? 0) > 0 && (point.avgLowPrice ?? 0) > 0;
  return {
    time: new Date(point.timestamp * 1000).toLocaleDateString([], { weekday: "short", hour: "2-digit" }),
    midpoint: hasPrices ? ((point.avgHighPrice ?? 0) + (point.avgLowPrice ?? 0)) / 2 : null
  };
}

function toSevenDayChart(points: PricePoint[]) {
  const latestTimestamp = points.at(-1)?.timestamp ?? 0;
  const cutoff = latestTimestamp - 7 * 24 * 60 * 60;
  return points
    .filter((point) => point.timestamp >= cutoff)
    .map(toChartPoint)
    .filter((point) => point.midpoint !== null);
}

function chartColors(theme: Theme) {
  if (theme === "dark") {
    return { grid: "#3b3a2d", axis: "#aaa18b", tooltip: "#1c1e17", trend: "#91bd78" };
  }
  if (theme === "midnight") {
    return { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", trend: "#72b99b" };
  }
  return { grid: "#e1ddd0", axis: "#756f5f", tooltip: "#fffdf8", trend: "#287255" };
}

function investmentFilterSort(key: InvestmentSortKey): Filters["sort"] | undefined {
  switch (key) {
    case "score":
    case "shortTrend":
    case "mediumTrend":
    case "volatility":
      return key;
    case "matchedVolume":
      return "volume";
    default:
      return undefined;
  }
}

function investmentSortValue(candidate: InvestmentCandidate, key: InvestmentSortKey): number | string {
  switch (key) {
    case "name": return candidate.name;
    case "currentMidpoint": return candidate.currentMidpoint;
    case "shortTrend": return candidate.shortTrend;
    case "mediumTrend": return candidate.mediumTrend;
    case "matchedVolume": return candidate.matchedVolume;
    case "volatility": return candidate.volatility;
    case "confidence": return candidate.confidence;
    case "score": return candidate.score;
  }
}
