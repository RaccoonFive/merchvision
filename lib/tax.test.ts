import { describe, expect, it } from "vitest";
import { calculateGeTax } from "./tax";

describe("calculateGeTax", () => {
  it("returns zero for invalid or free sales", () => {
    expect(calculateGeTax(0)).toBe(0);
    expect(calculateGeTax(-100)).toBe(0);
  });

  it("floors the normal two percent tax", () => {
    expect(calculateGeTax(101)).toBe(2);
    expect(calculateGeTax(1_000_000)).toBe(20_000);
  });

  it("caps tax at five million gp", () => {
    expect(calculateGeTax(1_000_000_000)).toBe(5_000_000);
  });
});
