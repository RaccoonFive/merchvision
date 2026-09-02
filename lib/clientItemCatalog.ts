"use client";

import type { ItemMeta } from "./types";

type ItemsResponse = {
  data?: ItemMeta[];
  error?: string;
};

let itemCatalogPromise: Promise<ItemMeta[]> | null = null;

export function loadItemCatalog(): Promise<ItemMeta[]> {
  if (!itemCatalogPromise) {
    itemCatalogPromise = fetch("/api/items")
      .then(async (response) => {
        const payload = (await response.json()) as ItemsResponse;
        if (!response.ok || payload.error) throw new Error(payload.error ?? "Unable to load items.");
        return payload.data ?? [];
      })
      .catch((error) => {
        itemCatalogPromise = null;
        throw error;
      });
  }

  return itemCatalogPromise;
}
