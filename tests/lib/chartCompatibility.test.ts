import { createElement, Fragment } from "react";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const reactIs = require("react-is") as { isFragment(value: unknown): boolean };

describe("chart dependency compatibility", () => {
  it("recognizes React fragments so Recharts can discover grouped price series", () => {
    expect(reactIs.isFragment(createElement(Fragment, null, "price series"))).toBe(true);
  });
});
