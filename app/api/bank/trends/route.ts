import { NextResponse } from "next/server";
import { BANK_TREND_BATCH_SIZE, parseBankIds } from "@/lib/bank";
import { getBankTrends } from "@/lib/bankMarket";

export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const ids = parseBankIds(value, BANK_TREND_BATCH_SIZE);
  if (!ids) return NextResponse.json({ error: "Provide 1–20 distinct positive integer item IDs." }, { status: 400 });
  try {
    return NextResponse.json({ data: await getBankTrends(ids, request.signal), meta: { generatedAt: new Date().toISOString() } });
  } catch { return NextResponse.json({ error: "Unable to load bank trends. Please try again." }, { status: 503 }); }
}
