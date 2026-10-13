import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { describe, expect, it } from "vitest";
import { HomePage } from "@/components/HomePage";
import Home from "@/app/page";
import FlipsPage from "@/app/flips/page";
import WelcomePage from "@/app/welcome/page";
import { FlipFinder } from "@/components/FlipFinder";

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

  it("preloads bounded responsive artwork and renders an inline preview before it loads", () => {
    const $ = load(renderToStaticMarkup(createElement(HomePage)));
    const image = $(".home-backdrop-image");
    expect(image.attr("sizes")).toBe("100vw");
    expect(image.attr("src")).toBe("/images/home/grand-exchange-sunset-1600.webp");
    expect(image.attr("srcset")).toBe("/images/home/grand-exchange-sunset-960.webp 960w, /images/home/grand-exchange-sunset-1600.webp 1600w, /images/home/grand-exchange-sunset-2560.webp 2560w");
    expect(image.attr("fetchpriority")).toBe("high");
    expect(image.attr("loading")).toBe("eager");
    expect(image.hasClass("is-loaded")).toBe(false);
    expect($(".home-backdrop").attr("style")).toContain("background-image:url(data:image/webp;base64,");
    expect($('link[rel="preload"][as="image"]').attr("imagesrcset")).toBe(image.attr("srcset"));
    expect($(".home-backdrop noscript").html()).toContain("opacity: 1");
  });

  it("keeps the scattered local item pictures decorative and outside the app entrance", () => {
    const $ = load(renderToStaticMarkup(createElement(HomePage)));
    const decoration = $(".home-floating-items");
    expect(decoration.attr("aria-hidden")).toBe("true");
    expect(decoration.find(".home-item-tile")).toHaveLength(20);
    expect(decoration.find("img")).toHaveLength(20);
    decoration.find("img").each((_, image) => {
      expect($(image).attr("alt")).toBe("");
      expect($(image).attr("src")).toMatch(/^\/images\/home\/items\/[a-z-]+\.png$/);
      expect($(image).attr("draggable")).toBe("false");
    });
    expect(decoration.find("a, button, [tabindex]")).toHaveLength(0);
    expect($('.home-page a[href="/flips"]')).toHaveLength(1);
  });
});
