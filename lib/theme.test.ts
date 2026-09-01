import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_OPTIONS, THEME_VALUES, isTheme, resolveTheme, themeFavicon } from "./theme";

describe("theme catalog", () => {
  it("recognizes every selectable theme, including the two dark additions", () => {
    expect(THEME_VALUES).toEqual(["light", "dark", "midnight", "abyssal", "blood"]);
    expect(THEME_OPTIONS.map((option) => option.value)).toEqual(THEME_VALUES);
    expect(THEME_VALUES.every(isTheme)).toBe(true);
  });

  it("keeps Gielinor Dusk as the fallback for missing or unknown saved values", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(resolveTheme(undefined)).toBe("dark");
    expect(resolveTheme("unknown-theme")).toBe("dark");
    expect(resolveTheme("abyssal")).toBe("abyssal");
    expect(resolveTheme("blood")).toBe("blood");
  });

  it("maps every theme to its matching favicon", () => {
    for (const theme of THEME_VALUES) {
      expect(themeFavicon(theme)).toBe(`/favicon-${theme}.svg`);
    }
  });
});
