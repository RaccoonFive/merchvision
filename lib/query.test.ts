import { describe, expect, it } from "vitest";
import { parseFlipFilters, parseFlipView, parseUpsideFlipFilters } from "./query";

describe("parseFlipFilters", () => {
  it("includes weak data by default", () => {
    expect(parseFlipFilters(new URLSearchParams())).toMatchObject({
      includeStale: true,
      includeLowConfidence: true
    });
  });

  it("allows weak data to be explicitly excluded", () => {
    expect(
      parseFlipFilters(new URLSearchParams("includeStale=false&includeLowConfidence=false"))
    ).toMatchObject({
      includeStale: false,
      includeLowConfidence: false
    });
  });

  it("accepts repeatability sorting values", () => {
    expect(parseFlipFilters(new URLSearchParams("sort=typicalProfit")).sort).toBe("typicalProfit");
    expect(parseFlipFilters(new URLSearchParams("sort=expectedGpPerHour")).sort).toBe("expectedGpPerHour");
  });

  it("defaults to Reliable and accepts the explicit High Upside view", () => {
    expect(parseFlipView(new URLSearchParams())).toBe("reliable");
    expect(parseFlipView(new URLSearchParams("view=upside"))).toBe("upside");
    expect(parseFlipView(new URLSearchParams("view=unknown"))).toBe("reliable");
  });

  it("parses High Upside filters and sorting", () => {
    expect(parseUpsideFlipFilters(new URLSearchParams(
      "minExpectedGpPerHour=500000&minOpportunityConfidence=60&sort=capturableProfit"
    ))).toMatchObject({
      minExpectedGpPerHour: 500_000,
      minOpportunityConfidence: 60,
      sort: "capturableProfit"
    });
  });
});
