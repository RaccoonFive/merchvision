import { NextResponse } from "next/server";
import { getLatestPrices } from "@/lib/osrsWiki";
import { getPrayerPotionPrices } from "@/lib/prayerPotions";

export async function GET() {
  try {
    const prices = await getLatestPrices();
    return NextResponse.json({
      data: getPrayerPotionPrices(prices),
      meta: { generatedAt: new Date().toISOString() }
    });
  } catch {
    return NextResponse.json({ error: "Unable to load potion prices. Please try again." }, { status: 502 });
  }
}
