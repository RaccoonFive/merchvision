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
    document.documentElement.dataset.theme =
      localStorage.getItem("merchvision-theme") === "light" ? "light" : "dark";
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
`;

export const metadata: Metadata = {
  title: "Merchvision - OSRS Flip Finder",
  description: "Find low-risk Old School RuneScape Grand Exchange flips."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html data-theme="dark" lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className={`${openSans.variable} ${spaceGrotesk.variable}`}>{children}</body>
    </html>
  );
}
