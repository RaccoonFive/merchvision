import type { Metadata } from "next";
import { BankOverviewPage } from "@/components/BankOverviewPage";

export const metadata: Metadata = {
  title: "Bank Overview · Merchvision",
  description: "Import your Bank Memory export to review bank value and sustained 7-, 30-, and 90-day market trends."
};

export default function Page() {
  return <BankOverviewPage />;
}
