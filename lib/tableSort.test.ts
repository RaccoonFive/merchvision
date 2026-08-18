import { describe, expect, it } from "vitest";
import { sortTableRows } from "./tableSort";

describe("sortTableRows", () => {
  const rows = [
    { name: "Zamorak brew", value: 20 },
    { name: "Air rune", value: null },
    { name: "Bandos boots", value: 5 },
    { name: "Bandos boots", value: 5 }
  ];

  it("sorts numeric values in both directions while keeping unavailable values last", () => {
    expect(sortTableRows(rows, (row) => row.value, "asc").map((row) => row.value)).toEqual([5, 5, 20, null]);
    expect(sortTableRows(rows, (row) => row.value, "desc").map((row) => row.value)).toEqual([20, 5, 5, null]);
  });

  it("sorts text without changing the input order of ties", () => {
    expect(sortTableRows(rows, (row) => row.name, "asc")).toEqual([
      rows[1],
      rows[2],
      rows[3],
      rows[0]
    ]);
    expect(rows[0].name).toBe("Zamorak brew");
  });
});
