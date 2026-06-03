import { NextResponse } from "next/server";
import { getLatestPrices } from "@/lib/osrsWiki";

export async function GET() {
  try {
    const prices = await getLatestPrices();
    return NextResponse.json({ data: prices });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load latest prices." },
      { status: 500 }
    );
  }
}
