"use client";

import { RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, type Theme } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { StickyTable } from "@/components/StickyTable";
import type { InvestmentCandidate, PricePoint } from "@/lib/types";

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

export function InvestmentFinder() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [investments, setInvestments] = useState<InvestmentCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string>("Waiting for market data");

  const selected = investments.find((candidate) => candidate.id === selectedId);
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

  return (
    <AppShell
      activePath="/investments"
      title="Investment Finder"
      subtitle="Find liquid GE items with confirmed short- and medium-term momentum"
      headerActions={
        <div className="status-pill">
          <RefreshCw size={15} />
          {generatedAt ? `${analysisStatus} · Updated ${formatClock(generatedAt)}` : analysisStatus}
          <button className="refresh-btn" disabled={loading} onClick={loadInvestments} type="button" aria-label="Refresh investments">
            {loading ? <LoadingSpinner label="Refreshing..." size="small" variant="button" /> : <><RefreshCw size={16} /> Refresh</>}
          </button>
        </div>
      }
    >
      {(theme) => (
        <>
          <section className="toolbar" aria-label="Investment filters">
            <div className="field">
              <label htmlFor="investment-search"><Search size={13} /> Search</label>
              <input
                id="investment-search"
                value={filters.search}
                onChange={(event) => updateFilter("search", event.target.value)}
                placeholder="Rune, potion, ore..."
              />
            </div>
            <NumberField id="minShortTrend" label="Min 24h trend %" value={filters.minShortTrend} onChange={(value) => updateFilter("minShortTrend", value)} />
            <NumberField id="minMediumTrend" label="Min 7d trend %" value={filters.minMediumTrend} onChange={(value) => updateFilter("minMediumTrend", value)} />
            <NumberField id="minVolume" label="Min 24h volume" value={filters.minVolume} onChange={(value) => updateFilter("minVolume", value)} />
            <NumberField id="maxPrice" label="Max midpoint" value={filters.maxPrice} onChange={(value) => updateFilter("maxPrice", value)} />
            <div className="field">
              <label htmlFor="investment-members">Market</label>
              <select id="investment-members" value={filters.members} onChange={(event) => updateFilter("members", event.target.value)}>
                <option value="all">All items</option>
                <option value="f2p">F2P only</option>
                <option value="members">Members</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="investment-sort"><SlidersHorizontal size={13} /> Sort</label>
              <select id="investment-sort" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
                <option value="score">Risk-adjusted score</option>
                <option value="shortTrend">24h trend</option>
                <option value="mediumTrend">7d trend</option>
                <option value="volume">Matched volume</option>
                <option value="volatility">Lowest volatility</option>
              </select>
            </div>
          </section>

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
                        <th>Item</th>
                        <th>Midpoint</th>
                        <th>24h trend</th>
                        <th>7d trend</th>
                        <th>24h volume</th>
                        <th>Volatility</th>
                        <th>Confidence</th>
                        <th>Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((candidate) => (
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
                              <ItemIcon candidate={candidate} className="item-icon" />
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
                        <ItemIcon candidate={selected} className="detail-icon" />
                        <div>
                          <h2><Link className="detail-title-link" href={`/lookup/${selected.id}`}>{selected.name}</Link></h2>
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
        </>
      )}
    </AppShell>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} min="0" type="number" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "profit" }) {
  return <div className="metric"><span>{label}</span><strong className={tone}>{value}</strong></div>;
}

function ItemIcon({ candidate, className }: { candidate: InvestmentCandidate; className: string }) {
  return candidate.icon ? <img alt="" className={className} src={candidate.icon} /> : <div className={className} aria-hidden="true" />;
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
  return theme === "dark"
    ? { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", trend: "#72b99b" }
    : { grid: "#e9edf1", axis: "#7d9ab3", tooltip: "#ffffff", trend: "#398066" };
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

function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
