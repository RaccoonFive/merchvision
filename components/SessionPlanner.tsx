"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { GroupedNumberInput } from "@/components/GroupedNumberInput";
import { ItemIcon } from "@/components/ItemIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { formatClock, formatGp, formatNumber, formatPercent } from "@/lib/format";
import { buildSessionPlan, CHECK_INTERVALS, SESSION_LENGTHS, validateSessionInputs, type SessionInputs, type SessionPlan } from "@/lib/sessionPlanner";
import type { FlipDataHealth } from "@/lib/flipFinder";
import type { FlipCandidate } from "@/lib/types";

type Market = { candidates: FlipCandidate[]; generatedAt: string; health: FlipDataHealth };

export function SessionPlanner() {
  const [budget, setBudget] = useState("");
  const [slots, setSlots] = useState(4);
  const [sessionMinutes, setSessionMinutes] = useState(60);
  const [checkIntervalMinutes, setCheckIntervalMinutes] = useState(15);
  const [members, setMembers] = useState<SessionInputs["members"]>("all");
  const [market, setMarket] = useState<Market | null>(null);
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [plannedAt, setPlannedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [nowSeconds, setNowSeconds] = useState(0);
  const request = useRef<AbortController | null>(null);

  const loadMarket = useCallback(async () => {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/flips?view=reliable&includeStale=false&includeLowConfidence=false", {
        signal: controller.signal, cache: "no-store"
      });
      const payload = await response.json();
      if (!response.ok || !Array.isArray(payload.data) || !payload.meta?.health || !Number.isFinite(Date.parse(payload.meta.generatedAt))) {
        throw new Error("Unavailable market data");
      }
      if (controller.signal.aborted) return;
      setMarket({ candidates: payload.data, generatedAt: payload.meta.generatedAt, health: payload.meta.health });
      setPlan(null);
      setPlannedAt(null);
      setNowSeconds(Math.floor(Date.now() / 1000));
    } catch {
      if (!controller.signal.aborted) setError("Unable to refresh market evidence. Try again before building a plan.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (request.current === controller) request.current = null;
    }
  }, []);

  useEffect(() => {
    void loadMarket();
    const timer = window.setInterval(() => setNowSeconds(Math.floor(Date.now() / 1000)), 30_000);
    return () => {
      window.clearInterval(timer);
      request.current?.abort();
      request.current = null;
    };
  }, [loadMarket]);

  const inputs: SessionInputs = { budget: Number(budget), slots, sessionMinutes, checkIntervalMinutes, members };
  const inputsChanged = plan && Object.entries(inputs).some(([key, value]) => plan.inputs[key as keyof SessionInputs] !== value);
  const evidenceExpired = market && nowSeconds - Date.parse(market.generatedAt) / 1000 > 300;
  const quotesExpired = plan?.allocations.some(({ candidate }) => nowSeconds - Math.min(candidate.lowTime, candidate.highTime) > 900);
  const outdated = Boolean(inputsChanged || evidenceExpired || quotesExpired || error);

  function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSessionInputs(inputs);
    setFormError(validation);
    const now = Math.floor(Date.now() / 1000);
    setNowSeconds(now);
    if (validation || !market || loading || error || now - Date.parse(market.generatedAt) / 1000 > 300) return;
    setPlan(buildSessionPlan(market.candidates, inputs, now));
    setPlannedAt(new Date().toISOString());
  }

  return (
    <AppShell activePath="/session-planner" title="Session Planner">
      {() => (
        <div className="session-planner">
          <div className="session-toolbar">
            <p className="subtitle">A conservative shortlist for your available GP and attention. Budget and plans stay in this page and disappear when you leave.</p>
            <button className="secondary-btn" disabled={loading} onClick={() => void loadMarket()} type="button">
              <RefreshCw size={16} /> {loading ? "Loading evidence…" : "Refresh evidence"}
            </button>
          </div>
          <form className="session-form" onSubmit={createPlan}>
            <div className="field">
              <label htmlFor="session-budget">Available budget (GP)</label>
              <GroupedNumberInput autoComplete="off" id="session-budget" onChange={setBudget} placeholder="e.g. 10m" required value={budget} aria-describedby={formError ? "session-form-error" : undefined} aria-invalid={Boolean(formError)} />
            </div>
            <div className="field">
              <label htmlFor="session-slots">Available GE slots</label>
              <select id="session-slots" value={slots} onChange={(event) => setSlots(Number(event.target.value))}>
                {Array.from({ length: 8 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="session-length">Session length</label>
              <select id="session-length" value={sessionMinutes} onChange={(event) => setSessionMinutes(Number(event.target.value))}>
                {SESSION_LENGTHS.map((minutes) => <option key={minutes} value={minutes}>{minutes < 60 ? `${minutes} minutes` : `${minutes / 60} hour${minutes > 60 ? "s" : ""}`}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="session-checks">Check offers every</label>
              <select id="session-checks" value={checkIntervalMinutes} onChange={(event) => setCheckIntervalMinutes(Number(event.target.value))}>
                {CHECK_INTERVALS.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutes</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="session-members">Account type</label>
              <select id="session-members" value={members} onChange={(event) => setMembers(event.target.value as SessionInputs["members"])}>
                <option value="all">Members</option><option value="f2p">Free-to-play</option>
              </select>
            </div>
            <button className="primary-btn" disabled={loading || !market || Boolean(error || evidenceExpired)} type="submit">Build plan</button>
            {formError ? <p className="form-error" id="session-form-error" role="alert">{formError}</p> : null}
          </form>
          <div aria-live="polite" className="session-status">
            {loading ? <LoadingSpinner label="Loading Reliable market evidence…" variant="inline" /> : null}
            {error ? <p className="error" role="alert">{error}{market ? " Previous evidence is retained for reference." : ""}</p> : null}
            {market ? <p>Evidence loaded {formatClock(market.generatedAt)} · {market.candidates.length} candidates · {evidenceExpired ? "Stale — refresh to plan" : "Quotes checked again when planning"}</p> : null}
            {market?.health.isPartial ? <p className="session-warning">Partial market evidence: {market.health.historySucceeded} of {market.health.historyRequested} histories loaded{!market.health.summaryAvailable ? "; daily summary unavailable" : ""}. The shortlist may omit opportunities.</p> : null}
          </div>
          {plan ? <SessionPlanResults plan={plan} outdated={outdated} plannedAt={plannedAt!} /> : !loading && market ? (
            <div className="session-empty">Enter your budget and build a plan to compare a single batch across suitable markets.</div>
          ) : null}
          <details className="session-assumptions">
            <summary>How quantities and estimates are calculated</summary>
            <ul>
              <li>Eligible Reliable items need paired quotes no older than 15 minutes, known buy limits, at least 50% history coverage, 60% confidence and stability, and 80% positive historical spreads. Selection follows Reliable score order.</li>
              <li>Keep at least 20% of the budget aside. Each item gets at most 25% of the budget, further capped by an equal share of the spendable budget across available slots. Unused capital is left unallocated.</li>
              <li>Quantity is capped by estimated hourly capacity × half the session length, the published buy limit, and the capital cap. Hourly capacity uses the existing 1% matched-volume assumption.</li>
              <li>Checking every 30 minutes halves estimated capacity; every 60 minutes quarters it. This fixed exposure haircut is a safety assumption, not evidence of fill speed.</li>
              <li>Batch profit uses quantity × the lower of the current and seven-day median after-tax margin. It assumes both legs fill; it includes no repeated cycles, price appreciation, or capital recycling.</li>
              <li>Available slots are a maximum number of item markets. Related items can move together; distinct items do not guarantee independent risk. Buy limits assume no prior usage and must be checked in game.</li>
            </ul>
          </details>
        </div>
      )}
    </AppShell>
  );
}

export function SessionPlanResults({ plan, outdated, plannedAt }: { plan: SessionPlan; outdated: boolean; plannedAt: string }) {
  return (
    <section aria-labelledby="session-results-title" className="session-results">
      <div className="session-results-head">
        <h2 id="session-results-title">Your session shortlist</h2>
        <span>{plan.allocations.length} / {plan.inputs.slots} markets · Built {formatClock(plannedAt)}</span>
      </div>
      {outdated ? <p className="session-warning" role="status">This plan is out of date. Refresh expired or failed market evidence, then rebuild with your current inputs before using these quantities.</p> : null}
      <div className="session-summary">
        <Metric label="Capital allocated" value={formatGp(plan.allocatedCapital)} detail={`${formatPercent(plan.allocatedCapital / plan.inputs.budget)} of budget`} />
        <Metric label="Capital left aside" value={formatGp(plan.unallocatedCapital)} detail={`Includes ${formatGp(plan.reserve)} minimum reserve`} />
        <Metric label="Batch profit scenario (estimate)" value={formatGp(plan.estimatedBatchProfit)} detail="After tax, if both legs fill" tone="profit" />
        <Metric label="Per-item capital cap" value={formatGp(plan.perItemCapitalCap)} detail={`${plan.eligibleCount} items passed evidence checks`} />
      </div>
      {plan.allocations.length ? (
        <div aria-label="Session allocation table" className="table-scroll" role="region" tabIndex={0}>
          <table className="session-table">
            <caption>One batch per item · {plan.inputs.sessionMinutes}-minute session · checking every {plan.inputs.checkIntervalMinutes} minutes</caption>
            <thead><tr><th scope="col">Item / evidence</th><th scope="col">Suggested qty</th><th scope="col">Capital</th><th scope="col">Net GP/unit</th><th scope="col">Batch GP (est.)</th><th scope="col">Quantity limited by</th></tr></thead>
            <tbody>{plan.allocations.map(({ candidate, quantity, capital, netProfitPerUnit, estimatedBatchProfit, limitingFactor }) => (
              <tr key={candidate.id}>
                <td><div className="session-item"><ItemIcon className="item-icon" icon={candidate.icon} /><div>
                  <Link href={`/lookup/${candidate.id}`}>{candidate.name}</Link>
                  <small>Reliable {candidate.score} · {formatPercent(candidate.confidence)} confidence</small>
                  {candidate.warnings.length ? <small className="session-warning">{candidate.warnings.join(" · ")}</small> : null}
                </div></div></td>
                <td>{formatNumber(quantity)}</td><td>{formatGp(capital)}</td><td>{formatGp(netProfitPerUnit)}</td><td className="profit">{formatGp(estimatedBatchProfit)}</td><td>{limitingFactor}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <p className="session-empty">No supported allocation fits these inputs. Capital stays unallocated. Markets may lack fresh evidence, affordable units, or enough estimated capacity for a whole unit.</p>}
      <p className="session-note">Observed low prices size the capital estimate; these are not prescribed offer prices. Quantities and profit are scenarios, not guaranteed fills or returns.</p>
    </section>
  );
}
