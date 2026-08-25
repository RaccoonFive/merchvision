import { NextResponse } from "next/server";
import { parseInvestmentLotUpdate, serializeInvestmentLot } from "@/lib/investmentTracker";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

type Context = {
  params: Promise<{ lotId: string }>;
};

export async function PUT(request: Request, context: Context) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const lotId = await parseLotId(context);
    if (!lotId) return invalidLotId();
    const body = await readJson(request);
    if ("error" in body) return NextResponse.json({ error: body.error }, { status: 400 });
    const parsed = parseInvestmentLotUpdate(body.data);
    if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

    const existing = await prisma.investmentLot.findFirst({
      where: { id: lotId, userId: session.user.id }
    });
    if (!existing) return notFound();

    const lot = await prisma.investmentLot.update({
      where: { id: lotId },
      data: parsed.data
    });
    return NextResponse.json({ data: serializeInvestmentLot(lot) });
  } catch {
    return NextResponse.json({ error: "Unable to update investment lot." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const lotId = await parseLotId(context);
    if (!lotId) return invalidLotId();
    const deleted = await prisma.investmentLot.deleteMany({
      where: { id: lotId, userId: session.user.id }
    });
    if (deleted.count === 0) return notFound();

    return NextResponse.json({ deleted: true });
  } catch {
    return NextResponse.json({ error: "Unable to remove investment lot." }, { status: 500 });
  }
}

async function parseLotId(context: Context): Promise<string | null> {
  const { lotId: rawLotId } = await context.params;
  const lotId = rawLotId.trim();
  return lotId.length > 0 && lotId.length <= 191 ? lotId : null;
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

function invalidLotId() {
  return NextResponse.json({ error: "Invalid investment lot id." }, { status: 400 });
}

function notFound() {
  return NextResponse.json({ error: "Investment lot not found." }, { status: 404 });
}
