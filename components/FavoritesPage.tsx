"use client";

import { Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { SortableTableHeader } from "@/components/SortableTableHeader";
import { StickyTable } from "@/components/StickyTable";
import { sortTableRows, type SortDirection } from "@/lib/tableSort";
import type { FavoriteItem } from "@/lib/types";

type FavoritesResponse = {
  data?: FavoriteItem[];
  error?: string;
};

type FavoriteSortKey = "name" | "low" | "high" | "netProfit" | "roi" | "freshnessSeconds";

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [tableSort, setTableSort] = useState<{ key: FavoriteSortKey; direction: SortDirection }>({
    key: "name",
    direction: "asc"
  });
  const sortedFavorites = sortTableRows(
    favorites,
    (favorite) => favoriteSortValue(favorite, tableSort.key),
    tableSort.direction
  );

  useEffect(() => {
    fetch("/api/favorites")
      .then(async (response) => {
        const payload = (await response.json()) as FavoritesResponse;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load favorites.");
        setFavorites(payload.data ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Unable to load favorites."))
      .finally(() => setLoading(false));
  }, []);

  async function removeFavorite(itemId: number) {
    setRemovingId(itemId);
    setError(null);

    try {
      const response = await fetch(`/api/favorites/${itemId}`, { method: "DELETE" });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to remove favorite.");
      setFavorites((current) => current.filter((favorite) => favorite.item.id !== itemId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove favorite.");
    } finally {
      setRemovingId(null);
    }
  }

  function toggleTableSort(key: FavoriteSortKey) {
    setTableSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  return (
    <AppShell activePath="/favorites" title="Favorites" subtitle="Your saved Grand Exchange items">
      {() => (
        <section className="favorites-panel" aria-label="Favorite items">
          {error ? <div className="error">{error}</div> : null}
          {loading ? <LoadingSpinner label="Loading favorite items..." /> : null}
          {!loading && !error && favorites.length === 0 ? (
            <div className="favorites-empty">
              <Star size={24} />
              <h2>No favorites yet</h2>
              <p className="muted">Open an item lookup and use the star button to save it here.</p>
              <Link className="primary-link" href="/lookup">Find an item</Link>
            </div>
          ) : null}
          {!loading && favorites.length > 0 ? (
            <StickyTable>
              <table className="favorites-table">
                <thead>
                  <tr>
                    <SortableTableHeader label="Item" active={tableSort.key === "name"} direction={tableSort.direction} onSort={() => toggleTableSort("name")} />
                    <SortableTableHeader label="Buy" active={tableSort.key === "low"} direction={tableSort.direction} onSort={() => toggleTableSort("low")} />
                    <SortableTableHeader label="Sell" active={tableSort.key === "high"} direction={tableSort.direction} onSort={() => toggleTableSort("high")} />
                    <SortableTableHeader label="Net margin" active={tableSort.key === "netProfit"} direction={tableSort.direction} onSort={() => toggleTableSort("netProfit")} />
                    <SortableTableHeader label="ROI" active={tableSort.key === "roi"} direction={tableSort.direction} onSort={() => toggleTableSort("roi")} />
                    <SortableTableHeader label="Freshness" active={tableSort.key === "freshnessSeconds"} direction={tableSort.direction} onSort={() => toggleTableSort("freshnessSeconds")} />
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sortedFavorites.map(({ item, quote }) => (
                    <tr key={item.id}>
                      <td>
                        <Link className="favorite-item-link" href={`/lookup/${item.id}`}>
                          {item.icon ? <img alt="" className="item-icon" src={item.icon} /> : <span className="item-icon" />}
                          <span>
                            <strong>{item.name}</strong>
                            <small>{item.members ? "Members" : "Free-to-play"}</small>
                          </span>
                        </Link>
                      </td>
                      <td>{formatNullableGp(quote.low)}</td>
                      <td>{formatNullableGp(quote.high)}</td>
                      <td className={valueTone(quote.netProfit)}>{formatNullableGp(quote.netProfit)}</td>
                      <td className={valueTone(quote.roi)}>{quote.roi === null ? "Unavailable" : formatPercent(quote.roi)}</td>
                      <td>{quote.freshnessSeconds === null ? "Unavailable" : formatAge(quote.freshnessSeconds)}</td>
                      <td>
                        <button
                          aria-label={`Remove ${item.name} from favorites`}
                          className="icon-btn"
                          disabled={removingId === item.id}
                          onClick={() => removeFavorite(item.id)}
                          title="Remove favorite"
                          type="button"
                        >
                          {removingId === item.id ? <LoadingSpinner size="small" variant="button" /> : <Trash2 size={16} />}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </StickyTable>
          ) : null}
        </section>
      )}
    </AppShell>
  );
}

function formatNullableGp(value: number | null): string {
  return value === null ? "Unavailable" : `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} gp`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${Math.round(seconds / 3600)}h`;
}

function valueTone(value: number | null): "positive" | "negative" | "muted" {
  if (value === null || value === 0) return "muted";
  return value > 0 ? "positive" : "negative";
}

function favoriteSortValue(favorite: FavoriteItem, key: FavoriteSortKey): number | string | null {
  switch (key) {
    case "name": return favorite.item.name;
    case "low": return favorite.quote.low;
    case "high": return favorite.quote.high;
    case "netProfit": return favorite.quote.netProfit;
    case "roi": return favorite.quote.roi;
    case "freshnessSeconds": return favorite.quote.freshnessSeconds;
  }
}
