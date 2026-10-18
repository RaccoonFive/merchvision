// @vitest-environment jsdom
import { createElement, StrictMode, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BankOverviewPage } from "@/components/BankOverviewPage";
import { analyzeBankHistory, type BankMarketResponse, type BankSnapshot } from "@/lib/bank";
import { BANK_STORAGE_KEY } from "@/lib/clientBank";

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: (theme: string) => ReactNode }) => createElement("main", null, children("midnight")) }));
vi.mock("@/components/StickyTable", () => ({ StickyTable: ({ children }: { children: ReactNode }) => children }));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
type Pending = { url: string; signal: AbortSignal; ids: number[]; body: ReturnType<typeof deferred<unknown>> };
let requests: Pending[];
const now = 1_800_000_000;
const header = "Item id\tItem name\tItem quantity\n";
const snapshot: BankSnapshot = { version: 1, importedAt: new Date(0).toISOString(), holdings: [
  { itemId: 1, name: "Export first", quantity: 10 }, { itemId: 2, name: "Export second", quantity: 2 },
  { itemId: 995, name: "Coins", quantity: 500 }, { itemId: 999, name: "Unknown item", quantity: 1 }
] };
function market(ids = [1, 2, 995, 999]): BankMarketResponse {
  return { data: ids.map((id) => ({ id, item: id < 995 ? { id, name: `Item ${id}`, members: false } : null,
    price: id < 995 ? { id, low: id * 100, lowTime: now } : null, matchedVolume: id < 995 ? 5000 : null })),
    meta: { generatedAt: new Date(now * 1000).toISOString(), pricesAvailable: true, liquidityAvailable: true } };
}
function trend(id: number, rate = 0.01) {
  const history = Array.from({ length: 91 }, (_, index) => ({ timestamp: now - (90 - index) * 86400, avgHighPrice: 1000 * Math.exp(index * rate) + 1, avgLowPrice: 1000 * Math.exp(index * rate) - 1 }));
  return { id, status: "available", periods: analyzeBankHistory(history, now) };
}
async function finish(request: Pending, body: unknown) { await act(async () => request.body.resolve(body)); }
async function fail(request: Pending) { await act(async () => request.body.reject(new Error("private failure"))); }
function paste(raw: string) {
  fireEvent.change(screen.getByLabelText("Bank Memory export"), { target: { value: raw } });
  fireEvent.click(screen.getByRole("button", { name: "Import bank" }));
}
async function mount() {
  localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(snapshot));
  const view = render(createElement(BankOverviewPage));
  await finish(requests[0], market());
  return view;
}

beforeEach(() => {
  requests = [];
  localStorage.clear();
  vi.spyOn(Date, "now").mockReturnValue(now * 1000);
  vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
    const body = deferred<unknown>();
    requests.push({ url, signal: init.signal as AbortSignal, ids: JSON.parse(init.body as string).itemIds, body });
    // Deliberately allow bodies to resolve after abort, as browser timing can.
    return Promise.resolve({ ok: true, json: () => body.promise });
  }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bank overview workflow", () => {
  it("shows pasted holdings immediately, saves them, and sends only IDs", () => {
    render(createElement(BankOverviewPage));
    paste(`${header}1\tPrivate name\t12\n995\tCoins\t500`);
    expect(screen.getByText("Private name")).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(BANK_STORAGE_KEY)!).holdings[0].quantity).toBe(12);
    expect(requests[0].ids).toEqual([1, 995]);
    const init = vi.mocked(fetch).mock.calls[0][1]!;
    expect(init.body).not.toContain("Private name");
    expect(init.body).not.toContain("quantity");
  });

  it("retains the current bank after a malformed replacement", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: "Replace import" }));
    paste(`${header}1\tBroken\t-1`);
    expect(screen.getByRole("alert").textContent).toContain("Line 2");
    expect(screen.getByRole("link", { name: "Item 1" })).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(BANK_STORAGE_KEY)!).holdings).toEqual(snapshot.holdings);
  });

  it("renders progressive trends, filters directions, changes period, and sorts unknowns last", async () => {
    await mount();
    expect(requests[1].ids).toEqual([1, 2]);
    await finish(requests[1], { data: [trend(1), trend(2, -0.01)], meta: {} });
    expect(screen.getByText("Trends complete: 2 / 2 supported items processed.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Trend direction"), { target: { value: "falling" } });
    expect(screen.queryByRole("link", { name: "Item 1" })).toBeNull();
    expect(screen.getByRole("link", { name: "Item 2" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Trend period"), { target: { value: "30" } });
    expect(screen.getByRole("button", { name: /Sort by 30d fitted GP movement/ })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Trend direction"), { target: { value: "all" } });
    fireEvent.click(screen.getByRole("button", { name: "Sort by Holding value ascending" }));
    const bodyRows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    expect(bodyRows.at(-1)!.textContent).toContain("Unknown item");
    fireEvent.change(screen.getByLabelText("Search bank"), { target: { value: "no match" } });
    expect(screen.getByText("No holdings match these filters.")).toBeTruthy();
    expect(requests).toHaveLength(2);
  });

  it("stops, ignores late responses, and resumes incomplete work", async () => {
    await mount();
    const older = requests[1];
    fireEvent.click(screen.getByRole("button", { name: "Stop analysis" }));
    expect(older.signal.aborted).toBe(true);
    await finish(older, { data: [trend(1), trend(2)], meta: {} });
    expect(screen.getByText("Trends paused: 0 / 2 supported items processed.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume analysis" }));
    expect(requests.at(-1)!.ids).toEqual([1, 2]);
    await finish(requests.at(-1)!, { data: [trend(1), trend(2)], meta: {} });
    expect(screen.getByText("Trends complete: 2 / 2 supported items processed.")).toBeTruthy();
  });

  it("retries failed histories and keeps usable values on market refresh failure", async () => {
    await mount();
    await fail(requests[1]);
    expect(screen.queryByText("private failure")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry failed items" }));
    await finish(requests.at(-1)!, { data: [trend(1), trend(2)], meta: {} });
    fireEvent.click(screen.getByRole("button", { name: "Refresh data" }));
    await fail(requests.at(-1)!);
    expect(screen.getByRole("alert").textContent).toContain("Unable to refresh");
    expect(screen.getByRole("link", { name: "Item 1" })).toBeTruthy();
    expect(screen.getByText("Trends complete: 2 / 2 supported items processed.")).toBeTruthy();
  });

  it("ignores old market bodies after replacement and clearing", async () => {
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(snapshot));
    const view = render(createElement(BankOverviewPage));
    const older = requests[0];
    fireEvent.click(screen.getByRole("button", { name: "Replace import" }));
    paste(`${header}3\tNew bank\t1`);
    const newer = requests.at(-1)!;
    expect(older.signal.aborted).toBe(true);
    await finish(newer, market([3]));
    await finish(older, market());
    expect(screen.getByRole("link", { name: "Item 3" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Item 1" })).toBeNull();
    const pendingTrend = requests.at(-1)!;
    fireEvent.click(screen.getByRole("button", { name: "Clear bank" }));
    expect(pendingTrend.signal.aborted).toBe(true);
    expect(localStorage.getItem(BANK_STORAGE_KEY)).toBeNull();
    await finish(pendingTrend, { data: [trend(3)], meta: {} });
    expect(screen.queryByRole("table")).toBeNull();
    view.unmount();
  });

  it("reports failed local saving while keeping the imported bank usable", () => {
    render(createElement(BankOverviewPage));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota"); });
    paste(`${header}995\tCoins\t100`);
    expect(screen.getByRole("alert").textContent).toContain("Bank not saved");
    expect(screen.getAllByText("100 gp").length).toBeGreaterThan(0);
  });

  it("uploads a text file and invalidates an unfinished file after clearing", async () => {
    render(createElement(BankOverviewPage));
    const file = new File([`${header}1\tUploaded\t2`], "bank.tsv");
    Object.defineProperty(file, "text", { value: () => Promise.resolve(`${header}1\tUploaded\t2`), configurable: true });
    await act(async () => fireEvent.change(screen.getByLabelText(/Or upload/), { target: { files: [file] } }));
    expect(screen.getByText("Uploaded")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Replace import" }));
    const pending = deferred<string>();
    Object.defineProperty(file, "text", { value: () => pending.promise, configurable: true });
    fireEvent.change(screen.getByLabelText(/Or upload/), { target: { files: [file] } });
    fireEvent.click(screen.getByRole("button", { name: "Clear bank" }));
    await act(async () => pending.resolve(`${header}2\tLate file\t2`));
    expect(screen.queryByText("Late file")).toBeNull();
    expect(localStorage.getItem(BANK_STORAGE_KEY)).toBeNull();
  });

  it("cancels obsolete Strict Mode requests and unmount work", async () => {
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify(snapshot));
    const view = render(createElement(StrictMode, null, createElement(BankOverviewPage)));
    const current = requests.at(-1)!;
    for (const request of requests.slice(0, -1)) expect(request.signal.aborted).toBe(true);
    await finish(current, market());
    const pending = requests.at(-1)!;
    view.unmount();
    expect(pending.signal.aborted).toBe(true);
    await finish(pending, { data: [trend(1)], meta: {} });
  });

  it("processes banks larger than a batch sequentially and retains completed batches when paused", async () => {
    const ids = Array.from({ length: 45 }, (_, index) => index + 1);
    localStorage.setItem(BANK_STORAGE_KEY, JSON.stringify({ ...snapshot, holdings: ids.map((itemId) => ({ itemId, name: `Export ${itemId}`, quantity: itemId })) }));
    render(createElement(BankOverviewPage));
    await finish(requests[0], market(ids));
    expect(requests).toHaveLength(2);
    expect(requests[1].ids).toHaveLength(20);
    expect(requests[1].ids[0]).toBe(45);
    await finish(requests[1], { data: requests[1].ids.map((id) => trend(id)), meta: {} });
    expect(requests).toHaveLength(3);
    expect(screen.getByText("Trends loading: 20 / 45 supported items processed.")).toBeTruthy();
    const interrupted = requests[2];
    fireEvent.click(screen.getByRole("button", { name: "Stop analysis" }));
    fireEvent.click(screen.getByRole("button", { name: "Resume analysis" }));
    const resumed = requests.at(-1)!;
    expect(resumed.ids).toEqual(interrupted.ids);
    await finish(interrupted, { data: interrupted.ids.map((id) => trend(id, -0.01)), meta: {} });
    expect(screen.getByText("Trends loading: 20 / 45 supported items processed.")).toBeTruthy();
    await finish(resumed, { data: resumed.ids.map((id) => trend(id)), meta: {} });
    expect(requests.at(-1)!.ids).toHaveLength(5);
    await finish(requests.at(-1)!, { data: requests.at(-1)!.ids.map((id) => trend(id)), meta: {} });
    expect(screen.getByText("Trends complete: 45 / 45 supported items processed.")).toBeTruthy();
  });
});
