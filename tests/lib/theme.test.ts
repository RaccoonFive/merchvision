import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_OPTIONS, THEME_VALUES, isTheme, resolveTheme, themeFavicon } from "@/lib/theme";

describe("theme catalog", () => {
  it("recognizes every selectable theme, including the two dark additions", () => {
    expect(THEME_VALUES).toEqual(["light", "dark", "midnight", "abyssal", "blood"]);
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual(THEME_VALUES);
    expect(THEME_VALUES.every(isTheme)).toBe(true);
  });

  it("uses Midnight Slate for missing or unknown saved values and preserves saved themes", () => {
    expect(DEFAULT_THEME).toBe("midnight");
    expect(resolveTheme(undefined)).toBe("midnight");
    expect(resolveTheme(null)).toBe("midnight");
    expect(resolveTheme("unknown-theme")).toBe("midnight");
    expect(resolveTheme("dark")).toBe("dark");
    expect(resolveTheme("abyssal")).toBe("abyssal");
    expect(resolveTheme("blood")).toBe("blood");
  });

  it("maps every theme to its matching favicon", () => {
    for (const theme of THEME_VALUES) {
      expect(themeFavicon(theme)).toBe(`/favicon-${theme}.svg`);
    }
  });
});
