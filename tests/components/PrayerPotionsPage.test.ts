import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrayerPotionComparison } from "@/components/PrayerPotionsPage";
import type { PrayerPotionResponse } from "@/lib/prayerPotions";

const payload: PrayerPotionResponse = {
  data: [{ id: 2434, price: 9600, timestamp: 1000 }, { id: 3024, price: 9900, timestamp: 1000 }],
  meta: { generatedAt: "2026-10-14T12:00:00Z" }
};

function render(data = payload, level = 70, now = 1100) {
  return renderToStaticMarkup(createElement(PrayerPotionComparison, { payload: data, level, now }));
}

describe("Prayer potion comparison display", () => {
  it("names the better value and shows both ratios and dose counts", () => {
    const markup = render();
    expect(markup).toContain("Super restore (4) gives more Prayer per GP");
    expect(markup).toContain("1.00% lower cost");
    expect(markup).toContain("0.01000");
    expect(markup).toContain("GP / Prayer point");
    expect(markup).toContain("Prayer / full potion</dt><dd>96");
    expect(markup).toContain("Prayer / full potion</dt><dd>100");
    expect(markup).toContain('href="/lookup/3024"');
    expect(markup).toContain('src="/images/home/items/prayer-potion.png"');
    expect(markup).toContain('src="/images/potions/super-restore.png"');
    expect(markup).not.toContain("Some quotes are over one hour old");
  });

  it("shows partial-data and stale states without claiming a winner", () => {
    const markup = render({ ...payload, data: [payload.data[0]] });
    expect(markup).toContain("Comparison unavailable");
    expect(markup).toContain("Unavailable");
    expect(markup).toContain("no trade timestamp");
    expect(markup).not.toContain("Better value");
    expect(render(payload, 70, 5000)).toContain("Stale");
  });

  it("shows equal value and invalid-level states explicitly", () => {
    expect(render({ ...payload, data: [payload.data[0], { ...payload.data[1], price: 10_000 }] })).toContain("Both potions offer equal value");
    expect(render(payload, 0)).toContain("Enter a valid Prayer level");
  });
});
