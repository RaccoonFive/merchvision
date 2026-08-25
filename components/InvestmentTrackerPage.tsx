"use client";

import { AlertTriangle, Check, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { ItemIcon } from "@/components/ItemIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { Metric } from "@/components/Metric";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { formatAge, formatClock, formatGp, formatNumber, formatPercent } from "@/lib/format";
import { searchItems } from "@/lib/itemSearch";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";
import type { InvestmentTrackerSummary, ItemMeta, TrackedInvestmentLot } from "@/lib/types";

type TrackerResponse = {
  data?: TrackedInvestmentLot[];
  meta?: InvestmentTrackerSummary;
  error?: string;
};

type ItemsResponse = {
  data?: ItemMeta[];
  error?: string;
};

type TrackerSortKey =
  | "name"
  | "quantity"
  | "unitPricePaid"
  | "totalCost"
  | "instantSellPrice"
  | "taxPerUnit"
  | "currentNetValue"
  | "currentProfit"
  | "roi"
  | "freshnessSeconds"
  | "createdAt";

const EMPTY_SUMMARY: InvestmentTrackerSummary = {
  lotCount: 0,
  totalCost: 0,
  valuedCost: 0,
  currentNetValue: 0,
  currentProfit: 0,
  roi: null,
  unavailableLotCount: 0,
  isPartial: false,
  generatedAt: ""
};

export function InvestmentTrackerPage() {
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [lots, setLots] = useState<TrackedInvestmentLot[]>([]);
  const [summary, setSummary] = useState<InvestmentTrackerSummary>(EMPTY_SUMMARY);
  const [query, setQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<ItemMeta | null>(null);
  const [quantity, setQuantity] = useState("");
  const [unitPricePaid, setUnitPricePaid] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuantity, setEditQuantity] = useState("");
  const [editUnitPricePaid, setEditUnitPricePaid] = useState("");
  const [mutatingId, setMutatingId] = useState<string | null>(null);
  const [tableSort, setTableSort] = useState<{ key: TrackerSortKey; direction: SortDirection }>({
    key: "createdAt",
    direction: "desc"
  });
  const suggestions = useMemo(
    () => selectedItem && query === selectedItem.name ? [] : searchItems(items, query),
    [items, query, selectedItem]
  );
  const sortedLots = useMemo(
    () => sortTableRows(lots, (lot) => trackerSortValue(lot, tableSort.key), tableSort.direction),
    [lots, tableSort]
  );

  const loadTracker = useCallback(async () => {
    const response = await fetch("/api/investment-tracker");
    const payload = (await response.json()) as TrackerResponse;
    if (!response.ok || payload.error || !payload.meta) {
      throw new Error(payload.error ?? "Unable to load investment tracker.");
    }
    setLots(payload.data ?? []);
    setSummary(payload.meta);
  }, []);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/items").then(async (response) => {
        const payload = (await response.json()) as ItemsResponse;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load item list.");
        return payload.data ?? [];
      }),
      loadTracker()
    ])
      .then(([nextItems]) => {
        if (alive) setItems(nextItems);
      })
      .catch((caught) => {
        if (alive) setError(caught instanceof Error ? caught.message : "Unable to load investment tracker.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [loadTracker]);

  async function refreshTracker() {
    setRefreshing(true);
    setError(null);
    try {
      await loadTracker();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to refresh investment tracker.");
    } finally {
      setRefreshing(false);
    }
  }

  function selectItem(item: ItemMeta) {
    setSelectedItem(item);
    setQuery(item.name);
    setFormError(null);
  }

  async function addLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = validFormInput(selectedItem, quantity, unitPricePaid);
    if (!input.ok) {
      setFormError(input.error);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      const response = await fetch("/api/investment-tracker", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data)
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to add investment lot.");
      setQuery("");
      setSelectedItem(null);
      setQuantity("");
      setUnitPricePaid("");
      await loadTracker();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to add investment lot.");
    } finally {
      setSaving(false);
    }
  }

  function startEditing(lot: TrackedInvestmentLot) {
    setEditingId(lot.id);
    setEditQuantity(String(lot.quantity));
    setEditUnitPricePaid(String(lot.unitPricePaid));
    setError(null);
  }

  async function saveEdit(lot: TrackedInvestmentLot) {
    const input = validEditableInput(editQuantity, editUnitPricePaid);
    if (!input.ok) {
      setError(input.error);
      return;
    }

    setMutatingId(lot.id);
    setError(null);
    try {
      const response = await fetch(`/api/investment-tracker/${encodeURIComponent(lot.id)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input.data)
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to update investment lot.");
      setEditingId(null);
      await loadTracker();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update investment lot.");
    } finally {
      setMutatingId(null);
    }
  }

  async function removeLot(lot: TrackedInvestmentLot) {
    const itemName = lot.item?.name ?? `item ${lot.itemId}`;
    if (!window.confirm(`Remove this ${itemName} lot? This cannot be undone.`)) return;

    setMutatingId(lot.id);
    setError(null);
    try {
      const response = await fetch(`/api/investment-tracker/${encodeURIComponent(lot.id)}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to remove investment lot.");
      if (editingId === lot.id) setEditingId(null);
      await loadTracker();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove investment lot.");
    } finally {
      setMutatingId(null);
    }
  }

  function toggleTableSort(key: TrackerSortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  return (
    <AppShell
      activePath="/investment-tracker"
      title="Investment Tracker"
      subtitle="Track private purchase lots against current net instant-sell value"
      headerActions={
        <div className="status-pill">
          <RefreshCw size={15} />
          {summary.generatedAt ? `Updated ${formatClock(summary.generatedAt)}` : "Waiting for prices"}
          <button className="refresh-btn" disabled={loading || refreshing} onClick={refreshTracker} type="button" aria-label="Refresh investment values">
            {refreshing ? <LoadingSpinner label="Refreshing..." size="small" variant="button" /> : <><RefreshCw size={16} /> Refresh</>}
          </button>
        </div>
      }
    >
      {() => (
        <div className="investment-tracker-layout">
          <section className="investment-entry-panel" aria-label="Add investment lot">
            <div>
              <h2>Add a purchase lot</h2>
              <p className="muted">Record the quantity and GP paid per item. Each addition remains a separate lot.</p>
            </div>
            <form className="investment-entry-form" onSubmit={addLot}>
              <div className="field investment-item-field">
                <label htmlFor="investment-item"><Search size={13} /> Item</label>
                <input
                  autoComplete="off"
                  id="investment-item"
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setSelectedItem(null);
                  }}
                  placeholder="Search every tradeable item..."
                  value={query}
                />
                {suggestions.length > 0 ? (
                  <div className="investment-suggestions" role="listbox" aria-label="Matching items">
                    {suggestions.map((item) => (
                      <button key={item.id} onClick={() => selectItem(item)} role="option" type="button">
                        <ItemIcon icon={item.icon} className="item-icon" />
                        <span><strong>{item.name}</strong><small>{item.members ? "Members" : "Free-to-play"}</small></span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor="investment-quantity">Quantity</label>
                <input id="investment-quantity" inputMode="numeric" min="1" onChange={(event) => setQuantity(event.target.value)} step="1" type="number" value={quantity} />
              </div>
              <div className="field">
                <label htmlFor="investment-price">Price paid per item (GP)</label>
                <input id="investment-price" inputMode="numeric" min="1" onChange={(event) => setUnitPricePaid(event.target.value)} step="1" type="number" value={unitPricePaid} />
              </div>
              <button className="primary-btn investment-add-btn" disabled={saving} type="submit">
                {saving ? <LoadingSpinner label="Adding lot..." size="small" variant="button" /> : <><Plus size={16} /> Add lot</>}
              </button>
            </form>
            {formError ? <div className="form-error" role="alert">{formError}</div> : null}
          </section>

          {error ? <div className="error">{error}</div> : null}
          {loading ? <LoadingSpinner label="Loading investments and live prices..." /> : null}

          {!loading ? (
            <>
              <section className="investment-summary" aria-label="Investment summary">
                <Metric label="Total invested" value={formatGp(summary.totalCost)} />
                <Metric
                  label={summary.isPartial ? "Net liquidation value (partial)" : "Net liquidation value"}
                  value={formatGp(summary.currentNetValue)}
                  detail={partialDetail(summary)}
                />
                <Metric
                  label={summary.isPartial ? "Unrealized profit (partial)" : "Unrealized profit"}
                  value={formatGp(summary.currentProfit)}
                  tone={profitTone(summary.currentProfit)}
                  detail="After prospective GE tax"
                />
                <Metric label={summary.isPartial ? "ROI (partial)" : "ROI"} value={summary.roi === null ? "Unavailable" : formatPercent(summary.roi)} tone={summary.roi === null ? "muted" : profitTone(summary.roi)} />
                <Metric label="Purchase lots" value={formatNumber(summary.lotCount)} />
              </section>

              {summary.isPartial ? (
                <div className="warning-banner" role="status">
                  <AlertTriangle size={16} />
                  Totals are partial because {summary.unavailableLotCount} {summary.unavailableLotCount === 1 ? "lot has" : "lots have"} no usable instant-sell quote.
                </div>
              ) : null}

              {lots.length === 0 ? (
                <div className="investment-empty">
                  <h2>No investment lots yet</h2>
                  <p className="muted">Choose an item above and enter what you paid to start tracking unrealized profit.</p>
                </div>
              ) : (
                <section className="investment-table-panel" aria-label="Tracked investment lots">
                  <StickyTable>
                    <table className="investment-table">
                      <thead>
                        <tr>
                          <SortableTableHeader label="Item" active={tableSort.key === "name"} direction={tableSort.direction} onSort={() => toggleTableSort("name")} />
                          <SortableTableHeader label="Quantity" active={tableSort.key === "quantity"} direction={tableSort.direction} onSort={() => toggleTableSort("quantity")} />
                          <SortableTableHeader label="Paid / item" active={tableSort.key === "unitPricePaid"} direction={tableSort.direction} onSort={() => toggleTableSort("unitPricePaid")} />
                          <SortableTableHeader label="Total paid" active={tableSort.key === "totalCost"} direction={tableSort.direction} onSort={() => toggleTableSort("totalCost")} />
                          <SortableTableHeader label="Instant sell" active={tableSort.key === "instantSellPrice"} direction={tableSort.direction} onSort={() => toggleTableSort("instantSellPrice")} />
                          <SortableTableHeader label="Tax / item" active={tableSort.key === "taxPerUnit"} direction={tableSort.direction} onSort={() => toggleTableSort("taxPerUnit")} />
                          <SortableTableHeader label="Net value" active={tableSort.key === "currentNetValue"} direction={tableSort.direction} onSort={() => toggleTableSort("currentNetValue")} />
                          <SortableTableHeader label="Profit" active={tableSort.key === "currentProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("currentProfit")} />
                          <SortableTableHeader label="ROI" active={tableSort.key === "roi"} direction={tableSort.direction} onSort={() => toggleTableSort("roi")} />
                          <SortableTableHeader label="Quote age" active={tableSort.key === "freshnessSeconds"} direction={tableSort.direction} onSort={() => toggleTableSort("freshnessSeconds")} />
                          <SortableTableHeader label="Added" active={tableSort.key === "createdAt"} direction={tableSort.direction} onSort={() => toggleTableSort("createdAt")} />
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedLots.map((lot) => {
                          const editing = editingId === lot.id;
                          const mutating = mutatingId === lot.id;
                          return (
                            <tr key={lot.id}>
                              <td>
                                {lot.item ? (
                                  <Link className="investment-item-link" href={`/lookup/${lot.item.id}`}>
                                    <ItemIcon icon={lot.item.icon} className="item-icon" />
                                    <span><strong>{lot.item.name}</strong>{lot.warnings.map((warning) => <small className="investment-warning" key={warning}>{warning}</small>)}</span>
                                  </Link>
                                ) : (
                                  <span className="investment-unknown-item">
                                    <strong>Unknown item #{lot.itemId}</strong>
                                    {lot.warnings.map((warning) => <small className="investment-warning" key={warning}>{warning}</small>)}
                                  </span>
                                )}
                              </td>
                              <td>{editing ? <input aria-label="Edit quantity" min="1" onChange={(event) => setEditQuantity(event.target.value)} step="1" type="number" value={editQuantity} /> : formatNumber(lot.quantity)}</td>
                              <td>{editing ? <input aria-label="Edit price paid per item" min="1" onChange={(event) => setEditUnitPricePaid(event.target.value)} step="1" type="number" value={editUnitPricePaid} /> : formatGp(lot.unitPricePaid)}</td>
                              <td>{formatGp(lot.totalCost)}</td>
                              <td>{nullableGp(lot.instantSellPrice)}</td>
                              <td>{nullableGp(lot.taxPerUnit)}</td>
                              <td>{nullableGp(lot.currentNetValue)}</td>
                              <td className={nullableProfitClass(lot.currentProfit)}>{nullableGp(lot.currentProfit)}</td>
                              <td className={nullableProfitClass(lot.roi)}>{lot.roi === null ? "Unavailable" : formatPercent(lot.roi)}</td>
                              <td>{lot.freshnessSeconds === null ? "Unavailable" : formatAge(lot.freshnessSeconds)}</td>
                              <td>{new Date(lot.createdAt).toLocaleString()}</td>
                              <td>
                                <div className="investment-row-actions">
                                  {editing ? (
                                    <>
                                      <button aria-label={`Save ${lot.item?.name ?? "investment"} lot`} className="icon-btn" disabled={mutating} onClick={() => saveEdit(lot)} title="Save changes" type="button">{mutating ? <LoadingSpinner size="small" variant="button" /> : <Check size={16} />}</button>
                                      <button aria-label="Cancel editing" className="icon-btn" disabled={mutating} onClick={() => setEditingId(null)} title="Cancel editing" type="button"><X size={16} /></button>
                                    </>
                                  ) : (
                                    <button aria-label={`Edit ${lot.item?.name ?? "investment"} lot`} className="icon-btn" disabled={mutating} onClick={() => startEditing(lot)} title="Edit lot" type="button"><Pencil size={16} /></button>
                                  )}
                                  <button aria-label={`Remove ${lot.item?.name ?? "investment"} lot`} className="icon-btn" disabled={mutating} onClick={() => removeLot(lot)} title="Remove lot" type="button"><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </StickyTable>
                  <p className="investment-disclaimer muted">Values use the latest observed instant-sell price and prospective GE tax. Quotes, fills, and profit are estimates, not guarantees.</p>
                </section>
              )}
            </>
          ) : null}
        </div>
      )}
    </AppShell>
  );
}

export function validFormInput(selectedItem: ItemMeta | null, quantity: string, unitPricePaid: string) {
  if (!selectedItem) return { ok: false, error: "Select an item from the search results." } as const;
  const editable = validEditableInput(quantity, unitPricePaid);
  if (!editable.ok) return editable;
  return { ok: true, data: { itemId: selectedItem.id, ...editable.data } } as const;
}

export function validEditableInput(quantity: string, unitPricePaid: string) {
  const parsedQuantity = Number(quantity);
  const parsedUnitPrice = Number(unitPricePaid);
  if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
    return { ok: false, error: "Quantity must be a positive integer." } as const;
  }
  if (!Number.isInteger(parsedUnitPrice) || parsedUnitPrice <= 0) {
    return { ok: false, error: "Price paid must be a positive whole GP amount." } as const;
  }
  return { ok: true, data: { quantity: parsedQuantity, unitPricePaid: parsedUnitPrice } } as const;
}

function trackerSortValue(lot: TrackedInvestmentLot, key: TrackerSortKey): number | string | null {
  switch (key) {
    case "name": return lot.item?.name ?? null;
    case "quantity": return lot.quantity;
    case "unitPricePaid": return lot.unitPricePaid;
    case "totalCost": return lot.totalCost;
    case "instantSellPrice": return lot.instantSellPrice;
    case "taxPerUnit": return lot.taxPerUnit;
    case "currentNetValue": return lot.currentNetValue;
    case "currentProfit": return lot.currentProfit;
    case "roi": return lot.roi;
    case "freshnessSeconds": return lot.freshnessSeconds;
    case "createdAt": return Date.parse(lot.createdAt);
  }
}

function partialDetail(summary: InvestmentTrackerSummary): string | undefined {
  return summary.isPartial
    ? `${formatGp(summary.valuedCost)} of ${formatGp(summary.totalCost)} invested value has a quote`
    : undefined;
}

function nullableGp(value: number | null): string {
  return value === null ? "Unavailable" : formatGp(value);
}

function profitTone(value: number): "positive" | "negative" | "muted" {
  if (value === 0) return "muted";
  return value > 0 ? "positive" : "negative";
}

function nullableProfitClass(value: number | null): "positive" | "negative" | "muted" {
  return value === null ? "muted" : profitTone(value);
}
