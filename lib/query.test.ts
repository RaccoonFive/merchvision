import { describe, expect, it } from "vitest";
import { parseFlipFilters } from "./query";

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
});
