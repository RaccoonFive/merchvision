import { describe, expect, it } from "vitest";
import InvestmentsPage from "./page";

describe("/investments", () => {
  it("renders the public Investment Finder", () => {
    const page = InvestmentsPage();
    expect(page.type.name).toBe("InvestmentFinder");
  });
});
