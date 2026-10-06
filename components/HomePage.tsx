import Image from "next/image";
import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";

export function HomePage() {
  return (
    <div className="home-page">
      <Image alt="An Old School RuneScape-inspired Grand Exchange beneath a golden sunset" className="home-backdrop" fill priority quality={90} sizes="100vw" src="/images/home/grand-exchange-sunset-4k.webp?v=2" />
      <div aria-hidden="true" className="home-backdrop-shade" />

      <header className="home-header">
        <div className="home-brand"><LogoMark className="home-brand-mark" /><span>Merchvision</span></div>
        <span className="home-location"><span aria-hidden="true">✦</span> Varrock, Gielinor</span>
      </header>

      <main aria-labelledby="home-heading" className="home-content">
        <h1 id="home-heading">Good trades<br />start <em>here.</em></h1>
        <Link className="home-open-app" href="/flips">Open app</Link>
      </main>

      <footer className="home-footer">
        <p>Market insights from <a href="https://prices.runescape.wiki/">OSRS Wiki</a>. Estimates, not guarantees.</p>
        <p>Independent fan project · Not affiliated with Jagex</p>
      </footer>
    </div>
  );
}
