export type BossCategory = "Combat" | "Wilderness" | "Slayer" | "Skilling" | "Minigame" | "Raids";

export type BossSource = {
  page: string;
  sections: string[];
  requiredSections?: string[];
  label?: string;
};

export type BossDefinition = {
  slug: string;
  name: string;
  category: BossCategory;
  image: string;
  encounters: string[];
  sources: BossSource[];
};

export type BossDrop = {
  name: string;
  itemId: number | null;
  icon: string | null;
  quantity: string;
  rarity: string;
  group: string;
  notes: string[];
  wikiUrl: string;
  geStatus: "available" | "unavailable" | "unmatched" | "not-sold";
  instantSellPrice: number | null;
  instantSellTime: number | null;
};

export type ParsedBossDrop = Omit<BossDrop, "geStatus" | "instantSellPrice" | "instantSellTime"> & {
  notSoldOnGe: boolean;
};

export type BossLoot = {
  drops: ParsedBossDrop[];
  notes: string[];
  sources: { page: string; url: string; revision: number }[];
  fetchedAt: string;
  partial: boolean;
};

export type BossDropsResponse = {
  data: BossDrop[];
  meta: {
    sources: BossLoot["sources"];
    notes: string[];
    fetchedAt: string;
    pricedAt: string;
    lootPartial: boolean;
    pricesPartial: boolean;
  };
};
