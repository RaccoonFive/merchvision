import type { BossCategory, BossDefinition, BossSource } from "./bossTypes";

export const BOSS_CATEGORIES: BossCategory[] = ["Combat", "Wilderness", "Slayer", "Skilling", "Minigame", "Raids"];

const SOURCE_SECTIONS: Record<string, string[]> = {
  Bryophyta: ["Members'_worlds_drops", "Free-to-play_worlds_drops"],
  Obor: ["Members'_worlds_drops", "Free-to-play_worlds_drops"],
  Scurrius: ["Drops_(MVP/Solo)", "Drops_(non-MVP)"],
  "Maggot King": ["Drops_(take-eggs)", "Drops_(open-stomach)"],
  "The Mimic": ["Elite_drops", "Master_drops"]
};

const IMAGE_FILES: Record<string, string> = {
  "Abyssal Sire": "Abyssal Sire (phase 1).png",
  "Alchemical Hydra": "Alchemical Hydra (serpentine).png",
  "Grotesque Guardians": "Dawn.png",
  "Mad Angel": "Mad Angel.webp",
  "Phantom Muspah": "Phantom Muspah (ranged).png",
  "Phosani's Nightmare": "The Nightmare.png",
  Zulrah: "Zulrah (serpentine).png"
};

function boss(name: string, category: BossCategory, options: Partial<Omit<BossDefinition, "name" | "category">> = {}): BossDefinition {
  return {
    slug: name.toLowerCase().replaceAll("'", "").replaceAll(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
    name,
    category,
    image: `https://oldschool.runescape.wiki/images/${encodeURIComponent((IMAGE_FILES[name] ?? name + ".png").replaceAll(" ", "_"))}`,
    encounters: [name],
    sources: [{ page: name, sections: SOURCE_SECTIONS[name] ?? ["Drops", "Rewards"], requiredSections: SOURCE_SECTIONS[name] }],
    ...options
  };
}

function rewards(page: string, section = "Rewards"): BossSource[] {
  return [{ page, sections: [section] }];
}

// Roster checked against the Wiki Boss list on 2026-10-04. Loot stays live;
// fixed source pages prevent arbitrary upstream queries from browser input.
export const BOSSES: BossDefinition[] = [
  boss("Barrows", "Combat", {
    image: "https://oldschool.runescape.wiki/images/Ahrim_the_Blighted.png",
    encounters: ["Ahrim the Blighted", "Dharok the Wretched", "Guthan the Infested", "Karil the Tainted", "Torag the Corrupted", "Verac the Defiled"],
    sources: rewards("Chest (Barrows)")
  }),
  ...["Gemstone Crab", "Scurrius", "Giant Mole", "Deranged Archaeologist", "Dagannoth Supreme", "Dagannoth Rex", "Dagannoth Prime", "Sarachnis", "Kalphite Queen", "Kree'arra", "Commander Zilyana", "General Graardor", "K'ril Tsutsaroth", "The Hueycoatl", "Corporeal Beast", "Nex", "Brutus", "Demonic Brutus", "Obor", "Bryophyta", "Amoxliatl", "Doom of Mokhaiotl", "Mad Angel", "Zulrah", "Vorkath", "Phantom Muspah", "Maggot King", "The Nightmare", "Phosani's Nightmare", "Yama", "Duke Sucellus", "The Leviathan", "The Whisperer", "Vardorvis", "The Mimic", "Hespori", "Skotizo"].map((name) => boss(name, "Combat")),
  boss("Moons of Peril", "Combat", {
    image: "https://oldschool.runescape.wiki/images/Eclipse_Moon.png",
    encounters: ["Blood Moon", "Blue Moon", "Eclipse Moon"],
    sources: rewards("Lunar Chest")
  }),
  boss("Royal Titans", "Combat", {
    image: "https://oldschool.runescape.wiki/images/Branda_the_Fire_Queen.png",
    encounters: ["Branda the Fire Queen", "Eldric the Ice King"],
    sources: [{ page: "Royal Titans", sections: ["Rewards", "Branda_the_Fire_Queen_drops", "Eldric_the_Ice_King_drops"], requiredSections: ["Branda_the_Fire_Queen_drops", "Eldric_the_Ice_King_drops"] }]
  }),
  ...["Chaos Fanatic", "Crazy archaeologist", "Scorpia", "King Black Dragon", "Chaos Elemental", "Revenant maledictus", "Calvar'ion", "Vet'ion", "Spindel", "Venenatis", "Artio", "Callisto"].map((name) => boss(name, "Wilderness")),
  ...["Shellbane gryphon", "Grotesque Guardians", "Abyssal Sire", "Kraken", "Cerberus", "Araxxor", "Thermonuclear smoke devil", "Alchemical Hydra"].map((name) => boss(name, "Slayer")),
  boss("Tempoross", "Skilling", { sources: rewards("Reward pool") }),
  boss("Wintertodt", "Skilling", {
    image: "https://oldschool.runescape.wiki/images/Howling_Snow_Storm.gif",
    sources: rewards("Reward Cart")
  }),
  boss("Zalcano", "Skilling"),
  boss("The Gauntlet", "Minigame", {
    image: "https://oldschool.runescape.wiki/images/Corrupted_Hunllef.png",
    encounters: ["Crystalline Hunllef", "Corrupted Hunllef"],
    sources: [{ page: "Reward Chest (The Gauntlet)", sections: ["Junk_table", "Incomplete_loot_table", "Regular_loot_table", "Corrupted_loot_table"], requiredSections: ["Junk_table", "Incomplete_loot_table", "Regular_loot_table", "Corrupted_loot_table"] }]
  }),
  boss("TzTok-Jad", "Minigame"),
  boss("TzKal-Zuk", "Minigame"),
  boss("Fortis Colosseum", "Minigame", {
    image: "https://oldschool.runescape.wiki/images/Sol_Heredit.png",
    encounters: ["Sol Heredit", "Colosseum waves 1–12"],
    sources: rewards("Rewards Chest (Fortis Colosseum)")
  }),
  boss("Chambers of Xeric", "Raids", {
    image: "https://oldschool.runescape.wiki/images/Great_Olm.png",
    encounters: ["Tekton", "Vanguard", "Vespula", "Vasa Nistirio", "Muttadile", "Great Olm"],
    sources: rewards("Ancient chest", "Loot_table")
  }),
  boss("Theatre of Blood", "Raids", {
    image: "https://oldschool.runescape.wiki/images/Verzik_Vitur.png",
    encounters: ["The Maiden of Sugadinti", "Pestilent Bloat", "Nylocas Vasilias", "Sotetseg", "Xarpus", "Verzik Vitur"],
    sources: rewards("Monumental chest", "Loot_table")
  }),
  boss("Tombs of Amascut", "Raids", {
    image: "https://oldschool.runescape.wiki/images/Tumeken%27s_Warden.png",
    encounters: ["Akkha", "Ba-Ba", "Kephri", "Zebak", "Tumeken's Warden", "Elidinis' Warden"],
    sources: [{ page: "Chest (Tombs of Amascut)", sections: ["Loot_table", "Loot_mechanics"] }]
  })
].sort((a, b) => a.name.localeCompare(b.name, "en"));

export function findBoss(slug: string): BossDefinition | undefined {
  return BOSSES.find((entry) => entry.slug === slug);
}

export function filterBosses(query: string, category: BossCategory | "All"): BossDefinition[] {
  const search = query.trim().toLowerCase();
  return BOSSES.filter((entry) => (category === "All" || category === entry.category) &&
    [entry.name, ...entry.encounters].some((name) => name.toLowerCase().includes(search)));
}
