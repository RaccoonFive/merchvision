import { NextResponse } from "next/server";
import { itemExists } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

type Context = {
  params: Promise<{ itemId: string }>;
};

export async function GET(request: Request, context: Context) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const itemId = await parseItemId(context);
    if (!itemId) return invalidItemId();

    const favorite = await prisma.favorite.findUnique({
      where: { userId_itemId: { userId: session.user.id, itemId } }
    });
    return NextResponse.json({ favorited: Boolean(favorite) });
  } catch (error) {
    return serverError(error, "Unable to check favorite.");
  }
}

export async function PUT(request: Request, context: Context) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const itemId = await parseItemId(context);
    if (!itemId) return invalidItemId();
    if (!(await itemExists(itemId))) {
      return NextResponse.json({ error: "Item not found." }, { status: 404 });
    }

    await prisma.favorite.upsert({
      where: { userId_itemId: { userId: session.user.id, itemId } },
      update: {},
      create: { userId: session.user.id, itemId }
    });
    return NextResponse.json({ favorited: true });
  } catch (error) {
    return serverError(error, "Unable to save favorite.");
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const session = await getRequestSession(request);
    if (!session) return unauthorized();

    const itemId = await parseItemId(context);
    if (!itemId) return invalidItemId();

    await prisma.favorite.deleteMany({ where: { userId: session.user.id, itemId } });
    return NextResponse.json({ favorited: false });
  } catch (error) {
    return serverError(error, "Unable to remove favorite.");
  }
}

async function parseItemId(context: Context): Promise<number | null> {
  const { itemId: rawItemId } = await context.params;
  const itemId = Number(rawItemId);
  return Number.isInteger(itemId) && itemId > 0 ? itemId : null;
}

function unauthorized() {
  return NextResponse.json({ error: "Authentication required." }, { status: 401 });
}

function invalidItemId() {
  return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
}

function serverError(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : fallback },
    { status: 500 }
  );
}
