// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BANK_STORAGE_KEY, clearBank, loadBank, saveBank } from "@/lib/clientBank";
import type { BankSnapshot } from "@/lib/bank";

const snapshot: BankSnapshot = { version: 1, importedAt: new Date(0).toISOString(), holdings: [{ itemId: 995, name: "Coins", quantity: 100 }] };
beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("browser-local bank snapshot", () => {
  it("roundtrips one snapshot, replaces it, and clears it", () => {
    expect(loadBank()).toEqual({ snapshot: null, warning: null });
    expect(saveBank(snapshot)).toBe(true);
    expect(loadBank().snapshot).toEqual(snapshot);
    const next = { ...snapshot, holdings: [{ itemId: 1, name: "Next", quantity: 1 }] };
    saveBank(next);
    expect(loadBank().snapshot).toEqual(next);
    expect(clearBank()).toBe(true);
    expect(loadBank().snapshot).toBeNull();
  });

  it.each(["{", JSON.stringify({ ...snapshot, version: 2 }), JSON.stringify({ ...snapshot, holdings: [...snapshot.holdings, ...snapshot.holdings] }), JSON.stringify({ ...snapshot, holdings: [{ itemId: 1, name: "Bad", quantity: -1 }] })])("handles invalid saved data", (raw) => {
    localStorage.setItem(BANK_STORAGE_KEY, raw);
    expect(loadBank()).toMatchObject({ snapshot: null, warning: expect.any(String) });
  });

  it("reports unavailable storage without throwing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("Blocked"); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Blocked"); });
    expect(loadBank().warning).toBeTruthy();
    expect(saveBank(snapshot)).toBe(false);
    expect(clearBank()).toBe(false);
  });
});
