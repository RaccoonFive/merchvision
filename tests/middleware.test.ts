import { NextRequest } from "next/server";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { describe, expect, it } from "vitest";
import { config, middleware } from "@/middleware";

describe("first-visit homepage", () => {
  it("only intercepts the root and leaves unseen-visitor prefetches untouched", () => {
    const matches = (url: string, headers = {}, cookies = {}) =>
      unstable_doesMiddlewareMatch({ config, url, headers, cookies });
    expect(matches("https://merchvision.example/")).toBe(true);
    for (const path of ["/welcome", "/flips", "/investments", "/account", "/api/flips", "/images/home/grand-exchange-sunset-4k.webp"]) {
      expect(matches(`https://merchvision.example${path}`)).toBe(false);
      expect(matches(`https://merchvision.example${path}`, {}, { "merchvision-home-visited": "1" })).toBe(false);
    }
    for (const headers of [{ "next-router-prefetch": "1" }, { purpose: "prefetch" }]) {
      expect(matches("https://merchvision.example/", headers)).toBe(false);
      expect(matches("https://merchvision.example/", headers, { "merchvision-home-visited": "1" })).toBe(true);
    }
  });

  it("allows the first visit and remembers it for a year without account state", () => {
    const response = middleware(new NextRequest("https://merchvision.example/"));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("merchvision-home-visited")).toMatchObject({
      value: "1", path: "/", httpOnly: true, sameSite: "lax", secure: true,
      maxAge: 60 * 60 * 24 * 365
    });
  });

  it("redirects returning visits to Flip Finder while preserving market filters", () => {
    const response = middleware(new NextRequest("https://merchvision.example/?view=upside&_rsc=payload", {
      headers: { cookie: "merchvision-home-visited=1" }
    }));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://merchvision.example/flips?view=upside");
    expect(response.cookies.get("merchvision-home-visited")).toBeUndefined();
  });

  it("does not count link prefetches or HEAD requests as visits", () => {
    const requests: NonNullable<ConstructorParameters<typeof NextRequest>[1]>[] = [
      { headers: { "next-router-prefetch": "1" } },
      { headers: { purpose: "prefetch" } },
      { method: "HEAD" }
    ];
    for (const init of requests) {
      const response = middleware(new NextRequest("https://merchvision.example/", init));
      expect(response.headers.get("location")).toBeNull();
      expect(response.cookies.get("merchvision-home-visited")).toBeUndefined();
    }
  });

  it("shows the introduction for an unrecognized marker and supports local HTTP", () => {
    const response = middleware(new NextRequest("http://localhost:3100/", {
      headers: { cookie: "merchvision-home-visited=invalid" }
    }));
    expect(response.headers.get("location")).toBeNull();
    expect(response.cookies.get("merchvision-home-visited")).toMatchObject({ value: "1", secure: false });
  });
});
