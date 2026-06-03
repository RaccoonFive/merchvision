import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Merchvision - OSRS Flip Finder",
  description: "Find low-risk Old School RuneScape Grand Exchange flips."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
