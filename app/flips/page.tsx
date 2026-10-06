import type { Metadata } from "next";
import { FlipFinder } from "@/components/FlipFinder";

export const metadata: Metadata = { title: "Flip Finder — Merchvision" };

export default function FlipsPage() {
  return <FlipFinder />;
}
