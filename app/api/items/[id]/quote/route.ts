import { NextResponse } from "next/server";
import { getItems, getLatestPrices } from "@/lib/osrsWiki";
import { buildItemQuote } from "@/lib/quote";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const itemId = Number(id);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }

    const [items, prices] = await Promise.all([getItems(), getLatestPrices()]);
    const item = items.find((candidate) => candidate.id === itemId);

    if (!item) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const price = prices.find((candidate) => candidate.id === itemId);
    return NextResponse.json({ item, quote: buildItemQuote(price) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load item quote." },
      { status: 500 }
    );
  }
}
