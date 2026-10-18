import { NextResponse } from "next/server";
import { BANK_MAX_ROWS, parseBankIds } from "@/lib/bank";
import { getBankMarket } from "@/lib/bankMarket";

export async function POST(request: Request) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 }); }
  const ids = parseBankIds(value, BANK_MAX_ROWS);
  if (!ids) return NextResponse.json({ error: "Provide 1–2,000 distinct positive integer item IDs." }, { status: 400 });
  try { return NextResponse.json(await getBankMarket(ids)); }
  catch { return NextResponse.json({ error: "Unable to load bank market data. Please try again." }, { status: 503 }); }
}
