import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFavoriteItems } from "./favorites";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    favorite: {
      findMany: vi.fn()
    }
  }
}));
vi.mock("@/lib/osrsWiki", () => ({
  getItems: vi.fn(),
  getLatestPrices: vi.fn()
}));

import { getItems, getLatestPrices } from "@/lib/osrsWiki";
import { prisma } from "@/lib/prisma";

const mockedFindMany = vi.mocked(prisma.favorite.findMany);
const mockedGetItems = vi.mocked(getItems);
const mockedGetLatestPrices = vi.mocked(getLatestPrices);

describe("getFavoriteItems", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedFindMany.mockResolvedValue([
      { id: "favorite-1", userId: "user-1", itemId: 1, createdAt: new Date("2026-06-04T00:00:00.000Z") }
    ]);
    mockedGetItems.mockResolvedValue([{ id: 1, name: "Air rune", members: false }]);
    mockedGetLatestPrices.mockResolvedValue([{ id: 1, low: 4, high: 6 }]);
  });

  it("enriches the current user's saved item ids with live metadata and quotes", async () => {
    const favorites = await getFavoriteItems("user-1");

    expect(mockedFindMany).toHaveBeenCalledWith({ where: { userId: "user-1" }, orderBy: { createdAt: "desc" } });
    expect(favorites).toEqual([expect.objectContaining({
      favoritedAt: "2026-06-04T00:00:00.000Z",
      item: expect.objectContaining({ id: 1, name: "Air rune" }),
      quote: expect.objectContaining({ low: 4, high: 6, netProfit: 2 })
    })]);
  });
});
