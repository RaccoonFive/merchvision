import { describe, expect, it } from "vitest";
import { searchItems } from "./itemSearch";
import type { ItemMeta } from "./types";

const items: ItemMeta[] = [
  { id: 1, name: "Dark bow", members: true },
  { id: 2, name: "Mystic boots (dark)", members: true },
  { id: 3, name: "Dark bow paint", members: true },
  { id: 4, name: "Dark", members: true }
];

describe("searchItems", () => {
  it("ranks exact then prefix then substring matches", () => {
    expect(searchItems(items, "dark").map((item) => item.name)).toEqual([
      "Dark",
      "Dark bow",
      "Dark bow paint",
      "Mystic boots (dark)"
    ]);
  });

  it("trims queries and limits results", () => {
    expect(searchItems(items, " dark ", 2)).toHaveLength(2);
    expect(searchItems(items, "  ")).toEqual([]);
  });
});
