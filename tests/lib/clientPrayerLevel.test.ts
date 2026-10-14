import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadPrayerLevel, savePrayerLevel } from "@/lib/clientPrayerLevel";

describe("browser Prayer level preference", () => {
  let values: Map<string, string>;

  beforeEach(() => {
    values = new Map();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value)
      }
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("uses 70 when no level is saved and restores a valid saved level", () => {
    expect(loadPrayerLevel()).toBe("70");
    savePrayerLevel("99");
    expect(values.get("merchvision-prayer-level")).toBe("99");
    expect(loadPrayerLevel()).toBe("99");
  });

  it.each(["", "0", "100", "70.5", "invalid"])("ignores invalid stored level %s", (value) => {
    values.set("merchvision-prayer-level", value);
    expect(loadPrayerLevel()).toBe("70");
  });

  it("preserves the last valid preference while the input is cleared or invalid", () => {
    savePrayerLevel("1");
    for (const value of ["", "0", "100", "70.5", "invalid"]) savePrayerLevel(value);
    expect(loadPrayerLevel()).toBe("1");
  });

  it("keeps working when access to local storage throws", () => {
    vi.stubGlobal("window", { get localStorage() { throw new Error("Storage unavailable"); } });
    expect(loadPrayerLevel()).toBe("70");
    expect(() => savePrayerLevel("77")).not.toThrow();
  });
});
