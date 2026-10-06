import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SessionPlanner, SessionPlanResults } from "./SessionPlanner";
import { buildSessionPlan } from "@/lib/sessionPlanner";

vi.mock("@/components/AppShell", () => ({ AppShell: ({ children }: { children: (theme: string) => unknown }) => children("dark") }));

describe("session planner accessible states", () => {
  it("labels all inputs, leaves budget empty, and disables planning while evidence loads", () => {
    const markup = renderToStaticMarkup(createElement(SessionPlanner));
    for (const id of ["session-budget", "session-slots", "session-length", "session-checks", "session-members"]) {
      expect(markup).toContain(`for="${id}"`);
      expect(markup).toContain(`id="${id}"`);
    }
    expect(markup).toContain('value=""');
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*type="submit"/);
    expect(markup).toContain("Loading Reliable market evidence");
  });

  it("explains empty plans and clearly marks outdated results", () => {
    const plan = buildSessionPlan([], { budget: 10_000, slots: 2, sessionMinutes: 60, checkIntervalMinutes: 15, members: "all" }, 1_700_000_000);
    const markup = renderToStaticMarkup(createElement(SessionPlanResults, { plan, outdated: true, plannedAt: "2026-10-05T12:00:00Z" }));
    expect(markup).toContain("No supported allocation fits");
    expect(markup).toContain("This plan is out of date");
    expect(markup).toContain("10,000 gp");
    expect(markup).toContain("if both legs fill");
    expect(markup).toContain("not guaranteed fills or returns");
  });
});
