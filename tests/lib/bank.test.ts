import { describe, expect, it } from "vitest";
import { analyzeBankHistory, BANK_MAX_BYTES, BANK_MAX_ROWS, BANK_PERIODS, bankGpMovement, isBankSnapshot, parseBankImport, sumBankValues, valueBank, type BankHolding, type BankMarketItem } from "@/lib/bank";
import { sortTableRows } from "@/lib/tableSort";

const header = "Item id\tItem name\tItem quantity";
const now = 1_800_000_000;
const day = 86400;
function history(rate = 0.005) {
  return Array.from({ length: 91 }, (_, index) => ({ timestamp: now - (90 - index) * day,
    avgHighPrice: 1000 * Math.exp(rate * index) + 1, avgLowPrice: 1000 * Math.exp(rate * index) - 1 }));
}

describe("Bank Memory imports", () => {
  it("accepts BOM, blank lines, CRLF, duplicates, and placeholders", () => {
    const result = parseBankImport(`\uFEFF\r\n${header}\r\n4151\tWhip\t2\r\n\r\n4151\tOther name\t3\r\n995\tCoins\t100\r\n42\tPlaceholder\t0\r\n`, new Date(0));
    expect(result).toEqual({ ignored: 1, snapshot: { version: 1, importedAt: new Date(0).toISOString(), holdings: [
      { itemId: 4151, name: "Whip", quantity: 5 }, { itemId: 995, name: "Coins", quantity: 100 }
    ] } });
    if ("snapshot" in result) expect(isBankSnapshot(result.snapshot)).toBe(true);
  });

  it.each(["-1\tBad\t1", "1.5\tBad\t1", "1\tBad\t1e3", "1\tBad\t-1", "1\t\t1", "1\tBad\t1\textra", "1\tBad", "2147483648\tBad\t1", "1\tBad\t2147483648"])("rejects malformed rows with line numbers: %s", (row) => {
    expect(parseBankImport(`${header}\n\n${row}`)).toMatchObject({ error: expect.stringContaining("Line 3:") });
  });

  it("rejects missing headers, empty banks, byte/row limits, and combined overflow", () => {
    expect(parseBankImport("4151\tWhip\t1")).toHaveProperty("error");
    expect(parseBankImport(`${header}\n1\tEmpty\t0`)).toHaveProperty("error");
    expect(parseBankImport("é".repeat(BANK_MAX_BYTES / 2 + 1))).toMatchObject({ error: expect.stringContaining("2 MiB") });
    expect(parseBankImport(`${header}\n${"1\tItem\t1\n".repeat(BANK_MAX_ROWS + 1)}`)).toMatchObject({ error: expect.stringContaining("row limit") });
    expect(parseBankImport(`${header}\n1\tItem\t2147483647\n1\tItem\t1`)).toMatchObject({ error: expect.stringContaining("combined quantity") });
  });
});

describe("bank valuation", () => {
  const holdings: BankHolding[] = [
    { itemId: 995, name: "Coins", quantity: 1000 }, { itemId: 1, name: "Export name", quantity: 10 },
    { itemId: 2, name: "Untradeable", quantity: 1 }, { itemId: 3, name: "Unpriced", quantity: 5 }
  ];
  const market: BankMarketItem[] = [
    { id: 1, item: { id: 1, name: "Canonical name", members: false }, price: { id: 1, low: 100, lowTime: now - 3601, high: 999 }, matchedVolume: 100 },
    { id: 3, item: { id: 3, name: "Unpriced", members: false }, price: null, matchedVolume: null }
  ];

  it("uses low quotes, preserves unknown items, taxes per unit, and counts coins at face value", () => {
    const rows = valueBank(holdings, market, now);
    expect(rows[0]).toMatchObject({ grossValue: 1000, netValue: 1000, stale: false });
    expect(rows[1]).toMatchObject({ name: "Canonical name", grossValue: 1000, netValue: 980, stale: true });
    expect(rows[1].warnings).toContain("Thin 24h matched volume");
    expect(rows[2]).toMatchObject({ name: "Untradeable", grossValue: null, warnings: ["No GE mapping"] });
    expect(rows[3]).toMatchObject({ grossValue: null, warnings: ["Price unavailable"] });
    expect(sumBankValues(rows, "grossValue")).toBe(2000);
    expect(sumBankValues(rows, "netValue")).toBe(1980);
    const sorted = sortTableRows(rows, (row) => row.grossValue, "asc");
    expect(sorted.at(-1)?.itemId).toBe(3);
  });

  it("marks undated quotes and rejects unsafe holding values and totals", () => {
    const undated = valueBank(holdings, [{ ...market[0], price: { id: 1, low: 100 } }], now);
    expect(undated[1]).toMatchObject({ stale: true, quoteTime: null });
    const huge = valueBank([{ itemId: 1, name: "Huge", quantity: 2147483647 }], [{ ...market[0], price: { id: 1, low: 2147483647 } }], now)[0];
    expect(huge.grossValue).toBeNull();
    expect(huge.warnings).toContain("Value exceeds safe arithmetic limit");
    expect(sumBankValues([{ ...huge, grossValue: Number.MAX_SAFE_INTEGER }, { ...huge, grossValue: 1 }], "grossValue")).toBeNull();
  });
});

describe("sustained bank trends", () => {
  it.each(BANK_PERIODS)("fits both directions over %i days with historical GP movement", (days) => {
    const rising = analyzeBankHistory(history(), now)[days];
    expect(rising).toMatchObject({ status: "available", direction: "rising", consistency: 1, coverage: 1 });
    expect(rising.change).toBeCloseTo(Math.expm1(0.005 * days));
    expect(bankGpMovement(rising, 10)).toBeCloseTo(rising.unitGpChange! * 10);
    const falling = analyzeBankHistory(history(-0.005), now)[days];
    expect(falling).toMatchObject({ status: "available", direction: "falling", consistency: 1 });
    expect(falling.change).toBeCloseTo(Math.expm1(-0.005 * days));
  });

  it("classifies constant and exact ±1% fitted changes as flat", () => {
    expect(analyzeBankHistory(history(0), now)[7].direction).toBe("flat");
    for (const change of [0.01, -0.01]) expect(analyzeBankHistory(history(Math.log1p(change) / 7), now)[7].direction).toBe("flat");
  });

  it("reports mixed movement when the fitted rise lacks 60% daily agreement", () => {
    const noisy = history().map((point, index) => {
      const price = 1000 * Math.exp(index * 0.005 + (index % 2 ? 0.15 : 0));
      return { ...point, avgHighPrice: price + 1, avgLowPrice: price - 1 };
    });
    expect(analyzeBankHistory(noisy, now)[90]).toMatchObject({ direction: "mixed", status: "available" });
  });

  it("requires coverage, span, fresh samples, and complete midpoint pairs", () => {
    const full = history();
    expect(analyzeBankHistory(full.filter((_, index) => index % 2), now)[30].status).toBe("insufficient");
    expect(analyzeBankHistory(full.slice(-5), now)[7].status).toBe("insufficient");
    expect(analyzeBankHistory(full.map((point) => ({ ...point, timestamp: point.timestamp - 3 * day })), now)[7].status).toBe("stale");
    expect(analyzeBankHistory(full.map((point) => ({ ...point, avgLowPrice: undefined })), now)[7].status).toBe("insufficient");
    expect(analyzeBankHistory([], now)[90]).toMatchObject({ status: "insufficient", latestSampleTime: null });
  });

  it("ignores future samples and duplicate days without inflating coverage", () => {
    const points = history().slice(-3);
    const duplicated = [...points, ...points, { timestamp: now + day, avgHighPrice: 100, avgLowPrice: 100 }];
    expect(analyzeBankHistory(duplicated, now)[7]).toMatchObject({ sampleCount: 3, status: "insufficient" });
    expect(bankGpMovement({ ...analyzeBankHistory(history(), now)[7], unitGpChange: Number.MAX_SAFE_INTEGER }, 2)).toBeNull();
  });
});
