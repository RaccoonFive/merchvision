import { NextResponse } from "next/server";
import { getFavoriteItems } from "@/lib/favorites";
import { getRequestSession } from "@/lib/session";

export async function GET(request: Request) {
  try {
    const session = await getRequestSession(request);
    if (!session) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    return NextResponse.json({ data: await getFavoriteItems(session.user.id) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load favorites." },
      { status: 500 }
    );
  }
}
