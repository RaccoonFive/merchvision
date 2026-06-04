import type { ItemMeta } from "./types";

export function searchItems(items: ItemMeta[], query: string, limit = 20): ItemMeta[] {
  const search = query.trim().toLowerCase();
  if (!search) return [];

  return items
    .filter((item) => item.name.toLowerCase().includes(search))
    .sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      return matchRank(aName, search) - matchRank(bName, search) || aName.localeCompare(bName);
    })
    .slice(0, limit);
}

function matchRank(name: string, search: string): number {
  if (name === search) return 0;
  if (name.startsWith(search)) return 1;
  return 2;
}
