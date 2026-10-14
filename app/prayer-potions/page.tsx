import type { Metadata } from "next";
import { PrayerPotionsPage } from "@/components/PrayerPotionsPage";

export const metadata: Metadata = {
  title: "Prayer Potions · Merchvision",
  description: "Compare Prayer potion (4) and Super restore (4) by Prayer points per GP at your Prayer level."
};

export default function Page() {
  return <PrayerPotionsPage />;
}
