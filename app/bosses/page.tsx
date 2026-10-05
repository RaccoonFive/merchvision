import type { Metadata } from "next";
import { BossesPage } from "@/components/BossesPage";

export const metadata: Metadata = { title: "Bosses · Merchvision" };

export default function Page() {
  return <BossesPage />;
}
