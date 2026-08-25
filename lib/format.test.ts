import { describe, expect, it } from "vitest";
import { formatAge, formatCompact, formatGp, formatNullableGp, formatNumber, formatPercent } from "./format";

describe("market formatters", () => {
  it("formats market prices and percentages consistently", () => {
    expect(formatNumber(1234.5)).toBe("1,235");
    expect(formatGp(1234.5)).toBe("1,235 gp");
    expect(formatNullableGp(null)).toBe("Unavailable");
    expect(formatPercent(0.12345)).toBe("12.35%");
  });

  it("uses concise labels for chart ticks and quote freshness", () => {
    expect(formatCompact(12500)).toBe("12.5K");
    expect(formatAge(59)).toBe("59s");
    expect(formatAge(90)).toBe("2m");
    expect(formatAge(7200)).toBe("2h");
  });
});
