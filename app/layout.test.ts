import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import RootLayout from "./layout";

vi.mock("next/font/google", () => ({
  Open_Sans: () => ({ style: { fontFamily: "Open Sans, Arial, sans-serif" } }),
  Space_Grotesk: () => ({ style: { fontFamily: "Space Grotesk, Arial, sans-serif" } }),
  Alegreya: () => ({ style: { fontFamily: "Alegreya, Georgia, serif" } })
}));

describe("shared font scope", () => {
  it("makes every font variable available to root theme rules and page content", () => {
    const markup = renderToStaticMarkup(createElement(RootLayout, {
      children: createElement("h1", null, "Grand Exchange")
    }));
    const htmlTag = markup.match(/<html\b[^>]*>/)?.[0];

    expect(htmlTag).toContain("--font-open-sans:Open Sans, Arial, sans-serif");
    expect(htmlTag).toContain("--font-space-grotesk:Space Grotesk, Arial, sans-serif");
    expect(htmlTag).toContain("--font-alegreya:Alegreya, Georgia, serif");
    expect(htmlTag).toContain('data-theme="dark"');
    expect(markup).toContain("<body><h1>Grand Exchange</h1></body>");
  });
});
