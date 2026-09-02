"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { loadItemCatalog } from "@/lib/clientItemCatalog";
import { searchItems } from "@/lib/itemSearch";
import type { ItemMeta } from "@/lib/types";

export function HeaderItemSearch() {
  const router = useRouter();
  const listboxId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ItemMeta[]>([]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = useMemo(() => searchItems(items, query, 8), [items, query]);
  const showResults = open && query.trim().length > 0;

  useEffect(() => {
    let alive = true;

    loadItemCatalog()
      .then((catalog) => {
        if (alive) setItems(catalog);
      })
      .catch(() => {
        if (alive) setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    function closeSearch(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function focusSearch(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }

    document.addEventListener("pointerdown", closeSearch);
    document.addEventListener("keydown", focusSearch);
    return () => {
      document.removeEventListener("pointerdown", closeSearch);
      document.removeEventListener("keydown", focusSearch);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(suggestions.length > 0 ? 0 : -1);
  }, [query, suggestions.length]);

  function selectItem(item: ItemMeta) {
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
    router.push(`/lookup/${item.id}`);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (suggestions.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current + 1) % suggestions.length);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
    }

    if (event.key === "Enter" && open && activeIndex >= 0) {
      event.preventDefault();
      selectItem(suggestions[activeIndex]);
    }
  }

  return (
    <div className="header-item-search" ref={rootRef}>
      <Search aria-hidden="true" className="header-item-search-icon" size={15} />
      <input
        aria-activedescendant={showResults && activeIndex >= 0 ? `${listboxId}-option-${suggestions[activeIndex]?.id}` : undefined}
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={showResults}
        aria-label="Quick search items"
        autoComplete="off"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder="Quick search items…"
        ref={inputRef}
        role="combobox"
        value={query}
      />
      <kbd aria-hidden="true">⌘K</kbd>

      {showResults ? (
        <div aria-label="Matching items" className="header-item-results" id={listboxId} role="listbox">
          {loading ? <div className="header-item-search-state"><LoadingSpinner label="Loading items…" size="small" variant="inline" /></div> : null}
          {!loading && error ? <div className="header-item-search-state">Item search is unavailable.</div> : null}
          {!loading && !error && suggestions.length === 0 ? <div className="header-item-search-state">No matching items.</div> : null}
          {suggestions.map((item, index) => (
            <button
              aria-selected={index === activeIndex}
              className={index === activeIndex ? "active" : ""}
              id={`${listboxId}-option-${item.id}`}
              key={item.id}
              onClick={() => selectItem(item)}
              onMouseEnter={() => setActiveIndex(index)}
              role="option"
              type="button"
            >
              <ItemIcon className="header-item-result-icon" icon={item.icon} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.members ? "Members" : "Free-to-play"}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
