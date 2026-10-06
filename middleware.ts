import { NextRequest, NextResponse, type MiddlewareConfig } from "next/server";

const VISITED_COOKIE = "merchvision-home-visited";

export function middleware(request: NextRequest) {
  if (request.cookies.get(VISITED_COOKIE)?.value === "1") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/flips";
    destination.searchParams.delete("_rsc");
    return NextResponse.redirect(destination);
  }

  const response = NextResponse.next();
  // Prefetching the root route must not count as seeing the introduction.
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (request.method === "GET" && !prefetch) {
    response.cookies.set(VISITED_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 24 * 365
    });
  }
  return response;
}

export const config = {
  matcher: [
    // Returning visitors also need redirects when the root is prefetched.
    { source: "/", has: [{ type: "cookie", key: "merchvision-home-visited", value: "1" }] },
    {
      source: "/",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" }
      ]
    }
  ]
} satisfies MiddlewareConfig;
