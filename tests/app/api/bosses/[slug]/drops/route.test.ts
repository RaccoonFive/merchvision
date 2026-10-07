import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/bosses/[slug]/drops/route";
import { getBossLoot, getItems, getLatestPrices } from "@/lib/osrsWiki";

vi.mock("@/lib/osrsWiki", () => ({ getBossLoot: vi.fn(), getItems: vi.fn(), getLatestPrices: vi.fn() }));

const request = (slug: string) => GET(new Request(`http://localhost/api/bosses/${slug}/drops`), { params: Promise.resolve({ slug }) });

describe("GET /api/bosses/[slug]/drops", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getBossLoot).mockResolvedValue({ drops: [], sources: [], notes: [], partial: false, fetchedAt: "2026-10-04T12:00:00Z" });
    vi.mocked(getItems).mockResolvedValue([]);
    vi.mocked(getLatestPrices).mockResolvedValue([]);
  });

  it("returns public drops with one mapping and one latest snapshot", async () => {
    const response = await request("zulrah");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ data: [], meta: { lootPartial: false, pricesPartial: false } });
    expect(getItems).toHaveBeenCalledTimes(1);
    expect(getLatestPrices).toHaveBeenCalledTimes(1);
  });

  it("validates identifiers before upstream requests", async () => {
    for (const slug of ["Vorkath", "../../secrets", "a".repeat(81)]) expect((await request(slug)).status).toBe(400);
    expect((await request("not-a-boss")).status).toBe(404);
    expect(getBossLoot).not.toHaveBeenCalled();
    expect(getItems).not.toHaveBeenCalled();
  });

  it("returns usable loot when market services fail", async () => {
    vi.mocked(getItems).mockRejectedValue(new Error("Unavailable"));
    vi.mocked(getLatestPrices).mockRejectedValue(new Error("Unavailable"));
    const response = await request("vorkath");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ meta: { pricesPartial: true } });
  });

  it("does not expose upstream errors", async () => {
    vi.mocked(getBossLoot).mockRejectedValue(new Error("internal upstream credentials"));
    const response = await request("vorkath");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Unable to load boss drops. Please try again." });
  });
});
