import { prisma } from "@/lib/prisma";
import { getItems, getLatestPrices } from "@/lib/osrsWiki";
import { buildItemQuote } from "@/lib/quote";
import type { FavoriteItem } from "@/lib/types";

export async function getFavoriteItems(userId: string): Promise<FavoriteItem[]> {
  const [favorites, items, prices] = await Promise.all([
    prisma.favorite.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getItems(),
    getLatestPrices()
  ]);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const pricesById = new Map(prices.map((price) => [price.id, price]));

  return favorites.flatMap((favorite) => {
    const item = itemsById.get(favorite.itemId);
    if (!item) return [];

    return [{
      favoritedAt: favorite.createdAt.toISOString(),
      item,
      quote: buildItemQuote(pricesById.get(item.id))
    }];
  });
}

export async function itemExists(itemId: number): Promise<boolean> {
  const items = await getItems();
  return items.some((item) => item.id === itemId);
}
