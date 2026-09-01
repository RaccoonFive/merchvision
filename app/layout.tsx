import type { Metadata } from "next";
import { Alegreya, Open_Sans, Space_Grotesk } from "next/font/google";
import { DEFAULT_THEME, THEME_FAVICONS, THEME_VALUES } from "@/lib/theme";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const alegreya = Alegreya({
  subsets: ["latin"],
  variable: "--font-alegreya"
});

const themeScript = `
  try {
    const savedTheme = localStorage.getItem("merchvision-theme");
    const validThemes = ${JSON.stringify(THEME_VALUES)};
    const favicons = ${JSON.stringify(THEME_FAVICONS)};
    const theme = validThemes.includes(savedTheme) ? savedTheme : "${DEFAULT_THEME}";
    document.documentElement.dataset.theme = theme;
    document.querySelector("link[data-theme-favicon]")?.setAttribute("href", favicons[theme]);
    document.documentElement.dataset.sidebarCollapsed =
      localStorage.getItem("merchvision-sidebar-collapsed") === "true" ? "true" : "false";
  } catch {
    document.documentElement.dataset.theme = "${DEFAULT_THEME}";
    document.documentElement.dataset.sidebarCollapsed = "false";
  }
`;

export const metadata: Metadata = {
  title: "Merchvision - OSRS Flip Finder",
  description: "Find low-risk Old School RuneScape Grand Exchange flips."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-sidebar-collapsed="false" data-theme="dark" lang="en" suppressHydrationWarning>
      <head>
        <link data-theme-favicon href="/favicon-dark.svg" rel="icon" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${openSans.variable} ${spaceGrotesk.variable} ${alegreya.variable}`}>{children}</body>
    </html>
  );
}
