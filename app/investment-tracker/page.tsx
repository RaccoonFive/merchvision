import React from "react";
import { redirect } from "next/navigation";
import { InvestmentTrackerPage } from "@/components/InvestmentTrackerPage";
import { getServerSession } from "@/lib/session";

export default async function InvestmentTrackerRoute() {
  const session = await getServerSession();
  if (!session) {
    redirect("/account?callbackUrl=/investment-tracker");
  }

  return <InvestmentTrackerPage />;
}
