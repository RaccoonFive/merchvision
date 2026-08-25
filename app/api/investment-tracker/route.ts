import { NextResponse } from "next/server";
import {
  getInvestmentTracker,
  investmentItemExists,
  parseInvestmentLotInput,
  serializeInvestmentLot
} from "@/lib/investmentTracker";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const tracker = await getInvestmentTracker(session.user.id);
    return NextResponse.json(tracker);
  } catch {
    return NextResponse.json({ error: "Unable to load investment tracker." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const body = await readJson(request);
    if ("error" in body) return NextResponse.json({ error: body.error }, { status: 400 });
    const parsed = parseInvestmentLotInput(body.data);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (!(await investmentItemExists(parsed.data.itemId))) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    const lot = await prisma.investmentLot.create({
      data: { userId: session.user.id, ...parsed.data }
    });
    return NextResponse.json({ data: serializeInvestmentLot(lot) }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to add investment lot." }, { status: 500 });
  }
}

async function readJson(request: Request): Promise<{ data: unknown } | { error: string }> {
  try {
    return { data: await request.json() };
  } catch {
    return { error: "Request body must be valid JSON." };
  }
}

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}
