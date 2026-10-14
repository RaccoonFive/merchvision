import type { LatestPrice } from "@/lib/types";

export const PRAYER_POTIONS = [
  { id: 2434, name: "Prayer potion (4)", icon: "/images/home/items/prayer-potion.png", baseRestore: 7, wikiUrl: "https://oldschool.runescape.wiki/w/Prayer_potion" },
  { id: 3024, name: "Super restore (4)", icon: "/images/potions/super-restore.png", baseRestore: 8, wikiUrl: "https://oldschool.runescape.wiki/w/Super_restore" }
] as const;

export type PrayerPotionPrice = {
  id: number;
  price: number | null;
  timestamp: number | null;
};

export type PrayerPotionResponse = {
  data: PrayerPotionPrice[];
  meta: { generatedAt: string };
};

export function isPrayerLevel(level: number): boolean {
  return Number.isInteger(level) && level >= 1 && level <= 99;
}

export function getPrayerPotionPrices(prices: LatestPrice[]): PrayerPotionPrice[] {
  return PRAYER_POTIONS.map(({ id }) => {
    const quote = prices.find((entry) => entry.id === id);
    const price = quote?.high;
    const timestamp = quote?.highTime;
    return {
      id,
      // Consumers purchase at the observed instant-buy (high) price. Never
      // substitute an instant-sell quote or subtract the seller's GE tax.
      price: price !== undefined && Number.isSafeInteger(price) && price > 0 ? price : null,
      timestamp: timestamp !== undefined && Number.isSafeInteger(timestamp) && timestamp > 0 ? timestamp : null
    };
  });
}

export function comparePrayerPotions(level: number, prices: PrayerPotionPrice[], now: number) {
  if (!isPrayerLevel(level)) return null;

  const potions = PRAYER_POTIONS.map((potion) => {
    const quote = prices.find(({ id }) => id === potion.id);
    const price = quote?.price != null && Number.isSafeInteger(quote.price) && quote.price > 0 ? quote.price : null;
    // No overhealing: at low levels even a dose taken at zero is capped.
    const pointsPerDose = Math.min(level, potion.baseRestore + Math.floor(level / 4));
    const pointsPerPotion = pointsPerDose * 4;
    const ageSeconds = quote?.timestamp != null ? Math.max(0, now - quote.timestamp) : null;
    return {
      ...potion,
      price,
      timestamp: quote?.timestamp ?? null,
      ageSeconds,
      stale: ageSeconds === null || ageSeconds > 3600,
      pointsPerDose,
      pointsPerPotion,
      pointsPerGp: price === null ? null : pointsPerPotion / price,
      gpPerPoint: price === null ? null : price / pointsPerPotion
    };
  });
  const [prayer, restore] = potions;
  if (prayer.price === null || restore.price === null) {
    return { potions, winnerId: null, tied: false, savingsFraction: null };
  }

  // Compare unrounded ratios so display precision cannot change the winner.
  const difference = prayer.pointsPerPotion * restore.price - restore.pointsPerPotion * prayer.price;
  const winnerId = difference === 0 ? null : difference > 0 ? prayer.id : restore.id;
  const cheaper = Math.min(prayer.gpPerPoint!, restore.gpPerPoint!);
  const dearer = Math.max(prayer.gpPerPoint!, restore.gpPerPoint!);
  return { potions, winnerId, tied: difference === 0, savingsFraction: 1 - cheaper / dearer };
}
