"use client";

import { FlaskConical, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ItemIcon } from "@/components/ItemIcon";
import { DEFAULT_PRAYER_LEVEL, loadPrayerLevel, savePrayerLevel } from "@/lib/clientPrayerLevel";
import { formatAge, formatClock, formatGp, formatPercent, formatTimestamp } from "@/lib/format";
import { comparePrayerPotions, isPrayerLevel, type PrayerPotionResponse } from "@/lib/prayerPotions";

export function PrayerPotionsPage() {
  const [level, setLevel] = useState(DEFAULT_PRAYER_LEVEL);
  const [payload, setPayload] = useState<PrayerPotionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const validLevel = isPrayerLevel(Number(level));

  useEffect(() => {
    setLevel(loadPrayerLevel());
  }, []);

  useEffect(() => {
    setNow(Date.now() / 1000);
    const timer = window.setInterval(() => setNow(Date.now() / 1000), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setLoading(true);
    setError(null);
    async function loadPrices() {
      try {
        const response = await fetch("/api/prayer-potions", { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load potion prices. Please try again.");
        const result: PrayerPotionResponse = await response.json();
        if (alive) {
          setPayload(result);
          setNow(Date.now() / 1000);
        }
      } catch {
        if (alive) setError("Unable to load potion prices. Please try again.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void loadPrices();
    return () => { alive = false; controller.abort(); };
  }, [attempt]);

  return (
    <AppShell activePath="/prayer-potions" title="Prayer Potions">
      {() => (
        <section className="prayer-page" aria-label="Prayer potion comparison">
          <div className="prayer-controls">
            <div className="field">
              <label htmlFor="prayer-level">Your base Prayer level</label>
              <input aria-describedby="prayer-level-help" aria-invalid={!validLevel} id="prayer-level" inputMode="numeric" max={99} min={1} onChange={(event) => {
                setLevel(event.target.value);
                savePrayerLevel(event.target.value);
              }} step={1} type="number" value={level} />
              <small className={validLevel ? "" : "error"} id="prayer-level-help">Enter a whole level from 1 to 99.</small>
            </div>
            <p>Compare the Prayer restored by four doses for every GP spent.</p>
            <button className="secondary-btn" disabled={loading} onClick={() => setAttempt((current) => current + 1)} type="button">
              <RefreshCw aria-hidden="true" size={15} /> {loading ? "Loading prices…" : "Refresh prices"}
            </button>
          </div>

          {error ? <p className="data-health-banner error-banner" role="alert">{error}{payload ? " Showing previous prices." : ""}</p> : null}
          {loading && !payload ? <LoadingSpinner label="Loading potion prices…" /> : null}
          {payload && now !== null ? <PrayerPotionComparison level={Number(level)} now={now} payload={payload} /> : null}
          <p className="prayer-notes">
            Uses the latest observed instant-buy prices from the OSRS Wiki. Actual purchase prices may differ.
            Standard restoration assumes no holy wrench or equipment bonus, and enough missing Prayer to use each dose fully. Each dose is capped at your base level.
            Super restores also restore drained stats; that benefit is outside this Prayer-only comparison. GE tax is paid by sellers and is not added to the purchase cost.
          </p>
        </section>
      )}
    </AppShell>
  );
}

export function PrayerPotionComparison({ level, payload, now }: { level: number; payload: PrayerPotionResponse; now: number }) {
  const comparison = comparePrayerPotions(level, payload.data, now);
  if (!comparison) return <p role="status">Enter a valid Prayer level to compare value.</p>;
  const winner = comparison.potions.find(({ id }) => id === comparison.winnerId);
  const incomplete = comparison.potions.some(({ price }) => price === null);
  const stale = comparison.potions.some(({ stale }) => stale);

  return (
    <>
      <div className="prayer-verdict" aria-live="polite" role="status">
        <FlaskConical aria-hidden="true" size={24} />
        <div>
          <strong>{incomplete ? "Comparison unavailable" : comparison.tied ? "Both potions offer equal value" : `${winner?.name} gives more Prayer per GP`}</strong>
          <p>{incomplete ? "Both potions need an instant-buy quote to choose the better value." : comparison.tied ? `The cost per Prayer point is equal at level ${level}.` : `${formatPercent(comparison.savingsFraction!)} lower cost per Prayer point at level ${level}, based on the displayed quotes.`}</p>
        </div>
      </div>
      {stale ? <p className="data-health-banner" role="status">Some quotes are over one hour old or have no trade timestamp. Check the market before buying.</p> : null}
      <div className="prayer-card-grid">
        {comparison.potions.map((potion) => (
          <article className={`prayer-card${potion.id === comparison.winnerId ? " prayer-card-best" : ""}`} key={potion.id}>
            <div className="prayer-card-head">
              <div className="prayer-card-title">
                <ItemIcon className="prayer-potion-icon" icon={potion.icon} />
                <h2><Link href={`/lookup/${potion.id}`}>{potion.name}</Link></h2>
              </div>
              {potion.id === comparison.winnerId ? <span className="prayer-value-badge">Better value</span> : null}
            </div>
            <div className="prayer-value">
              <strong>{potion.pointsPerGp === null ? "Unavailable" : potion.pointsPerGp.toFixed(5)}</strong>
              <span>Prayer points / GP</span>
            </div>
            <dl>
              <div><dt>GP / Prayer point</dt><dd>{potion.gpPerPoint === null ? "Unavailable" : potion.gpPerPoint.toFixed(2)}</dd></div>
              <div><dt>Instant-buy price (4 doses)</dt><dd>{potion.price === null ? "Unavailable" : formatGp(potion.price)}</dd></div>
              <div><dt>Prayer / dose</dt><dd>{potion.pointsPerDose}</dd></div>
              <div><dt>Prayer / full potion</dt><dd>{potion.pointsPerPotion}</dd></div>
              <div><dt>Quote age</dt><dd className={potion.stale ? "prayer-stale" : ""} title={formatTimestamp(potion.timestamp)}>{potion.ageSeconds === null ? "Unknown" : `${formatAge(Math.floor(potion.ageSeconds))}${potion.stale ? " · Stale" : ""}`}</dd></div>
            </dl>
            <p className="prayer-formula">Per dose: min(level, {potion.baseRestore} + floor(level / 4))</p>
            <a href={potion.wikiUrl} rel="noreferrer" target="_blank">Restoration formula on OSRS Wiki ↗</a>
          </article>
        ))}
      </div>
      <p className="prayer-updated">Prices retrieved at {formatClock(payload.meta.generatedAt)}. Quote ages reflect actual trades.</p>
    </>
  );
}
