"use client";

import { BriefcaseBusiness, ChartNoAxesCombined, ChevronsLeft, ChevronsRight, LogIn, LogOut, Moon, Search, Star, Sun, TrendingUp, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LogoMark } from "@/components/LogoMark";

export type Theme = "light" | "dark";

type AppShellProps = {
  activePath: "/" | "/investments" | "/investment-tracker" | "/lookup" | "/favorites" | "/account";
  title: string;
  subtitle: string;
  headerActions?: ReactNode;
  children: (theme: Theme) => ReactNode;
};

export function AppShell({ activePath, title, subtitle, headerActions, children }: AppShellProps) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
    setSidebarCollapsed(document.documentElement.dataset.sidebarCollapsed === "true");
  }, []);

  function toggleTheme() {
    setTheme((current) => {
      const nextTheme = current === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("merchvision-theme", nextTheme);
      document.querySelector("link[data-theme-favicon]")?.setAttribute(
        "href",
        nextTheme === "light" ? "/favicon-light.svg" : "/favicon-dark.svg"
      );
      return nextTheme;
    });
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const nextCollapsed = !current;
      document.documentElement.dataset.sidebarCollapsed = String(nextCollapsed);
      window.localStorage.setItem("merchvision-sidebar-collapsed", String(nextCollapsed));
      return nextCollapsed;
    });
  }

  async function signOut() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className={`app-frame${sidebarCollapsed ? " sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/" aria-label="Merchvision home">
            <LogoMark className="brand-mark" />
            <div className="sidebar-brand-copy">
              <strong>Merchvision</strong>
            </div>
          </Link>
          <button
            aria-expanded={!sidebarCollapsed}
            aria-label={sidebarCollapsed ? "Expand navigation" : "Collapse navigation"}
            className="sidebar-toggle"
            onClick={toggleSidebar}
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
          <Link className={`nav-item${activePath === "/investments" ? " active" : ""}`} href="/investments" title="Investment Finder">
            <ChartNoAxesCombined size={19} />
            <span>Investment Finder</span>
          </Link>
          <Link className={`nav-item${activePath === "/investment-tracker" ? " active" : ""}`} href="/investment-tracker" title="Investment Tracker">
            <BriefcaseBusiness size={19} />
            <span>Investment Tracker</span>
          </Link>
          <Link className={`nav-item${activePath === "/lookup" ? " active" : ""}`} href="/lookup" title="Item Lookup">
            <Search size={19} />
            <span>Item Lookup</span>
          </Link>
          <Link className={`nav-item${activePath === "/favorites" ? " active" : ""}`} href="/favorites" title="Favorites">
            <Star size={19} />
            <span>Favorites</span>
          </Link>
        </nav>

        <div className="sidebar-account">
          {session?.user ? (
            <>
              <Link className={`account-summary${activePath === "/account" ? " active" : ""}`} href="/account" title={session.user.displayUsername ?? session.user.username ?? session.user.email}>
                <User size={18} />
                <span>
                  <strong>{session.user.displayUsername ?? session.user.username ?? session.user.name}</strong>
                  <small>{session.user.email}</small>
                </span>
              </Link>
              <button aria-label="Sign out" className="account-action" onClick={signOut} title="Sign out" type="button">
                <LogOut size={18} />
                <span>Sign out</span>
              </button>
            </>
          ) : (
            <Link className={`account-action${activePath === "/account" ? " active" : ""}`} href="/account" title="Sign in">
              <LogIn size={18} />
              <span>{sessionPending ? <LoadingSpinner label="Checking account..." size="small" variant="button" /> : "Sign in"}</span>
            </Link>
          )}
        </div>
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
