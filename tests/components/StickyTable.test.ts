import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StickyTable } from "@/components/StickyTable";

describe("StickyTable keyboard scrolling", () => {
  it("provides a named, focusable scroll region for wide market tables", () => {
    const markup = renderToStaticMarkup(createElement(StickyTable, {
      children: createElement("table", null,
        createElement("thead", null, createElement("tr", null, createElement("th", null, "Item"))),
        createElement("tbody", null, createElement("tr", null, createElement("td", null, "Air rune")))
      )
    }));
    expect(markup).toMatch(/<div[^>]*aria-label="Market table"[^>]*class="table-scroll"[^>]*role="region"[^>]*tabindex="0"/);
    expect(markup).toContain("Air rune");
  });
});
