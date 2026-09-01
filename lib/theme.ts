export const THEME_VALUES = ["light", "dark", "midnight", "abyssal", "blood"] as const;

export type Theme = (typeof THEME_VALUES)[number];

export const DEFAULT_THEME: Theme = "dark";

export const THEME_OPTIONS: ReadonlyArray<{ description: string; label: string; value: Theme }> = [
  { description: "Warm, bright ledger", label: "Parchment", value: "light" },
  { description: "Bronze, moss, and charcoal", label: "Gielinor Dusk", value: "dark" },
  { description: "Classic cool blue-grey", label: "Midnight Slate", value: "midnight" },
  { description: "Purple-black and amethyst", label: "Abyssal Violet", value: "abyssal" },
  { description: "Burgundy, crimson, and warm metal", label: "Blood Rune", value: "blood" }
];

export const THEME_FAVICONS: Record<Theme, string> = {
  light: "/favicon-light.svg",
  dark: "/favicon-dark.svg",
  midnight: "/favicon-midnight.svg",
  abyssal: "/favicon-abyssal.svg",
  blood: "/favicon-blood.svg"
};

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && THEME_VALUES.includes(value as Theme);
}

export function resolveTheme(value: unknown): Theme {
  return isTheme(value) ? value : DEFAULT_THEME;
}

export function themeFavicon(theme: Theme): string {
  return THEME_FAVICONS[theme];
}
