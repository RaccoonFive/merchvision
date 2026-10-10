import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/AppShell";

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("@/lib/auth-client", () => ({ authClient: { useSession } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/HeaderItemSearch", () => ({ HeaderItemSearch: () => null }));

function renderShell(activePath: "/welcome" | "/flips" | "/investments" = "/investments") {
  return renderToStaticMarkup(createElement(AppShell, {
    activePath,
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
    for (const label of ["Welcome", "Flip Finder", "Investment Finder", "Investment Tracker", "Item Lookup", "Favorites", "Sign in", "Choose theme"]) {
      expect(markup).toContain(`aria-label="${label}"`);
    }
    expect(markup).toMatch(/<a[^>]*aria-current="page"[^>]*aria-label="Investment Finder"/);
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-label="Welcome"[^>]*title="Welcome"/);
    expect(markup).toContain("<span>Welcome</span>");
  });

  it("keeps Welcome and Flip Finder on separate routes with a single active link", () => {
    for (const [path, label] of [["/welcome", "Welcome"], ["/flips", "Flip Finder"]] as const) {
      const markup = renderShell(path);
      expect(markup).toMatch(new RegExp(`<a[^>]*aria-current="page"[^>]*aria-label="${label}"[^>]*href="${path}"`));
      expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
      expect(markup).toMatch(/aria-label="Flip Finder"[^>]*href="\/flips"/);
      expect(markup).toMatch(/aria-label="Merchvision home"[^>]*href="\/welcome"/);
    }
  });

  it("exposes tool identities for consistent page and navigation accents", () => {
    const markup = renderShell("/flips");
    expect(markup).toMatch(/<div[^>]*class="app-frame"[^>]*data-tool="flips"/);
    for (const tool of ["welcome", "flips", "investments", "investment-tracker", "lookup", "bosses", "favorites"]) {
      expect(markup).toMatch(new RegExp(`<a[^>]*data-tool="${tool}"[^>]*href="/${tool}"`));
    }
  });

  it("names the signed-in account control when the account summary is hidden", () => {
    useSession.mockReturnValue({ data: { user: { name: "Merchant", email: "merchant@example.com" } }, isPending: false });
    const markup = renderShell();
    expect(markup).toContain('aria-label="Your account"');
    expect(markup).toContain('aria-label="Sign out"');
  });
});
