"use client";

import { ChevronsLeft, ChevronsRight, Moon, Search, Sun, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

type AppShellProps = {
  activePath: "/" | "/lookup";
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
  children: (theme: Theme) => ReactNode;
};

export function AppShell({ activePath, title, subtitle, headerActions, children }: AppShellProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("merchvision-theme", nextTheme);
      return nextTheme;
    });
  }

  return (
    <div className={`app-frame${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/" aria-label="Merchvision home">
            <div className="brand-mark">MV</div>
            <div className="sidebar-brand-copy">
              <strong>Merchvision</strong>
              <span>Market tools</span>
            </div>
          </Link>
          <button
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((current) => !current)}
            title={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            type="button"
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <Link className={`nav-item${activePath === "/" ? " active" : ""}`} href="/" title="Flip Finder">
            <TrendingUp size={19} />
            <span>Flip Finder</span>
          </Link>
          <Link className={`nav-item${activePath === "/lookup" ? " active" : ""}`} href="/lookup" title="Item Lookup">
            <Search size={19} />
            <span>Item Lookup</span>
          </Link>
        </nav>
      </aside>

      <main className="app-shell">
        <header className="topbar">
          <div>
            <h1>{title}</h1>
            <p className="subtitle">{subtitle}</p>
          </div>
          <div className="topbar-actions">
            <button
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              type="button"
            >
              {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {headerActions}
          </div>
        </header>

        {children(theme)}
      </main>
    </div>
  );
}
