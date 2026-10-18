// @vitest-environment jsdom

import { createElement, StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlipFinder } from "@/components/FlipFinder";
import { InvestmentFinder } from "@/components/InvestmentFinder";
import { buildFlipCandidates } from "@/lib/scoring";
import type { InvestmentCandidate } from "@/lib/types";

vi.mock("@/components/AppShell", () => ({
  AppShell: ({ children, headerActions }: {
    children: (theme: "midnight") => ReactNode;
    headerActions: ReactNode;
  }) => createElement("main", null, headerActions, children("midnight"))
}));
vi.mock("@/components/StickyTable", () => ({
  StickyTable: ({ children }: { children: ReactNode }) => children
}));
vi.mock("@/components/LazyPriceHistoryChart", () => ({
  LazyPriceHistoryChart: ({ data }: { data: unknown }) =>
    createElement("pre", { "data-testid": "chart" }, JSON.stringify(data))
}));
vi.mock("@/components/ItemLookupDialog", () => ({ ItemLookupDialog: () => null }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

type PendingRequest = {
  url: string;
  signal: AbortSignal;
  body: ReturnType<typeof deferred<unknown>>;
};
let requests: PendingRequest[];

beforeEach(() => {
  requests = [];
  // Deliberately ignore abort in the mock: already-resolved responses and body
  // parsing must also be guarded, independently of fetch's cancellation support.
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const body = deferred<unknown>();
    requests.push({ url, signal: init.signal as AbortSignal, body });
    const response = new Response();
    vi.spyOn(response, "json").mockReturnValue(body.promise);
    return Promise.resolve(response);
  }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function finish(request: PendingRequest, payload: unknown) {
  await act(async () => { request.body.resolve(payload); });
}

async function fail(request: PendingRequest) {
  await act(async () => { request.body.reject(new Error("Late request failed")); });
}

function filter(search: string) {
  if (!screen.queryByLabelText("Search items")) {
    fireEvent.click(screen.getByRole("button", { name: "Filter Item" }));
  }
  fireEvent.change(screen.getByLabelText("Search items"), { target: { value: search } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

const nowSeconds = 1_700_000_000;
const items = [
  { id: 1, name: "First rune", members: false, limit: 1000 },
  { id: 2, name: "Second rune", members: false, limit: 1000 }
];
const flips = buildFlipCandidates({
  items,
  prices: items.map(({ id }) => ({ id, low: 100, high: 140, lowTime: nowSeconds, highTime: nowSeconds })),
  nowSeconds
});
const investments: InvestmentCandidate[] = items.map((item) => ({
  ...item, currentMidpoint: 120, shortTrend: 2, mediumTrend: 5, volatility: 1,
  consistency: 80, confidence: 90, shortCoverage: 100, mediumCoverage: 100,
  sampleCount: 168, matchedVolume: 10000, liquidityPercentile: 80, score: 75, warnings: []
}));

const finders = [
  {
    name: "Flip Finder", component: FlipFinder, refresh: "Refresh flips", refreshing: "Refreshing flips",
    close: "Close item details",
    payload: (index?: number) => ({ data: index === undefined ? flips : [flips[index]] })
  },
  {
    name: "Investment Finder", component: InvestmentFinder, refresh: "Refresh investments", refreshing: "Refreshing investments",
    close: "Close investment details",
    payload: (index?: number) => ({ data: index === undefined ? investments : [investments[index]] })
  }
];

describe.each(finders)("$name request lifecycle", ({ component, refresh, refreshing, close, payload }) => {
  async function mount() {
    const view = render(createElement(component));
    await finish(requests[0], payload());
    return view;
  }

  it("keeps the newest filtered results when older response bodies finish later", async () => {
    await mount();
    filter("First");
    const older = requests.at(-1)!;
    filter("Second");
    const newer = requests.at(-1)!;
    expect(older.signal.aborted).toBe(true);
    expect(newer.url).toContain("search=Second");

    await finish(newer, payload(1));
    await finish(older, payload(0));
    expect(screen.getByRole("link", { name: "Second rune" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "First rune" })).toBeNull();
    expect(screen.getByRole("button", { name: refresh }).hasAttribute("disabled")).toBe(false);
  });

  it("ignores stale failures and keeps loading until the current request finishes", async () => {
    await mount();
    filter("First");
    const older = requests.at(-1)!;
    filter("Second");
    const newer = requests.at(-1)!;
    await fail(older);
    expect(screen.queryByText("Late request failed")).toBeNull();
    expect(screen.getByRole("button", { name: refreshing }).hasAttribute("disabled")).toBe(true);
    await finish(newer, payload(1));
    expect(screen.getByRole("button", { name: refresh }).hasAttribute("disabled")).toBe(false);
  });

  it("reports current failures, supports manual retry, and aborts refresh on unmount", async () => {
    const view = await mount();
    fireEvent.click(screen.getByRole("button", { name: refresh }));
    await fail(requests.at(-1)!);
    expect(screen.getByText(/Late request failed/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: refresh }));
    expect(screen.queryByText(/Late request failed/)).toBeNull();
    await finish(requests.at(-1)!, payload());
    fireEvent.click(screen.getByRole("button", { name: refresh }));
    const pending = requests.at(-1)!;
    view.unmount();
    expect(pending.signal.aborted).toBe(true);
    await finish(pending, payload(0));
  });

  it("cancels superseded charts and prevents old chart data replacing the selection", async () => {
    await mount();
    fireEvent.click(screen.getByRole("row", { name: "Select First rune" }));
    const older = requests.at(-1)!;
    expect(older.url).toContain("/api/items/1/timeseries");
    fireEvent.click(screen.getByRole("row", { name: "Select Second rune" }));
    const newer = requests.at(-1)!;
    expect(older.signal.aborted).toBe(true);
    expect(newer.url).toContain("/api/items/2/timeseries");
    await finish(newer, { data: [{ timestamp: nowSeconds, avgHighPrice: 222, avgLowPrice: 222 }] });
    await finish(older, { data: [{ timestamp: nowSeconds, avgHighPrice: 111, avgLowPrice: 111 }] });
    expect(screen.getByTestId("chart").textContent).toContain("222");
    expect(screen.getByTestId("chart").textContent).not.toContain("111");
  });

  it("ignores stale chart failures and aborts charts when details close or unmount", async () => {
    const view = await mount();
    fireEvent.click(screen.getByRole("row", { name: "Select First rune" }));
    const older = requests.at(-1)!;
    fireEvent.click(screen.getByRole("row", { name: "Select Second rune" }));
    const newer = requests.at(-1)!;
    await fail(older);
    expect(screen.getByRole("status", { name: "Loading chart..." })).toBeTruthy();
    expect(screen.queryByText("Late request failed")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: close }));
    expect(newer.signal.aborted).toBe(true);
    await finish(newer, { data: [] });
    fireEvent.click(screen.getByRole("row", { name: "Select Second rune" }));
    expect(screen.getByRole("status", { name: "Loading chart..." })).toBeTruthy();
    const reopened = requests.at(-1)!;
    view.unmount();
    expect(reopened.signal.aborted).toBe(true);
    await fail(reopened);
  });

  it("survives Strict Mode effect cleanup without accepting the abandoned request", async () => {
    const view = render(createElement(StrictMode, null, createElement(component)));
    expect(requests).toHaveLength(2);
    expect(requests[0].signal.aborted).toBe(true);
    expect(requests[1].signal.aborted).toBe(false);
    await finish(requests[1], payload(1));
    await finish(requests[0], payload(0));
    expect(screen.getByRole("link", { name: "Second rune" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "First rune" })).toBeNull();
    view.unmount();
    expect(requests[1].signal.aborted).toBe(true);
  });
});

it("keeps High Upside results and metadata when a previous Reliable response arrives late", async () => {
  render(createElement(FlipFinder));
  const reliable = requests[0];
  fireEvent.click(screen.getByRole("tab", { name: "High Upside" }));
  const upside = requests.at(-1)!;
  expect(reliable.signal.aborted).toBe(true);
  expect(upside.url).toContain("view=upside");
  await finish(upside, { data: [], meta: { modelVersion: "current-upside" } });
  await finish(reliable, { data: flips, meta: { modelVersion: "old-reliable" } });
  expect(screen.getByRole("tab", { name: "High Upside" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByText(/Model current-upside/)).toBeTruthy();
  expect(screen.queryByText(/old-reliable/)).toBeNull();
  expect(screen.queryByRole("link", { name: "First rune" })).toBeNull();
});
