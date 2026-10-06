import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HomePage } from "./HomePage";
import Home from "@/app/page";
import FlipsPage from "@/app/flips/page";
import WelcomePage from "@/app/welcome/page";
import { FlipFinder } from "./FlipFinder";

describe("homepage entry points", () => {
  it("renders the homepage at the root and preserves Flip Finder on its own route", () => {
    expect(Home().type).toBe(HomePage);
    expect(FlipsPage().type).toBe(FlipFinder);
  });

  it("keeps the landing page available on its own route for repeat visitors", () => {
    expect(WelcomePage().type).toBe(HomePage);
  });

  it("provides one app entrance with accessible artwork outside the tool shell", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup.match(/href="\/flips"/g)).toHaveLength(1);
    expect(markup).toMatch(/href="\/flips"[^>]*>Open app/);
    expect(markup).not.toContain("sidebar");
    expect(markup).not.toContain("Quick search");
    expect(markup).toContain('<h1 id="home-heading">');
    expect(markup).toContain('alt="An Old School RuneScape-inspired Grand Exchange beneath a golden sunset"');
    expect(markup).toContain('aria-labelledby="home-heading"');
    expect(markup).toContain("Estimates, not guarantees.");
    expect(markup).not.toContain("home-option-");
  });

  it("offers a high-quality 4K backdrop while retaining responsive image sizes", () => {
    const markup = renderToStaticMarkup(createElement(HomePage));
    expect(markup).toContain("grand-exchange-sunset-4k.webp");
    expect(markup).toContain('sizes="100vw"');
    expect(markup).toContain("w=640&amp;q=90 640w");
    expect(markup).toContain("w=3840&amp;q=90 3840w");
  });
});
