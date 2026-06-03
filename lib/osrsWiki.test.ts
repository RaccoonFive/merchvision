import { describe, expect, it } from "vitest";
import { toWikiImageUrl } from "./osrsWiki";

describe("toWikiImageUrl", () => {
  it("converts OSRS Wiki icon filenames to absolute image URLs", () => {
    expect(toWikiImageUrl("Masori chaps (f).png")).toBe(
      "https://oldschool.runescape.wiki/images/Masori_chaps_(f).png"
    );
  });

  it("keeps already absolute URLs unchanged", () => {
    expect(toWikiImageUrl("https://example.com/item.png")).toBe("https://example.com/item.png");
  });

  it("returns undefined for missing icons", () => {
    expect(toWikiImageUrl()).toBeUndefined();
  });
});
