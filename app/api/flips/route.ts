import { NextResponse } from "next/server";
import { loadReliableFlipResult, loadUpsideFlipResult } from "@/lib/flipFinder";
import { parseFlipFilters, parseFlipView, parseUpsideFlipFilters } from "@/lib/query";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const view = parseFlipView(searchParams);
    const result = view === "upside"
      ? await loadUpsideFlipResult(parseUpsideFlipFilters(searchParams))
      : await loadReliableFlipResult(parseFlipFilters(searchParams));
    const data = result.data;

    return NextResponse.json({
      data,
      meta: {
        count: data.length,
        generatedAt: new Date().toISOString(),
        health: result.health,
        view,
        modelVersion: data[0]?.modelVersion ?? (view === "upside" ? "upside-v1" : "reliable-v1")
      }
    });
  } catch {
    return NextResponse.json({ error: "Unable to rank flips." }, { status: 500 });
  }
}
