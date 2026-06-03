import { NextResponse } from "next/server";
import { getItems } from "@/lib/osrsWiki";

export async function GET() {
  try {
    const items = await getItems();
    return NextResponse.json({ data: items });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load items." },
      { status: 500 }
    );
  }
}
