import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/lib/session", () => ({ getRequestSession: vi.fn() }));
vi.mock("@/lib/favorites", () => ({ getFavoriteItems: vi.fn() }));

import { getFavoriteItems } from "@/lib/favorites";
import { getRequestSession } from "@/lib/session";

const mockedGetFavoriteItems = vi.mocked(getFavoriteItems);
const mockedGetRequestSession = vi.mocked(getRequestSession);

describe("GET /api/favorites", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requires authentication", async () => {
    mockedGetRequestSession.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/favorites"));
    expect(response.status).toBe(401);
  });

  it("returns only the current user's enriched favorites", async () => {
    mockedGetRequestSession.mockResolvedValue({
      session: { id: "session-1", userId: "user-1" },
      user: { id: "user-1", name: "Trader", email: "trader@example.com" }
    } as never);
    mockedGetFavoriteItems.mockResolvedValue([{
      favoritedAt: "2026-06-04T00:00:00.000Z",
      item: { id: 1, name: "Air rune", members: false },
      quote: {
        high: 6,
        low: 4,
        highTime: null,
        lowTime: null,
        margin: 2,
        tax: 0,
        netProfit: 2,
        roi: 0.5,
        freshnessSeconds: null
      }
    }]);

    const response = await GET(new Request("http://localhost/api/favorites"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mockedGetFavoriteItems).toHaveBeenCalledWith("user-1");
    expect(payload.data[0].item.name).toBe("Air rune");
  });
});
