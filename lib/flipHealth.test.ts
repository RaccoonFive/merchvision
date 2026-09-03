import { describe, expect, it } from "vitest";
import { flipDataHealthMessage, flipStatusLabel } from "./flipHealth";

const completeHealth = {
  summaryAvailable: true,
  historyRequested: 10,
  historySucceeded: 10,
  historyFailed: 0,
  isPartial: false
};

describe("Flip Finder data-health labels", () => {
  it("describes every partial enrichment source", () => {
    expect(flipDataHealthMessage({
      ...completeHealth,
      summaryAvailable: false,
      historySucceeded: 8,
      historyFailed: 2,
      isPartial: true
    })).toBe(
      "Partial market data: the 24-hour market summary was unavailable and 2 of 10 item histories failed to load. Rankings use the evidence that is available."
    );
  });

  it("distinguishes unavailable, partial, stale, and current states", () => {
    const generatedAt = "2026-09-03T12:00:00.000Z";

    expect(flipStatusLabel({ dataHealth: null, error: "Failed", flips: [], generatedAt: null }))
      .toBe("Data unavailable");
    expect(flipStatusLabel({
      dataHealth: { ...completeHealth, isPartial: true },
      error: null,
      flips: [{ freshnessSeconds: 10 }],
      generatedAt
    })).toMatch(/^Partial data /);
    expect(flipStatusLabel({
      dataHealth: completeHealth,
      error: null,
      flips: [{ freshnessSeconds: 3_601 }],
      generatedAt
    })).toMatch(/^Stale quotes /);
    expect(flipStatusLabel({
      dataHealth: completeHealth,
      error: null,
      flips: [{ freshnessSeconds: 10 }],
      generatedAt
    })).toMatch(/^Updated /);
  });
});
