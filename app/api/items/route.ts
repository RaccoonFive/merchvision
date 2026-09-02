import { NextResponse } from "next/server";
import { getItems } from "@/lib/osrsWiki";

export async function GET() {
  try {
    const items = await getItems();
    return NextResponse.json(
      { data: items },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400"
        }
      }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load items." },
      { status: 500 }
    );
  }
}
