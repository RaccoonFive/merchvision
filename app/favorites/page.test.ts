import { beforeEach, describe, expect, it, vi } from "vitest";
import FavoritesRoute from "./page";

vi.mock("@/lib/session", () => ({ getServerSession: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/session";

const mockedGetServerSession = vi.mocked(getServerSession);
const mockedRedirect = vi.mocked(redirect);

describe("/favorites", () => {
  beforeEach(() => vi.resetAllMocks());

  it("redirects signed-out visitors to account login", async () => {
    mockedGetServerSession.mockResolvedValue(null);
    await FavoritesRoute();
    expect(mockedRedirect).toHaveBeenCalledWith("/account?callbackUrl=/favorites");
  });

  it("renders for signed-in users", async () => {
    mockedGetServerSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", name: "Trader", email: "trader@example.com" }
    } as never);
    const page = await FavoritesRoute();
    expect(page.type.name).toBe("FavoritesPage");
  });
});
