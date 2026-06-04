import React from "react";
import { ItemLookup } from "@/components/ItemLookup";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ItemLookupPage({ params }: Props) {
  const { id } = await params;
  const itemId = Number(id);

  return <ItemLookup initialItemId={Number.isInteger(itemId) && itemId > 0 ? itemId : undefined} />;
}
