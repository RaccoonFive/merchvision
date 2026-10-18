"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { Metric } from "@/components/Metric";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { BANK_MAX_BYTES, BANK_PERIODS, bankGpMovement, parseBankImport, sumBankValues, valueBank,
  type BankPeriod, type BankRow, type BankSnapshot, type BankTrend } from "@/lib/bank";
import { clearBank, loadBank, saveBank } from "@/lib/clientBank";
import { formatGp, formatNumber, formatPercent, formatTimestamp } from "@/lib/format";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";
import { useBankAnalysis } from "@/lib/useBankAnalysis";

type SortKey = "name" | "quantity" | "unitPrice" | "grossValue" | "7" | "30" | "90" | "movement" | "volume";
const DIRECTIONS = { rising: "Rising", falling: "Falling", flat: "Flat", mixed: "Mixed" };

function TrendCell({ trend, status }: { trend?: BankTrend; status?: string }) {
  const label = !trend ? "Pending" : trend.status === "stale" ? "Stale history" : trend.status === "insufficient" ? "Insufficient history" : trend.direction ? DIRECTIONS[trend.direction] : "Unavailable";
  if (status) return <td className="muted">{status}</td>;
  return <td className={`bank-trend bank-${trend?.direction ?? "unknown"}`}>
    <span>{label}</span>
    {trend?.change !== null && trend?.change !== undefined ? <strong>{trend.change > 0 ? "+" : ""}{formatPercent(trend.change)}</strong> : null}
    {trend?.consistency !== null && trend?.consistency !== undefined ? <small>{formatPercent(trend.consistency)} daily agreement</small> : null}
    {trend ? <small>{trend.sampleCount} samples · {formatPercent(trend.coverage)} coverage</small> : null}
  </td>;
}

export function BankOverviewPage() {
  const [snapshot, setSnapshot] = useState<BankSnapshot | null>(null);
  const [restored, setRestored] = useState(false);
  const [editing, setEditing] = useState(true);
  const [text, setText] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState(false);
  const fileGeneration = useRef(0);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<BankPeriod>(7);
  const [direction, setDirection] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "grossValue", direction: "desc" });
  const [now, setNow] = useState(0);
  const analysis = useBankAnalysis(snapshot);

  useEffect(() => {
    const saved = loadBank();
    setSnapshot(saved.snapshot);
    setEditing(!saved.snapshot);
    setStorageWarning(saved.warning);
    setRestored(true);
    setNow(Date.now() / 1000);
    const timer = window.setInterval(() => setNow(Date.now() / 1000), 60_000);
    return () => { window.clearInterval(timer); fileGeneration.current++; };
  }, []);

  const rows = useMemo(() => valueBank(snapshot?.holdings ?? [], analysis.market?.data ?? [], now), [snapshot, analysis.market, now]);
  const eligible = rows.filter((row) => row.item && row.itemId !== 995).length;
  const finished = Object.keys(analysis.trends).length;
  const failed = Object.values(analysis.trends).filter((item) => item.status === "failed").length;
  const unavailable = rows.filter((row) => row.grossValue === null || row.netValue === null).length;
  const gross = sumBankValues(rows, "grossValue");
  const net = sumBankValues(rows, "netValue");
  const selectedTrend = (row: BankRow) => analysis.trends[row.itemId]?.periods?.[period];
  const filtered = rows.filter((row) => {
    if (!`${row.name} ${row.itemId}`.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (direction === "all") return true;
    const trend = selectedTrend(row);
    return direction === "unavailable" ? row.itemId !== 995 && (!trend || trend.status !== "available") : trend?.direction === direction;
  });
  const sorted = sortTableRows(filtered, (row) => {
    if (sort.key === "movement") return bankGpMovement(selectedTrend(row), row.quantity);
    if (sort.key === "volume") return row.matchedVolume;
    if (sort.key === "7" || sort.key === "30" || sort.key === "90") return analysis.trends[row.itemId]?.periods?.[Number(sort.key) as BankPeriod]?.change;
    return row[sort.key];
  }, sort.direction);

  function importText(raw: string) {
    const result = parseBankImport(raw);
    if ("error" in result) { setImportError(result.error); return; }
    analysis.stop();
    setStorageWarning(saveBank(result.snapshot) ? null : "Bank not saved in this browser. It remains available for this visit; browser storage may be blocked or full.");
    setSnapshot(result.snapshot);
    setImportError(null);
    setImportNotice(result.ignored ? `${result.ignored} zero-quantity placeholders ignored.` : null);
    setEditing(false);
    setText("");
    setSearch("");
    setDirection("all");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    fileGeneration.current++;
    setFileLoading(false);
    importText(text);
  }

  async function upload(file: File) {
    const generation = ++fileGeneration.current;
    setImportError(null);
    if (file.size > BANK_MAX_BYTES) { setImportError("Import exceeds the 2 MiB limit."); return; }
    if (!/\.(txt|tsv)$/i.test(file.name)) { setImportError("Choose a .txt or .tsv export."); return; }
    setFileLoading(true);
    try {
      const raw = await file.text();
      if (generation === fileGeneration.current) importText(raw);
    } catch {
      if (generation === fileGeneration.current) setImportError("Unable to read this file. Paste the export instead.");
    } finally {
      if (generation === fileGeneration.current) setFileLoading(false);
    }
  }

  function clear() {
    fileGeneration.current++;
    analysis.stop();
    setStorageWarning(clearBank() ? null : "The saved bank could not be removed from browser storage. Clear site data before using a shared browser.");
    setSnapshot(null);
    setEditing(true);
    setText("");
    setImportError(null);
    setImportNotice(null);
    setFileLoading(false);
  }

  const header = (key: SortKey, label: string) => <SortableTableHeader key={key} label={label} active={sort.key === key} direction={sort.direction} onSort={() => setSort({ key, direction: sort.key === key && sort.direction === "asc" ? "desc" : "asc" })} />;

  return <AppShell activePath="/bank" title="Bank Overview">
    {() => <section className="bank-page" aria-label="Bank overview">
      {snapshot ? <div className="bank-toolbar">
        <p className="bank-import-meta">Imported {formatTimestamp(Date.parse(snapshot.importedAt) / 1000)} · {formatNumber(rows.length)} holdings</p>
        <div className="bank-actions">
          <button className="secondary-btn" type="button" onClick={() => { setEditing(true); setImportError(null); }}>Replace import</button>
          <button className="secondary-btn" type="button" onClick={clear}>Clear bank</button>
          <button className="secondary-btn" type="button" disabled={analysis.marketLoading} onClick={analysis.refresh}>{analysis.marketLoading ? "Refreshing data…" : "Refresh data"}</button>
        </div>
      </div> : null}
      {storageWarning ? <p className="data-health-banner" role="alert">{storageWarning}</p> : null}
      {importNotice ? <p role="status">{importNotice}</p> : null}
      {!restored ? <p role="status">Loading saved bank…</p> : editing ? <form className="bank-import" onSubmit={submit}>
        <div className="bank-section-heading"><h2>{snapshot ? "Replace bank import" : "Import your bank"}</h2>
          {snapshot ? <button className="secondary-btn" type="button" onClick={() => { fileGeneration.current++; setFileLoading(false); setEditing(false); }}>Cancel replacement</button> : null}
        </div>
        <p id="bank-import-help">In Bank Memory, copy your bank export to the clipboard, then paste it below or choose its saved text file. A successful import replaces the bank saved in this browser.</p>
        <label htmlFor="bank-export">Bank Memory export</label>
        <textarea aria-describedby="bank-import-help" aria-invalid={!!importError} id="bank-export" onChange={(event) => setText(event.target.value)} placeholder={"Item id\tItem name\tItem quantity"} rows={5} value={text} />
        <div className="bank-actions">
          <button className="primary-btn" disabled={!text.trim() || fileLoading} type="submit">Import bank</button>
          <label className="bank-file-label" htmlFor="bank-file">Or upload .txt / .tsv (2 MiB maximum)</label>
          <input accept=".txt,.tsv,text/plain,text/tab-separated-values" disabled={fileLoading} id="bank-file" onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void upload(file); }} type="file" />
        </div>
        {fileLoading ? <p role="status">Reading export…</p> : null}
        {importError ? <p className="error" role="alert">{importError}</p> : null}
        <small>Bank contents are saved only in this browser. Market requests send item IDs; quantities and imported names stay here.</small>
      </form> : null}

      {snapshot ? <>
        <div className="bank-metrics">
          <Metric label="Estimated instant-sell value · before tax" value={gross === null ? "Unavailable" : formatGp(gross)} detail={unavailable ? `Partial · ${unavailable} holdings unvalued` : "Includes coins at face value"} emphasis="primary" accent="gold" />
          <Metric label="Estimated after-tax proceeds" value={net === null ? "Unavailable" : formatGp(net)} detail={unavailable ? "Partial · priced holdings and coins only" : "Prospective GE tax; actual proceeds may differ"} />
          <Metric label="Holdings with usable values" value={`${rows.length - unavailable} / ${rows.length}`} detail={`${rows.filter((row) => row.stale).length} stale or undated quotes`} />
        </div>
        {analysis.marketError ? <p className="data-health-banner error-banner" role="alert">{analysis.marketError} <button className="secondary-btn" onClick={analysis.refresh} type="button">Retry market data</button></p> : null}
        {analysis.marketLoading ? <p role="status">Loading current market data. Imported holdings remain visible.</p> : null}

        <div className="bank-analysis-status">
          <div aria-live="polite" role="status">{analysis.market ? `Trends ${analysis.paused ? "paused" : finished < eligible ? "loading" : "complete"}: ${finished} / ${eligible} supported items processed${failed ? ` · ${failed} failed` : ""}.` : "Waiting for market data to identify supported items."}</div>
          <div className="bank-actions">
            {analysis.market && finished < eligible ? <button className="secondary-btn" type="button" onClick={analysis.paused ? analysis.resume : analysis.stop}>{analysis.paused ? "Resume analysis" : "Stop analysis"}</button> : null}
            {failed ? <button className="secondary-btn" type="button" onClick={analysis.retryFailed}>Retry failed items</button> : null}
          </div>
          {eligible && finished < eligible ? <progress aria-label="Bank trend analysis progress" max={eligible} value={finished} /> : null}
        </div>
        <div className="bank-filters">
          <div className="field"><label htmlFor="bank-search">Search bank</label><input id="bank-search" onChange={(event) => setSearch(event.target.value)} placeholder="Item name or ID" type="search" value={search} /></div>
          <div className="field"><label htmlFor="bank-period">Trend period</label><select id="bank-period" onChange={(event) => setPeriod(Number(event.target.value) as BankPeriod)} value={period}>{BANK_PERIODS.map((days) => <option key={days} value={days}>{days} days</option>)}</select></div>
          <div className="field"><label htmlFor="bank-direction">Trend direction</label><select id="bank-direction" onChange={(event) => setDirection(event.target.value)} value={direction}><option value="all">All directions</option>{Object.entries(DIRECTIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}<option value="unavailable">Pending or unavailable</option></select></div>
          <p>{sorted.length} / {rows.length} holdings shown</p>
        </div>
        <StickyTable><table className="bank-table">
          <caption className="bank-sr-only">Bank holdings, estimated instant-sell values, and historical midpoint trends</caption>
          <thead><tr>{header("name", "Item")}{header("quantity", "Quantity")}{header("unitPrice", "Instant-sell / unit")}{header("grossValue", "Holding value")}{BANK_PERIODS.map((days) => header(String(days) as SortKey, `${days}d trend`))}{header("movement", `${period}d fitted GP movement`)}{header("volume", "24h matched volume")}<th>Data quality</th></tr></thead>
          <tbody>{sorted.map((row) => {
            const itemTrends = analysis.trends[row.itemId];
            const status = row.itemId === 995 ? "Not applicable" : !analysis.market ? "Waiting for market" : !row.item ? "No GE mapping" : itemTrends?.status === "failed" ? "History request failed" : itemTrends?.status === "unsupported" ? "Unsupported" : undefined;
            const movement = bankGpMovement(selectedTrend(row), row.quantity);
            return <tr key={row.itemId}>
              <td><div className="item-cell"><ItemIcon className="item-icon" icon={row.item?.icon} /><div>{row.item && row.itemId !== 995 ? <Link className="item-lookup-link" href={`/lookup/${row.itemId}`}>{row.name}</Link> : <strong>{row.name}</strong>}<small>#{row.itemId}</small></div></div></td>
              <td>{formatNumber(row.quantity)}</td><td>{row.unitPrice === null ? "Unavailable" : formatGp(row.unitPrice)}</td><td><strong>{row.grossValue === null ? "Unavailable" : formatGp(row.grossValue)}</strong></td>
              {BANK_PERIODS.map((days) => <TrendCell key={days} status={status} trend={itemTrends?.periods?.[days]} />)}
              <td className={movement === null ? "muted" : movement > 0 ? "positive" : movement < 0 ? "negative" : ""}>{movement === null ? "Unavailable" : `${movement > 0 ? "+" : ""}${formatGp(movement)}`}</td>
              <td>{row.itemId === 995 ? "Not applicable" : row.matchedVolume === null ? "Unavailable" : formatNumber(row.matchedVolume)}</td>
              <td className="bank-quality">{row.itemId === 995 ? "Coins · face value" : !analysis.market ? "Waiting for market data" : row.warnings.length ? row.warnings.join(" · ") : "Current quote"}{row.quoteTime ? <small>Quote: {formatTimestamp(row.quoteTime)}</small> : null}</td>
            </tr>;
          })}</tbody>
        </table></StickyTable>
        {!sorted.length ? <p role="status">No holdings match these filters.</p> : null}
        <p className="bank-notes">Trends fit daily market midpoints across each period; instant-sell values use the latest low quote. Daily agreement measures how often consecutive available daily prices support the fitted direction. Flat means within ±1%; larger moves need at least 60% agreement to be labeled Rising or Falling. Gaps reduce coverage.</p>
        <p className="bank-notes">Fitted GP movement estimates the historical change for your current quantity. It is not purchase profit or a forecast. Sparse or stale histories are unavailable; actual sale prices and executable volumes may differ. Coins have no market trend.</p>
      </> : null}
    </section>}
  </AppShell>;
}
