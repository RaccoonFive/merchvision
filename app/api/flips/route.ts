import { NextResponse } from "next/server";
import { loadReliableFlips, loadUpsideFlips } from "@/lib/flipFinder";
import { parseFlipFilters, parseFlipView, parseUpsideFlipFilters } from "@/lib/query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = parseFlipView(searchParams);
    const data = view === "upside"
      ? await loadUpsideFlips(parseUpsideFlipFilters(searchParams))
      : await loadReliableFlips(parseFlipFilters(searchParams));

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
        generatedAt: new Date().toISOString(),
        view,
        modelVersion: data[0]?.modelVersion ?? (view === "upside" ? "upside-v1" : "reliable-v1")
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to rank flips." }, { status: 500 });
  }
}
