import { describe, expect, it } from "vitest";
import { safeCallbackUrl } from "./redirect";

describe("safeCallbackUrl", () => {
  it("accepts internal paths", () => {
    expect(safeCallbackUrl("/favorites")).toBe("/favorites");
    expect(safeCallbackUrl("/lookup/4107")).toBe("/lookup/4107");
  });

  it("rejects external and protocol-relative paths", () => {
    expect(safeCallbackUrl("https://example.com")).toBe("/");
    expect(safeCallbackUrl("//example.com")).toBe("/");
    expect(safeCallbackUrl("/\\example.com")).toBe("/");
    expect(safeCallbackUrl()).toBe("/");
  });
});
