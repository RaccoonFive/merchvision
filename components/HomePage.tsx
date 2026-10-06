import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";

const floatingItems = [
  { item: "dragon-scimitar", density: "base" },
  { item: "abyssal-whip", density: "base" },
  { item: "dragon-boots", density: "base" },
  { item: "rune-platebody", density: "base" },
  { item: "twisted-bow", density: "base" },
  { item: "prayer-potion", density: "base" },
  { item: "nature-rune", density: "base" },
  { item: "shark", density: "base" },
  { item: "dragon-dagger", density: "peripheral" },
  { item: "blood-rune", density: "peripheral" },
  { item: "granite-maul", density: "peripheral" },
  { item: "dark-bow", density: "peripheral" },
  { item: "amulet-of-fury", density: "fringe" },
  { item: "fire-rune", density: "fringe" },
  { item: "berserker-ring", density: "fringe" },
  { item: "saradomin-brew", density: "fringe" },
  { item: "rune-scimitar", density: "fringe" },
  { item: "magic-logs", density: "fringe" },
  { item: "bandos-chestplate", density: "fringe" },
  { item: "armadyl-helmet", density: "fringe" }
];

export function HomePage() {
  return (
    <div className="home-page">
      <Image alt="An Old School RuneScape-inspired Grand Exchange beneath a golden sunset" className="home-backdrop" fill priority quality={90} sizes="100vw" src="/images/home/grand-exchange-sunset-4k.webp?v=2" />
      <div aria-hidden="true" className="home-backdrop-shade" />
      <div aria-hidden="true" className="home-floating-items">
        {floatingItems.map(({ item, density }) => (
          <div className={`home-item-tile home-item-${item} home-item-${density}`} key={item}>
            <img alt="" decoding="async" draggable={false} height={36} src={`/images/home/items/${item}.png`} width={36} />
          </div>
        ))}
      </div>

      <header className="home-header">
        <div className="home-brand"><LogoMark className="home-brand-mark" /><span>Merchvision</span></div>
        <span className="home-location"><span aria-hidden="true">✦</span> Varrock, Gielinor</span>
      </header>

      <main aria-labelledby="home-heading" className="home-content">
        <h1 id="home-heading">Good trades<br />start <em>here</em></h1>
        <Link className="home-open-app" href="/flips">Open app</Link>
      </main>

      <footer className="home-footer">
        <p>Market insights from <a href="https://prices.runescape.wiki/">OSRS Wiki</a>. Estimates, not guarantees.</p>
        <p>Independent fan project · Not affiliated with Jagex</p>
      </footer>
    </div>
  );
}
