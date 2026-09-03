import { NextResponse } from "next/server";
import { analyzeMarketRhythm } from "@/lib/marketRhythm";
import { getTimeseries } from "@/lib/osrsWiki";

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

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }

    const data = await getTimeseries(itemId, timestep);
    return NextResponse.json(includeRhythm ? { data, rhythm: analyzeMarketRhythm(data) } : { data });
  } catch {
    return NextResponse.json({ error: "Unable to load item price history." }, { status: 500 });
  }
}
