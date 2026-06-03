import { NextResponse } from "next/server";
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

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }

    const data = await getTimeseries(itemId, timestep);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load item timeseries." },
      { status: 500 }
    );
  }
}
