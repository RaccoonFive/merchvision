import { describe, expect, it } from "vitest";
import { validEditableInput, validFormInput } from "./InvestmentTrackerPage";

const item = { id: 1, name: "Air rune", members: false };

describe("InvestmentTrackerPage form validation", () => {
  it("builds a per-item purchase-lot payload", () => {
    expect(validFormInput(item, "100", "5")).toEqual({
      ok: true,
      data: { itemId: 1, quantity: 100, unitPricePaid: 5 }
    });
  });

  it("requires a selected suggestion and positive whole numbers", () => {
    expect(validFormInput(null, "100", "5")).toMatchObject({ ok: false });
    expect(validEditableInput("1.5", "5")).toMatchObject({ ok: false });
    expect(validEditableInput("1", "0")).toMatchObject({ ok: false });
  });
});
