import { NextResponse } from "next/server";
import { findBoss } from "@/lib/bossCatalog";
import { enrichBossDrops } from "@/lib/bossDrops";
import { getBossLoot, getItems, getLatestPrices } from "@/lib/osrsWiki";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    return NextResponse.json({ error: "Invalid boss identifier." }, { status: 400 });
  }
  const boss = findBoss(slug);
  if (!boss) return NextResponse.json({ error: "Boss not found." }, { status: 404 });
  try {
    const [loot, items, prices] = await Promise.all([
      getBossLoot(boss), getItems().catch(() => null), getLatestPrices().catch(() => null)
    ]);
    return NextResponse.json(enrichBossDrops(loot, items, prices), {
      headers: { "Cache-Control": "public, max-age=60" }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load boss drops. Please try again." }, { status: 503 });
  }
}
