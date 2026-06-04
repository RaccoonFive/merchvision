import { describe, expect, it } from "vitest";
import ItemLookupPage from "./page";

describe("/lookup/[id]", () => {
  it("passes a valid item id into the lookup client", async () => {
    const page = await ItemLookupPage({ params: Promise.resolve({ id: "4107" }) });
    expect(page.props.initialItemId).toBe(4107);
  });

  it("does not pass invalid ids into the lookup client", async () => {
    const page = await ItemLookupPage({ params: Promise.resolve({ id: "nope" }) });
    expect(page.props.initialItemId).toBeUndefined();
  });
});
