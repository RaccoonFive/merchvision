import type { Metadata } from "next";
import { Open_Sans, Space_Grotesk } from "next/font/google";
import "./globals.css";

const openSans = Open_Sans({
  subsets: ["latin"],
  variable: "--font-open-sans"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk"
});

const themeScript = `
  try {
    const theme = localStorage.getItem("merchvision-theme") === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
    document.querySelector("link[data-theme-favicon]")?.setAttribute(
      "href",
      theme === "light" ? "/favicon-light.svg" : "/favicon-dark.svg"
    );
    document.documentElement.dataset.sidebarCollapsed =
      localStorage.getItem("merchvision-sidebar-collapsed") === "true" ? "true" : "false";
  } catch {
    document.documentElement.dataset.theme = "dark";
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
      <body className={`${openSans.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
