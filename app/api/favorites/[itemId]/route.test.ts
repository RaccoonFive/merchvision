import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "./route";

vi.mock("@/lib/session", () => ({ getRequestSession: vi.fn() }));
vi.mock("@/lib/favorites", () => ({ itemExists: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    favorite: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn()
    }
  }
}));

import { itemExists } from "@/lib/favorites";
import { prisma } from "@/lib/prisma";
import { getRequestSession } from "@/lib/session";

const mockedGetRequestSession = vi.mocked(getRequestSession);
const mockedItemExists = vi.mocked(itemExists);
const mockedFindUnique = vi.mocked(prisma.favorite.findUnique);
const mockedUpsert = vi.mocked(prisma.favorite.upsert);
const mockedDeleteMany = vi.mocked(prisma.favorite.deleteMany);
const context = (itemId: string) => ({ params: Promise.resolve({ itemId }) });

describe("/api/favorites/[itemId]", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockedGetRequestSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", name: "Trader", email: "trader@example.com" }
    } as never);
  });

  it("requires authentication", async () => {
    mockedGetRequestSession.mockResolvedValue(null);
    expect((await GET(new Request("http://localhost"), context("1"))).status).toBe(401);
    expect((await PUT(new Request("http://localhost"), context("1"))).status).toBe(401);
    expect((await DELETE(new Request("http://localhost"), context("1"))).status).toBe(401);
  });

  it("validates item ids and unknown items", async () => {
    expect((await PUT(new Request("http://localhost"), context("nope"))).status).toBe(400);
    mockedItemExists.mockResolvedValue(false);
    expect((await PUT(new Request("http://localhost"), context("99"))).status).toBe(404);
  });

  it("checks, saves, and removes favorites for the current user", async () => {
    mockedFindUnique.mockResolvedValue({ id: "favorite-1" } as never);
    mockedItemExists.mockResolvedValue(true);
    mockedUpsert.mockResolvedValue({ id: "favorite-1" } as never);
    mockedDeleteMany.mockResolvedValue({ count: 1 });

    const check = await GET(new Request("http://localhost"), context("1"));
    const save = await PUT(new Request("http://localhost"), context("1"));
    const remove = await DELETE(new Request("http://localhost"), context("1"));

    expect(await check.json()).toEqual({ favorited: true });
    expect(await save.json()).toEqual({ favorited: true });
    expect(await remove.json()).toEqual({ favorited: false });
    expect(mockedUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_itemId: { userId: "user-1", itemId: 1 } }
    }));
    expect(mockedDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", itemId: 1 } });
  });
});
