import React from "react";
import { redirect } from "next/navigation";
import { FavoritesPage } from "@/components/FavoritesPage";
import { getServerSession } from "@/lib/session";

export default async function FavoritesRoute() {
  const session = await getServerSession();
  if (!session) {
    redirect("/account?callbackUrl=/favorites");
  }

  return <FavoritesPage />;
}
