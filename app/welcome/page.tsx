import type { Metadata } from "next";
import { HomePage } from "@/components/HomePage";

export const metadata: Metadata = {
  title: "Welcome — Merchvision",
  description: "Explore Old School RuneScape markets with explainable flip research, item insights, and a private investment tracker."
};

export default function WelcomePage() {
  return <HomePage />;
}
