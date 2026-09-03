import { NextResponse } from "next/server";
import { analyzeItemResearch } from "@/lib/itemResearch";
import { analyzeMarketRhythm } from "@/lib/marketRhythm";
import { getItems, getTimeseries } from "@/lib/osrsWiki";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const itemId = Number(id);
    const { searchParams } = new URL(request.url);
    const timestep = searchParams.get("timestep") ?? "1h";
    const includeRhythm = searchParams.get("includeRhythm") === "true";
    const includeResearch = searchParams.get("includeResearch") === "true";

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }

    const [data, item] = await Promise.all([
      getTimeseries(itemId, timestep),
      includeResearch ? getItems().then((items) => items.find((candidate) => candidate.id === itemId)) : undefined
    ]);

    return NextResponse.json({
      data,
      ...(includeRhythm ? { rhythm: analyzeMarketRhythm(data) } : {}),
      ...(includeResearch ? { research: analyzeItemResearch(data, item?.limit) } : {})
    });
  } catch {
    return NextResponse.json({ error: "Unable to load item price history." }, { status: 500 });
  }
}
