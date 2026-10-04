import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ authClient: { useSession } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/HeaderItemSearch", () => ({ HeaderItemSearch: () => null }));

function renderShell() {
  return renderToStaticMarkup(createElement(AppShell, {
    activePath: "/investments",
    title: "Investment Finder",
    children: () => null
  }));
}

describe("AppShell compact navigation accessibility", () => {
  beforeEach(() => {
    useSession.mockReturnValue({ data: null, isPending: false });
  });

  it("names navigation and theme controls when compact styles hide their text", () => {
    const markup = renderShell();
    for (const label of ["Flip Finder", "Investment Finder", "Investment Tracker", "Item Lookup", "Favorites", "Sign in", "Choose theme"]) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*aria-label="Investment Finder"/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it("names the signed-in account control when the account summary is hidden", () => {
    useSession.mockReturnValue({ data: { user: { name: "Merchant", email: "merchant@example.com" } }, isPending: false });
    const markup = renderShell();
    expect(markup).toContain('aria-label="Your account"');
    expect(markup).toContain('aria-label="Sign out"');
  });
});
