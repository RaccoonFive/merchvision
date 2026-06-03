"use client";

import { RefreshCw, Search, SlidersHorizontal } from "lucide-react";
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
  maxPrice: string;
  members: string;
  sort: string;
  includeStale: boolean;
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  minProfit: "100",
  minRoi: "0.5",
  minVolume: "100",
  maxPrice: "",
  members: "all",
  sort: "score",
  includeStale: false
};

export function FlipFinder() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [flips, setFlips] = useState<FlipCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const selected = flips.find((flip) => flip.id === selectedId) ?? flips[0];

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
      setSelectedId((current) => (current && nextFlips.some((flip) => flip.id === current) ? current : nextFlips[0]?.id ?? null));
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
    if (!selected?.id) {
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
  }, [selected?.id]);

  function updateFilter(key: keyof Filters, value: string | boolean) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">MV</div>
          <div>
            <h1>Merchvision</h1>
            <p className="subtitle">Live OSRS Grand Exchange flip finder</p>
          </div>
        </div>
        <div className="status-pill">
          <RefreshCw size={15} />
          {generatedAt ? `Updated ${formatClock(generatedAt)}` : "Waiting for prices"}
          <button className="refresh-btn" onClick={loadFlips} type="button" aria-label="Refresh flips">
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </header>

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
          <select id="sort" value={filters.sort} onChange={(event) => updateFilter("sort", event.target.value)}>
            <option value="score">Score</option>
            <option value="profit">Profit</option>
            <option value="roi">ROI</option>
            <option value="volume">Volume</option>
            <option value="freshness">Freshness</option>
          </select>
        </div>
      </section>

      <div className="main-grid">
        <section className="table-wrap" aria-label="Ranked flips">
          {error ? <div className="error">{error}</div> : null}
          {loading ? <div className="empty">Loading live margins...</div> : null}
          {!loading && !error && flips.length === 0 ? <div className="empty">No flips match these filters.</div> : null}
          {!loading && !error && flips.length > 0 ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Buy</th>
                    <th>Sell</th>
                    <th>Margin</th>
                    <th>Tax</th>
                    <th>Net</th>
                    <th>ROI</th>
                    <th>Volume</th>
                    <th>Fresh</th>
                    <th>Limit</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {flips.map((flip) => (
                    <tr
                      className={selected?.id === flip.id ? "selected" : ""}
                      key={flip.id}
                      onClick={() => setSelectedId(flip.id)}
                    >
                      <td>
                        <div className="item-cell">
                          <ItemIcon flip={flip} className="item-icon" />
                          <div>
                            <div className="item-name">{flip.name}</div>
                            <div className="item-meta">{flip.members ? "Members" : "F2P"} {flip.warnings[0] ? `- ${flip.warnings[0]}` : ""}</div>
                          </div>
                        </div>
                      </td>
                      <td>{formatGp(flip.buyPrice)}</td>
                      <td>{formatGp(flip.sellPrice)}</td>
                      <td>{formatGp(flip.margin)}</td>
                      <td>{formatGp(flip.tax)}</td>
                      <td className="profit">{formatGp(flip.netProfit)}</td>
                      <td>{formatPercent(flip.roi)}</td>
                      <td>{formatNumber(flip.volume)}</td>
                      <td>{formatAge(flip.freshnessSeconds)}</td>
                      <td>{flip.buyLimit ? formatNumber(flip.buyLimit) : "?"}</td>
                      <td className="score">{flip.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>

        <aside className="detail-panel" aria-label="Selected item details">
          {selected ? (
            <>
              <div className="detail-head">
                <ItemIcon flip={selected} className="detail-icon" />
                <div>
                  <h2>{selected.name}</h2>
                  <p className="subtitle">{selected.members ? "Members item" : "Free-to-play item"}</p>
                </div>
              </div>
              <div className="metric-grid">
                <Metric label="Net profit" value={formatGp(selected.netProfit)} tone="profit" />
                <Metric label="ROI" value={formatPercent(selected.roi)} />
                <Metric label="Buy limit" value={selected.buyLimit ? formatNumber(selected.buyLimit) : "Unknown"} />
                <Metric label="Freshness" value={formatAge(selected.freshnessSeconds)} />
              </div>
              <div>
                <h3>Recent prices</h3>
                <div className="chart">
                  {chartLoading ? (
                    <div className="empty">Loading chart...</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.map(toChartPoint)}>
                        <CartesianGrid stroke="#313946" vertical={false} />
                        <XAxis dataKey="time" stroke="#9aa8b8" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#9aa8b8" tick={{ fontSize: 11 }} width={72} tickFormatter={formatCompact} />
                        <Tooltip
                          contentStyle={{ background: "#10151d", border: "1px solid #313946", borderRadius: 6 }}
                          formatter={(value) => formatGp(Number(value))}
                        />
                        <Area dataKey="high" stroke="#58c18c" fill="#58c18c33" name="High" />
                        <Area dataKey="low" stroke="#e4b454" fill="#e4b45433" name="Low" />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
              <p className="muted">
                Conservative flip math uses current low as buy price, current high as sell price, then subtracts GE tax.
              </p>
            </>
          ) : (
            <div className="empty">Select a flip to inspect the math.</div>
          )}
        </aside>
      </div>
    </main>
  );
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
