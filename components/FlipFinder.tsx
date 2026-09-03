"use client";

import { AlertTriangle, ExternalLink, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  FlipCandidate,
  FlipView,
  PricePoint,
  RankedFlipCandidate,
  UpsideFlipCandidate
} from "@/lib/types";
import type { FlipDataHealth } from "@/lib/flipFinder";
import { AppShell, type Theme } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { ItemLookupDialog } from "@/components/ItemLookupDialog";
import { LazyPriceHistoryChart } from "@/components/LazyPriceHistoryChart";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { formatAge, formatGp, formatNumber, formatPercent } from "@/lib/format";
import { flipDataHealthMessage, flipStatusLabel } from "@/lib/flipHealth";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";

type FlipsResponse = {
  data?: RankedFlipCandidate[];
  error?: string;
  meta?: {
    generatedAt: string;
    health: FlipDataHealth;
    modelVersion: string;
    view: FlipView;
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
  minExpectedGpPerHour: string;
  minOpportunityConfidence: string;
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
  minExpectedGpPerHour: "",
  minOpportunityConfidence: "",
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
  | "capturableNetMargin"
  | "riskAdjustedGpPerHour"
  | "opportunityConfidence"
  | "estimatedUnitsPerHour"
  | "volume"
  | "freshnessSeconds"
  | "quoteSkewSeconds"
  | "buyLimit";

export function FlipFinder() {
  const [view, setView] = useState<FlipView>("reliable");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [flips, setFlips] = useState<RankedFlipCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailPanelOpen, setDetailPanelOpen] = useState(false);
  const [lookupItemId, setLookupItemId] = useState<number | null>(null);
  const [chartData, setChartData] = useState<PricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dataHealth, setDataHealth] = useState<FlipDataHealth | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [modelVersion, setModelVersion] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<{ key: FlipSortKey; direction: SortDirection }>({
    key: "score",
    direction: "desc"
  });

  const selected = flips.find((flip) => flip.id === selectedId);
  const sortedFlips = useMemo(
    () => sortTableRows(flips, (flip) => flipSortValue(flip, tableSort.key), tableSort.direction),
    [flips, tableSort]
  );
  const query = useMemo(() => buildQuery(view, filters), [filters, view]);

  const loadFlips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/flips?${query}`);
      const payload = (await response.json()) as FlipsResponse;
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load flips.");
      const nextFlips = (payload.data ?? []).filter((flip) => flip.view === view);
      setFlips(nextFlips);
      setDataHealth(payload.meta?.health ?? null);
      setGeneratedAt(payload.meta?.generatedAt ?? null);
      setModelVersion(payload.meta?.modelVersion ?? null);
      setSelectedId((current) => (current && nextFlips.some((flip) => flip.id === current) ? current : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load flips.");
    } finally {
      setLoading(false);
    }
  }, [query, view]);

  useEffect(() => {
    loadFlips();
  }, [loadFlips]);

  useEffect(() => {
    if (!detailPanelOpen || !selected?.id) {
      setChartData([]);
      setChartError(null);
      return;
    }

    let alive = true;
    setChartLoading(true);
    setChartError(null);
    const timestep = selected.view === "upside" ? "5m" : "1h";
    fetch(`/api/items/${selected.id}/timeseries?timestep=${timestep}`)
      .then(async (response) => {
        const payload = (await response.json()) as TimeseriesResponse;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load chart.");
        if (alive) setChartData(payload.data ?? []);
      })
      .catch((err) => {
        if (alive) {
          setChartData([]);
          setChartError(err instanceof Error ? err.message : "Unable to load chart.");
        }
      })
      .finally(() => {
        if (alive) setChartLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [detailPanelOpen, selected?.id, selected?.view]);

  function updateFilter(key: keyof Filters, value: string | boolean) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function changeView(nextView: FlipView) {
    if (nextView === view) return;
    setView(nextView);
    setFlips([]);
    setSelectedId(null);
    setDetailPanelOpen(false);
    setGeneratedAt(null);
    setDataHealth(null);
    setModelVersion(null);
    setTableSort({ key: nextView === "upside" ? "riskAdjustedGpPerHour" : "score", direction: "desc" });
    setFilters((current) => ({
      ...current,
      sort: nextView === "upside" ? "riskAdjustedGpPerHour" : "score"
    }));
  }

  function toggleTableSort(key: FlipSortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
    const sort = flipFilterSort(key, view);
    if (sort) updateFilter("sort", sort);
  }

  return (
    <AppShell
      activePath="/"
      title="Flip Finder"
      headerActions={
        <div className="status-pill">
          <span className="status-pill-copy" title={flipStatusLabel({ dataHealth, error, flips, generatedAt })}>
            {flipStatusLabel({ dataHealth, error, flips, generatedAt })}
          </span>
          <button className="refresh-btn" disabled={loading} onClick={loadFlips} type="button" aria-label={loading ? "Refreshing flips" : "Refresh flips"} title={loading ? "Refreshing flips" : "Refresh flips"}>
            {loading ? <LoadingSpinner size="small" variant="button" /> : <RefreshCw aria-hidden="true" size={14} />}
          </button>
        </div>
      }
    >
      {(theme) => (
        <>
          <div className="flip-view-toolbar">
            <div className="flip-view-tabs" role="tablist" aria-label="Flip ranking view">
              <button aria-selected={view === "reliable"} className={view === "reliable" ? "active" : ""} onClick={() => changeView("reliable")} role="tab" type="button">
                Reliable
              </button>
              <button aria-selected={view === "upside"} className={view === "upside" ? "active" : ""} onClick={() => changeView("upside")} role="tab" type="button">
                High Upside <span className="experimental-badge">Experimental</span>
              </button>
            </div>
            <p className="flip-view-description">
              {view === "reliable"
                ? "Seven-day repeatability, liquidity, and market quality remain the default ranking."
                : "Recent upper-range margins ranked by a risk-adjusted 1–4 hour GP estimate. Fill capacity and profit remain estimates."}
              {modelVersion ? ` Model ${modelVersion}.` : ""}
            </p>
          </div>

          <div className={`main-grid${detailPanelOpen ? "" : " detail-panel-closed"}`}>
            <section className="table-wrap" aria-label={`${view === "reliable" ? "Reliable" : "High Upside"} ranked flips`}>
              {error ? (
                <div className={flips.length > 0 ? "data-health-banner error-banner" : "error"} role="alert">
                  <span>{flips.length > 0 ? `${error} Showing the previous results.` : error}</span>
                  <button className="secondary-btn compact-btn" disabled={loading} onClick={loadFlips} type="button">Try again</button>
                </div>
              ) : null}
              {!error && dataHealth?.isPartial ? (
                <div className="data-health-banner" role="status">
                  <AlertTriangle aria-hidden="true" size={16} />
                  <span>{flipDataHealthMessage(dataHealth)}</span>
                </div>
              ) : null}
              {loading && flips.length === 0 ? <LoadingSpinner label={view === "upside" ? "Analyzing recent opportunities..." : "Loading live margins..."} /> : null}
              {!loading && !error && flips.length === 0 ? (
                <div className="empty">
                  {dataHealth?.isPartial
                    ? "No candidates meet this view's evidence and filter requirements in the market data that was available."
                    : "No flips meet this view's evidence and filter requirements."}
                </div>
              ) : null}
              {flips.length > 0 ? (
                <FlipTable
                  detailPanelOpen={detailPanelOpen}
                  filters={filters}
                  flips={sortedFlips}
                  selectedId={selected?.id}
                  tableSort={tableSort}
                  toggleTableSort={toggleTableSort}
                  updateFilter={updateFilter}
                  view={view}
                  onSelect={(id) => {
                    setSelectedId(id);
                    setDetailPanelOpen(true);
                  }}
                />
              ) : null}
            </section>

            {detailPanelOpen ? (
              <FlipDetails chartData={chartData} chartError={chartError} chartLoading={chartLoading} selected={selected} theme={theme} onClose={() => setDetailPanelOpen(false)} onLookup={setLookupItemId} />
            ) : null}
          </div>

          {lookupItemId ? (
            <ItemLookupDialog itemId={lookupItemId} itemName={flips.find((flip) => flip.id === lookupItemId)?.name ?? "item"} onClose={() => setLookupItemId(null)} theme={theme} />
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function FlipTable({
  detailPanelOpen,
  filters,
  flips,
  selectedId,
  tableSort,
  toggleTableSort,
  updateFilter,
  view,
  onSelect
}: {
  detailPanelOpen: boolean;
  filters: Filters;
  flips: RankedFlipCandidate[];
  selectedId?: number;
  tableSort: { key: FlipSortKey; direction: SortDirection };
  toggleTableSort: (key: FlipSortKey) => void;
  updateFilter: (key: keyof Filters, value: string | boolean) => void;
  view: FlipView;
  onSelect: (id: number) => void;
}) {
  const header = (label: string, key: FlipSortKey) => (
    <SortableTableHeader label={label} active={tableSort.key === key} direction={tableSort.direction} onSort={() => toggleTableSort(key)} />
  );

  return (
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
            <SortableTableHeader label="Buy observed" active={tableSort.key === "buyPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("buyPrice")} filter={{
              active: Boolean(filters.maxPrice),
              fields: [{ id: "maxPrice", label: "Maximum observed buy price", type: "number", value: filters.maxPrice }],
              onApply: (values) => updateFilter("maxPrice", String(values.maxPrice))
            }} />
            {header("Sell observed", "sellPrice")}
            <SortableTableHeader label="Current net observed" active={tableSort.key === "netProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("netProfit")} filter={{
              active: Boolean(filters.minProfit),
              fields: [{ id: "minProfit", label: "Minimum current net profit", type: "number", value: filters.minProfit }],
              onApply: (values) => updateFilter("minProfit", String(values.minProfit))
            }} />
            {view === "reliable" ? (
              <>
                {header("Margin", "margin")}
                {header("Tax", "tax")}
                {header("7d median net", "historicalNetMarginMedian")}
                {header("Est. GP/hr", "conservativeExpectedGpPerHour")}
              </>
            ) : (
              <>
                {header("Capturable net (est.)", "capturableNetMargin")}
                <SortableTableHeader label="Risk-adj. GP/hr (est.)" active={tableSort.key === "riskAdjustedGpPerHour"} direction={tableSort.direction} onSort={() => toggleTableSort("riskAdjustedGpPerHour")} filter={{
                  active: Boolean(filters.minExpectedGpPerHour),
                  fields: [{ id: "minExpectedGpPerHour", label: "Minimum risk-adjusted GP/hour", type: "number", value: filters.minExpectedGpPerHour }],
                  onApply: (values) => updateFilter("minExpectedGpPerHour", String(values.minExpectedGpPerHour))
                }} />
                <SortableTableHeader label="Opp. confidence" active={tableSort.key === "opportunityConfidence"} direction={tableSort.direction} onSort={() => toggleTableSort("opportunityConfidence")} filter={{
                  active: Boolean(filters.minOpportunityConfidence),
                  fields: [{ id: "minOpportunityConfidence", label: "Minimum opportunity confidence %", type: "number", value: filters.minOpportunityConfidence }],
                  onApply: (values) => updateFilter("minOpportunityConfidence", String(values.minOpportunityConfidence))
                }} />
                {header("Units/hr (est.)", "estimatedUnitsPerHour")}
              </>
            )}
            <SortableTableHeader label="ROI" active={tableSort.key === "roi"} direction={tableSort.direction} onSort={() => toggleTableSort("roi")} filter={{
              active: Boolean(filters.minRoi),
              fields: [{ id: "minRoi", label: "Minimum ROI %", type: "number", value: filters.minRoi }],
              onApply: (values) => updateFilter("minRoi", String(values.minRoi))
            }} />
            {view === "reliable" ? (
              <>
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
              </>
            ) : null}
            <SortableTableHeader label={view === "upside" ? "4h matched volume" : "12h traded volume"} active={tableSort.key === "volume"} direction={tableSort.direction} onSort={() => toggleTableSort("volume")} filter={{
              active: Boolean(filters.minVolume),
              fields: [{ id: "minVolume", label: `Minimum ${view === "upside" ? "four-hour matched" : "12-hour traded"} volume`, type: "number", value: filters.minVolume }],
              onApply: (values) => updateFilter("minVolume", String(values.minVolume))
            }} />
            {view === "reliable" ? (
              <SortableTableHeader label="Pair age" active={tableSort.key === "freshnessSeconds"} direction={tableSort.direction} onSort={() => toggleTableSort("freshnessSeconds")} filter={{
                active: !filters.includeStale,
                fields: [{ clearValue: true, id: "includeStale", label: "Include quote pairs older than 1 hour", type: "checkbox", value: filters.includeStale }],
                onApply: (values) => updateFilter("includeStale", values.includeStale === true)
              }} />
            ) : (
              <>
                {header("Pair age", "freshnessSeconds")}
                {header("Quote skew", "quoteSkewSeconds")}
              </>
            )}
            {view === "reliable" ? (
              <SortableTableHeader label="Current limit profit (est.)" active={tableSort.key === "totalBuyLimitProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("totalBuyLimitProfit")} filter={{
                active: Boolean(filters.minTotalBuyLimitProfit),
                fields: [{ id: "minTotalBuyLimitProfit", label: "Minimum buy-limit profit", type: "number", value: filters.minTotalBuyLimitProfit }],
                onApply: (values) => updateFilter("minTotalBuyLimitProfit", String(values.minTotalBuyLimitProfit))
              }} />
            ) : null}
            {header("Limit", "buyLimit")}
          </tr>
        </thead>
        <tbody>
          {flips.map((flip) => (
            <tr
              aria-label={`Select ${flip.name}`}
              className={detailPanelOpen && selectedId === flip.id ? "selected" : ""}
              key={flip.id}
              onClick={() => onSelect(flip.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onSelect(flip.id);
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
              <td className="profit">{formatGp(flip.netProfit)}</td>
              {flip.view === "reliable" ? <ReliableCells flip={flip} /> : <UpsideCells flip={flip} />}
              <td>{formatPercent(flip.roi)}</td>
              {flip.view === "reliable" ? (
                <>
                  <td className="score">{flip.score}</td>
                  <td>{flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatPercent(flip.confidence) : "Unavailable"}</td>
                </>
              ) : null}
              <td>{formatNumber(flip.volume)}</td>
              <td>{formatAge(flip.freshnessSeconds)}</td>
              {flip.view === "upside" ? <td>{formatAge(flip.quoteHealth.skewSeconds)}</td> : null}
              {flip.view === "reliable" ? <td className="profit">{flip.buyLimit ? formatGp(flip.totalBuyLimitProfit) : "Unavailable"}</td> : null}
              <td>{flip.buyLimit ? formatNumber(flip.buyLimit) : "?"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </StickyTable>
  );
}

function ReliableCells({ flip }: { flip: FlipCandidate }) {
  return (
    <>
      <td>{formatGp(flip.margin)}</td>
      <td>{formatGp(flip.tax)}</td>
      <td>{flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatGp(flip.marketAnalysis.historicalNetMarginMedian) : "Unavailable"}</td>
      <td>{flip.conservativeExpectedGpPerHour === null ? "Unavailable" : formatGp(flip.conservativeExpectedGpPerHour)}</td>
    </>
  );
}

function UpsideCells({ flip }: { flip: UpsideFlipCandidate }) {
  return (
    <>
      <td>{formatGp(flip.upsideAnalysis.capturableNetMargin)}</td>
      <td className="profit">{formatGp(flip.upsideAnalysis.riskAdjustedGpPerHour)}</td>
      <td>{formatPercent(flip.upsideAnalysis.opportunityConfidence)}</td>
      <td>{formatNumber(flip.upsideAnalysis.estimatedUnitsPerHour)}</td>
    </>
  );
}

function FlipDetails({
  chartData,
  chartError,
  chartLoading,
  selected,
  theme,
  onClose,
  onLookup
}: {
  chartData: PricePoint[];
  chartError: string | null;
  chartLoading: boolean;
  selected?: RankedFlipCandidate;
  theme: Theme;
  onClose: () => void;
  onLookup: (id: number) => void;
}) {
  return (
    <aside className="detail-panel" aria-label="Selected item details">
      {selected ? (
        <>
          <div className="detail-panel-head">
            <div className="detail-head">
              <ItemIcon icon={selected.icon} className="detail-icon" />
              <div>
                <div className="detail-title-actions">
                  <h2><button className="detail-title-link" onClick={() => onLookup(selected.id)} type="button">{selected.name}</button></h2>
                  <Link aria-label={`Open ${selected.name} in a new tab`} className="detail-title-new-tab" href={`/lookup/${selected.id}`} rel="noreferrer" target="_blank" title="Open in a new tab">
                    <ExternalLink aria-hidden="true" size={14} />
                  </Link>
                </div>
                <p className="subtitle">{selected.members ? "Members item" : "Free-to-play item"}</p>
              </div>
            </div>
            <button aria-label="Close item details" className="detail-panel-close" onClick={onClose} title="Close item details" type="button"><X size={17} /></button>
          </div>

          {selected.view === "reliable" ? <ReliableDetails flip={selected} /> : <UpsideDetails flip={selected} />}

          {selected.warnings.length > 0 ? (
            <div className="warning-list" aria-label="Market warnings">
              {selected.warnings.map((warning) => (
                <div className="warning-banner" key={warning}><AlertTriangle aria-hidden="true" size={16} /><span>{warning}</span></div>
              ))}
            </div>
          ) : null}

          <div>
            <h3>{selected.view === "upside" ? "Recent five-minute prices" : "Recent hourly prices"}</h3>
            <div className="chart">
              {chartLoading ? <LoadingSpinner label="Loading chart..." /> : chartError ? (
                <div className="error" role="alert">{chartError}</div>
              ) : chartData.length === 0 ? (
                <div className="empty">No recent price observations are available.</div>
              ) : (
                <LazyPriceHistoryChart
                  colors={chartColors(theme)}
                  data={chartData.map(toChartPoint)}
                  series="high-low"
                />
              )}
            </div>
          </div>

          {selected.view === "reliable" ? (
            <section className="score-breakdown" aria-label="How this score is calculated">
              <div className="score-breakdown-head"><h3>How this score is calculated</h3></div>
              <p className="muted">The 0–100 score balances conservative profit potential with seven-day liquidity and market quality, then subtracts freshness, spike, and missing-limit penalties.</p>
              <ul>
                {selected.scoreBreakdown.components.map((component) => (
                  <li className={component.kind} key={component.label}><span>{component.label}</span><strong>{formatScorePoints(component.points, true)}</strong></li>
                ))}
              </ul>
              <div className="score-breakdown-total">
                <span>Component total</span><strong>{formatScorePoints(selected.scoreBreakdown.rawScore)}</strong>
                <span>Displayed score (rounded, 0–100)</span><strong>{selected.scoreBreakdown.score}</strong>
              </div>
            </section>
          ) : null}
        </>
      ) : <div className="empty">Select a flip to inspect the evidence.</div>}
    </aside>
  );
}

function ReliableDetails({ flip }: { flip: FlipCandidate }) {
  return (
    <>
      <div className="score-summary"><span>Repeatability score</span><strong>{flip.score}/100</strong></div>
      <div className="metric-grid compact">
        <Metric label="Current net profit (observed)" value={formatGp(flip.netProfit)} tone="profit" />
        <Metric label="Current ROI (observed)" value={formatPercent(flip.roi)} />
        <Metric label="7d median net margin" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatGp(flip.marketAnalysis.historicalNetMarginMedian) : "Unavailable"} />
        <Metric label="Repeatable net profit" value={flip.repeatableNetProfit === null ? "Unavailable" : formatGp(flip.repeatableNetProfit)} tone="profit" />
        <Metric label="Conservative GP/hr (estimate)" value={flip.conservativeExpectedGpPerHour === null ? "Unavailable" : formatGp(flip.conservativeExpectedGpPerHour)} tone="profit" />
        <Metric label="Positive after-tax hours" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatPercent(flip.marketAnalysis.positiveSpreadRatio) : "Unavailable"} />
        <Metric label="Buy limit" value={flip.buyLimit ? formatNumber(flip.buyLimit) : "Unknown"} />
        <Metric label="Current buy-limit profit (estimate)" value={formatGp(flip.totalBuyLimitProfit)} tone="profit" />
        <Metric label="Historical confidence" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatPercent(flip.confidence) : "Unavailable"} />
        <Metric label="Historical matched vol/hr" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatNumber(flip.marketAnalysis.medianMatchedHourlyVolume) : "Unavailable"} />
        <Metric label="Estimated units/hr" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatNumber(flip.marketAnalysis.estimatedExecutableUnitsPerHour) : "Unavailable"} />
        <Metric label="Quote-pair age (older side)" value={formatAge(flip.quoteHealth.pairAgeSeconds)} />
        <Metric label="Quote timestamp skew" value={formatAge(flip.quoteHealth.skewSeconds)} />
        <Metric label="Historical stability" value={flip.marketAnalysis && flip.marketAnalysis.sampleCount > 0 ? formatPercent(flip.stability) : "Unavailable"} />
      </div>
      <p className="research-note">
        The seven-day median resists isolated margin spikes. Repeatable profit uses the lower of the current net margin and that median. Estimated GP/hour assumes 1% of median matched hourly volume and is capped by a known four-hour buy limit. Quote age uses the older side of the pair. These are conservative estimates, not observed fills or guaranteed profit.
      </p>
    </>
  );
}

function UpsideDetails({ flip }: { flip: UpsideFlipCandidate }) {
  const analysis = flip.upsideAnalysis;
  return (
    <>
      <div className="score-summary upside-summary">
        <span>Risk-adjusted GP/hour estimate</span>
        <strong>{formatGp(analysis.riskAdjustedGpPerHour)}</strong>
        <small>{formatPercent(analysis.opportunityConfidence)} opportunity confidence</small>
      </div>
      <div className="metric-grid compact">
        <Metric label="Current net profit (observed)" value={formatGp(flip.netProfit)} tone="profit" />
        <Metric label="Capturable net margin (estimate)" value={formatGp(analysis.capturableNetMargin)} tone="profit" />
        <Metric label="24h net-margin P90" value={formatGp(analysis.netMarginP90)} />
        <Metric label="Base GP/hr (estimate)" value={formatGp(analysis.baseEstimatedGpPerHour)} tone="profit" />
        <Metric label="Estimated units/hr" value={formatNumber(analysis.estimatedUnitsPerHour)} />
        <Metric label="P25 matched volume/hr" value={formatNumber(analysis.matchedVolumeP25PerHour)} />
        <Metric label="4h positive-spread samples" value={formatPercent(analysis.recentPositiveSpreadRatio)} />
        <Metric label="24h positive-spread samples" value={formatPercent(analysis.dailyPositiveSpreadRatio)} />
        <Metric label="4h sample coverage" value={formatPercent(analysis.recentSampleCoverage)} />
        <Metric label="24h sample coverage" value={formatPercent(analysis.dailySampleCoverage)} />
        <Metric label="4h matched volume" value={formatNumber(analysis.recentMatchedVolume)} />
        <Metric label="Midpoint volatility" value={formatPercent(analysis.midpointPriceVolatility)} />
        <Metric label="Quote-pair age (older side)" value={formatAge(flip.quoteHealth.pairAgeSeconds)} />
        <Metric label="Quote timestamp skew" value={formatAge(flip.quoteHealth.skewSeconds)} />
        <Metric label="Buy limit" value={formatNumber(flip.buyLimit)} />
        <Metric label="Current ROI (observed)" value={formatPercent(flip.roi)} />
      </div>
      <p className="research-note">
        The current margin is capped at its recent 90th percentile before scoring. Estimated units use 1% of the lower-quartile rolling matched volume and the four-hour buy limit. Opportunity confidence combines recent two-sided spread consistency, sample coverage, paired-quote freshness, and midpoint stability. Public trades cannot prove that your offers will fill.
      </p>
    </>
  );
}

function buildQuery(view: FlipView, filters: Filters): string {
  const params = new URLSearchParams({ view });
  const commonKeys: Array<keyof Filters> = ["search", "minProfit", "minRoi", "minVolume", "maxPrice", "members"];
  const viewKeys: Array<keyof Filters> = view === "reliable"
    ? ["minConfidence", "minStability", "minTotalBuyLimitProfit", "includeStale", "includeLowConfidence"]
    : ["minExpectedGpPerHour", "minOpportunityConfidence"];

  for (const key of [...commonKeys, ...viewKeys]) {
    const value = filters[key];
    if (typeof value === "boolean") {
      if (!value) params.set(key, "false");
    } else if (value && !(key === "members" && value === "all")) {
      params.set(key, value);
    }
  }
  params.set("sort", filters.sort);
  return params.toString();
}

function chartColors(theme: Theme) {
  if (theme === "dark") {
    return { grid: "#3b3a2d", axis: "#aaa18b", tooltip: "#1c1e17", high: "#91bd78", low: "#d4af55" };
  }
  if (theme === "midnight") {
    return { grid: "#263746", axis: "#9aafc2", tooltip: "#18232e", high: "#72b99b", low: "#8fa7bb" };
  }
  if (theme === "abyssal") {
    return { grid: "#473354", axis: "#b7a5c5", tooltip: "#18101f", high: "#82c49a", low: "#b77ae6" };
  }
  if (theme === "blood") {
    return { grid: "#4d2e31", axis: "#bea59d", tooltip: "#1e1112", high: "#8dbc78", low: "#d45a60" };
  }
  return { grid: "#e1ddd0", axis: "#756f5f", tooltip: "#fffdf8", high: "#287255", low: "#3e745a" };
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

function flipFilterSort(key: FlipSortKey, view: FlipView): Filters["sort"] | undefined {
  if (view === "upside") {
    switch (key) {
      case "riskAdjustedGpPerHour": return "riskAdjustedGpPerHour";
      case "opportunityConfidence": return "confidence";
      case "capturableNetMargin": return "capturableProfit";
      case "netProfit": return "profit";
      case "roi": return "roi";
      case "volume": return "volume";
      case "freshnessSeconds": return "freshness";
      default: return undefined;
    }
  }

  switch (key) {
    case "score":
    case "confidence":
    case "stability":
    case "totalBuyLimitProfit":
    case "roi":
    case "volume": return key;
    case "historicalNetMarginMedian": return "typicalProfit";
    case "conservativeExpectedGpPerHour": return "expectedGpPerHour";
    case "netProfit": return "profit";
    case "freshnessSeconds": return "freshness";
    default: return undefined;
  }
}

function flipSortValue(flip: RankedFlipCandidate, key: FlipSortKey): number | string | null | undefined {
  switch (key) {
    case "name": return flip.name;
    case "buyPrice": return flip.buyPrice;
    case "sellPrice": return flip.sellPrice;
    case "margin": return flip.margin;
    case "tax": return flip.tax;
    case "netProfit": return flip.netProfit;
    case "roi": return flip.roi;
    case "volume": return flip.volume;
    case "freshnessSeconds": return flip.freshnessSeconds;
    case "quoteSkewSeconds": return flip.quoteHealth.skewSeconds;
    case "buyLimit": return flip.buyLimit;
    case "historicalNetMarginMedian": return flip.view === "reliable" && flip.marketAnalysis?.sampleCount ? flip.marketAnalysis.historicalNetMarginMedian : null;
    case "conservativeExpectedGpPerHour": return flip.view === "reliable" ? flip.conservativeExpectedGpPerHour : null;
    case "score": return flip.view === "reliable" ? flip.score : null;
    case "confidence": return flip.view === "reliable" ? flip.confidence : null;
    case "stability": return flip.view === "reliable" ? flip.stability : null;
    case "totalBuyLimitProfit": return flip.view === "reliable" && flip.buyLimit ? flip.totalBuyLimitProfit : null;
    case "capturableNetMargin": return flip.view === "upside" ? flip.upsideAnalysis.capturableNetMargin : null;
    case "riskAdjustedGpPerHour": return flip.view === "upside" ? flip.upsideAnalysis.riskAdjustedGpPerHour : null;
    case "opportunityConfidence": return flip.view === "upside" ? flip.upsideAnalysis.opportunityConfidence : null;
    case "estimatedUnitsPerHour": return flip.view === "upside" ? flip.upsideAnalysis.estimatedUnitsPerHour : null;
  }
}
