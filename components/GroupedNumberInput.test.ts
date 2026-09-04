import { describe, expect, it } from "vitest";
import { formatGroupedNumberInput, normalizeGroupedNumberInput } from "./GroupedNumberInput";

describe("GroupedNumberInput", () => {
  it("displays whole numbers with space group separators", () => {
    expect(formatGroupedNumberInput("10000")).toBe("10 000");
    expect(formatGroupedNumberInput("1000000")).toBe("1 000 000");
    expect(formatGroupedNumberInput("1000000000")).toBe("1 000 000 000");
  });

  it("keeps decimal filters editable and accepts grouped pasted values", () => {
    expect(formatGroupedNumberInput("10000.5")).toBe("10 000.5");
    expect(normalizeGroupedNumberInput("1 000 000")).toBe("1000000");
    expect(normalizeGroupedNumberInput("1,000,000")).toBe("1000000");
  });

  it("expands case-insensitive thousand, million, and billion suffixes", () => {
    expect(normalizeGroupedNumberInput("50k")).toBe("50000");
    expect(normalizeGroupedNumberInput("1.5M")).toBe("1500000");
    expect(normalizeGroupedNumberInput("2b")).toBe("2000000000");
  });

  it("expands shorthand exactly when the result contains a decimal", () => {
    expect(normalizeGroupedNumberInput("1.2345k")).toBe("1234.5");
    expect(normalizeGroupedNumberInput("0.000000001b")).toBe("1");
  });

  it("accepts separators before a suffix and rejects invalid input", () => {
    expect(normalizeGroupedNumberInput("50 k")).toBe("50000");
    expect(normalizeGroupedNumberInput("1,000k")).toBe("1000000");
    expect(normalizeGroupedNumberInput("10x")).toBeNull();
    expect(normalizeGroupedNumberInput("k")).toBeNull();
  });
});
