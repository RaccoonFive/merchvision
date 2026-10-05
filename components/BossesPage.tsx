"use client";

import { ExternalLink, RefreshCw, Search, Skull, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { BOSS_CATEGORIES, BOSSES, filterBosses } from "@/lib/bossCatalog";
import { loadBossDrops } from "@/lib/clientBossDrops";
import { formatAge, formatGp, formatTimestamp } from "@/lib/format";
import type { BossCategory, BossDefinition, BossDrop, BossDropsResponse } from "@/lib/bossTypes";

function WikiImage({ src, className }: { src: string | null; className: string }) {
  const [failed, setFailed] = useState(false);
  return src && !failed
    ? <img alt="" className={className} decoding="async" loading="lazy" onError={() => setFailed(true)} src={src} />
    : <span aria-hidden="true" className={`${className} boss-image-fallback`}><Skull size={28} /></span>;
}

export function BossesPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<BossCategory | "All">("All");
  const [selectedBoss, setSelectedBoss] = useState<BossDefinition | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const visibleBosses = useMemo(() => filterBosses(query, category), [query, category]);

  function closeDialog() {
    setSelectedBoss(null);
    triggerRef.current?.focus();
  }

  return (
    <AppShell activePath="/bosses" title="Bosses">
      {() => (
        <section className="boss-dashboard" aria-label="Boss loot dashboard">
          <div className="boss-toolbar">
            <label className="boss-search">
              <Search aria-hidden="true" size={17} />
              <span className="sr-only">Search bosses</span>
              <input onChange={(event) => setQuery(event.target.value)} placeholder="Search bosses or encounters…" type="search" value={query} />
            </label>
            <label className="boss-category-field">
              <span className="sr-only">Boss category</span>
              <select onChange={(event) => setCategory(event.target.value as BossCategory | "All")} value={category}>
                <option value="All">All categories</option>
                {BOSS_CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <span aria-live="polite" className="boss-result-count">{visibleBosses.length} of {BOSSES.length} encounters</span>
          </div>

          {visibleBosses.length ? (
            <div className="boss-grid">
              {visibleBosses.map((boss) => (
                <button aria-haspopup="dialog" className="boss-card" key={boss.slug} onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setSelectedBoss(boss);
                }} type="button">
                  <span className="boss-card-category">{boss.category}</span>
                  <WikiImage className="boss-card-image" src={boss.image} />
                  <strong>{boss.name}</strong>
                </button>
              ))}
            </div>
          ) : (
            <div className="boss-empty" role="status">
              <Skull aria-hidden="true" size={30} />
              <p>No bosses match your search.</p>
              <button className="secondary-btn" onClick={() => { setQuery(""); setCategory("All"); }} type="button">Clear filters</button>
            </div>
          )}
          {selectedBoss ? <BossDropsDialog boss={selectedBoss} key={selectedBoss.slug} onClose={closeDialog} /> : null}
        </section>
      )}
    </AppShell>
  );
}

function BossDropsDialog({ boss, onClose }: { boss: BossDefinition; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [payload, setPayload] = useState<BossDropsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const groups = useMemo(() => {
    const grouped = new Map<string, BossDrop[]>();
    for (const drop of payload?.data ?? []) grouped.set(drop.group, [...(grouped.get(drop.group) ?? []), drop]);
    return [...grouped];
  }, [payload]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    closeRef.current?.focus();
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    loadBossDrops(boss.slug, attempt > 0)
      .then((response) => { if (alive) setPayload(response); })
      .catch(() => { if (alive) setError("Unable to load boss drops. Please try again."); })
      .finally(() => { if (alive) setLoading(false); });
    // Closing or switching dialogs may leave a shared request running, but it
    // must never write a previous boss's response into the current dialog.
    return () => { alive = false; };
  }, [boss.slug, attempt]);

  function close() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog aria-labelledby="boss-dialog-title" className="boss-dialog" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => {
      if (event.target === event.currentTarget) close();
    }} ref={dialogRef}>
      <div className="boss-dialog-content">
        <header className="boss-dialog-head">
          <WikiImage className="boss-dialog-image" src={boss.image} />
          <div>
            <span className="boss-card-category">{boss.category}</span>
            <h2 id="boss-dialog-title">{boss.name}</h2>
            <p className="boss-encounters">{boss.encounters.join(" · ")}</p>
          </div>
          <button aria-label="Close boss drops" className="detail-panel-close" onClick={close} ref={closeRef} type="button"><X size={19} /></button>
        </header>

        {loading && !payload ? <div className="boss-loading"><LoadingSpinner label="Loading drop table…" /></div> : null}
        {error ? <div className="boss-message" role="alert"><p>{error}</p><button className="secondary-btn" disabled={loading} onClick={() => setAttempt((value) => value + 1)} type="button">Try again</button></div> : null}
        {payload ? (
          <>
            <div className="boss-loot-toolbar">
              <div><strong>{payload.data.length} drop entries</strong><p>Observed instant-sell GP per unit, before GE tax.</p></div>
              <button className="secondary-btn" disabled={loading} onClick={() => setAttempt((value) => value + 1)} type="button">
                <RefreshCw aria-hidden="true" className={loading ? "spin" : undefined} size={14} />{loading ? "Refreshing…" : "Refresh prices"}
              </button>
            </div>
            {payload.meta.lootPartial || payload.meta.pricesPartial ? <p className="boss-partial" role="status">
              {payload.meta.lootPartial ? "Some drop data could not be extracted. Check the Wiki sources for the complete rewards and conditions. " : ""}
              {payload.meta.pricesPartial ? "Some GE prices are unavailable or could not be matched." : ""}
            </p> : null}
            {payload.meta.notes.length ? <details className="boss-source-notes"><summary>Reward conditions and source notes</summary>{payload.meta.notes.map((note, index) => <p key={index}>{note}</p>)}</details> : null}
            {!payload.data.length ? <p role="status">No drop entries are available.</p> : null}
            {groups.map(([group, drops]) => (
              <div className="boss-drop-group" key={group}>
                <div aria-label={`${group} drop table`} className="boss-table-scroll" role="region" tabIndex={0}>
                  <table className="boss-drop-table">
                    <caption>{group}</caption>
                    <thead><tr><th scope="col">Item</th><th scope="col">Quantity</th><th scope="col">Rate</th><th scope="col">Instant-sell / unit</th></tr></thead>
                    <tbody>{drops.map((drop, index) => <BossDropRow drop={drop} key={index} />)}</tbody>
                  </table>
                </div>
              </div>
            ))}
            <footer className="boss-source-footer">
              <span>Loot fetched {formatTimestamp(Math.floor(new Date(payload.meta.fetchedAt).getTime() / 1000))}</span>
              {payload.meta.sources.map((source) => <a href={source.url} key={source.page} rel="noreferrer" target="_blank">{source.page} <ExternalLink aria-hidden="true" size={12} /></a>)}
            </footer>
          </>
        ) : null}
      </div>
    </dialog>
  );
}

function BossDropRow({ drop }: { drop: BossDrop }) {
  const age = drop.instantSellTime ? Math.max(0, Math.floor(Date.now() / 1000) - drop.instantSellTime) : null;
  return (
    <tr>
      <td><div className="boss-drop-item"><WikiImage className="boss-drop-icon" src={drop.icon} />
        {drop.itemId && drop.geStatus !== "not-sold" ? <Link href={`/lookup/${drop.itemId}`}>{drop.name}</Link> : <a href={drop.wikiUrl} rel="noreferrer" target="_blank">{drop.name}</a>}
      </div>{drop.notes.length ? <details className="boss-drop-notes"><summary>Conditions</summary>{drop.notes.map((note, index) => <p key={index}>{note}</p>)}</details> : null}</td>
      <td>{drop.quantity}</td><td>{drop.rarity}</td>
      <td>{drop.geStatus === "available" && drop.instantSellPrice !== null ? <>
        <strong>{formatGp(drop.instantSellPrice)}</strong>
        <small className={age !== null && age > 3600 ? "boss-stale" : undefined}>{age === null ? "Quote age unavailable" : `${age > 3600 ? "Stale · " : ""}${formatAge(age)} ago`}</small>
      </> : <span className="boss-price-unavailable">{drop.geStatus === "not-sold" ? "Not sold on GE" : drop.geStatus === "unmatched" ? "Item not matched" : "Price unavailable"}</span>}</td>
    </tr>
  );
}
