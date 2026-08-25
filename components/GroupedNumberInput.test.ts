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

  it("rejects non-numeric input", () => {
    expect(normalizeGroupedNumberInput("10k")).toBeNull();
  });
});
