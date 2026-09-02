"use client";

import { BriefcaseBusiness, ChartNoAxesCombined, Check, ChevronDown, ChevronsLeft, ChevronsRight, LogIn, LogOut, Palette, Search, Star, TrendingUp, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { LogoMark } from "@/components/LogoMark";
import { HeaderItemSearch } from "@/components/HeaderItemSearch";
import { DEFAULT_THEME, THEME_OPTIONS, resolveTheme, themeFavicon, type Theme } from "@/lib/theme";

export type { Theme } from "@/lib/theme";

type AppShellProps = {
  activePath: "/" | "/investments" | "/investment-tracker" | "/lookup" | "/favorites" | "/account";
  title: string;
  headerActions?: ReactNode;
  children: (theme: Theme) => ReactNode;
};

export function AppShell({ activePath, title, headerActions, children }: AppShellProps) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themePickerRef = useRef<HTMLDivElement>(null);
  const themeTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setTheme(resolveTheme(document.documentElement.dataset.theme));
    setSidebarCollapsed(document.documentElement.dataset.sidebarCollapsed === "true");
  }, []);

  useEffect(() => {
    function closeThemeMenu(event: PointerEvent) {
      if (!themePickerRef.current?.contains(event.target as Node)) setThemeMenuOpen(false);
    }

    document.addEventListener("pointerdown", closeThemeMenu);
    return () => document.removeEventListener("pointerdown", closeThemeMenu);
  }, []);

  function selectTheme(nextTheme: Theme) {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("merchvision-theme", nextTheme);
    document.querySelector("link[data-theme-favicon]")?.setAttribute("href", themeFavicon(nextTheme));
    setTheme(nextTheme);
    setThemeMenuOpen(false);
    themeTriggerRef.current?.focus();
  }

  function openThemeMenu() {
    setThemeMenuOpen(true);
    requestAnimationFrame(() => {
      themePickerRef.current
        ?.querySelector<HTMLButtonElement>(`[role="option"][data-theme-option="${theme}"]`)
        ?.focus();
    });
  }

  function navigateThemeMenu(event: KeyboardEvent<HTMLDivElement>) {
    const options = Array.from(themePickerRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
    if (options.length === 0) return;

    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % options.length;
    if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + options.length) % options.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = options.length - 1;
    if (event.key === "Escape") {
      event.preventDefault();
      setThemeMenuOpen(false);
      themeTriggerRef.current?.focus();
      return;
    }
    if (event.key === "Tab") setThemeMenuOpen(false);
    if (nextIndex !== null) {
      event.preventDefault();
      options[nextIndex]?.focus();
    }
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
          <h1>{title}</h1>
          <HeaderItemSearch />
          <div className="topbar-actions">
            <div className="theme-picker" ref={themePickerRef}>
              <button
                aria-controls="theme-menu"
                aria-expanded={themeMenuOpen}
                aria-haspopup="listbox"
                className="theme-picker-trigger"
                onClick={() => themeMenuOpen ? setThemeMenuOpen(false) : openThemeMenu()}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault();
                    openThemeMenu();
                  }
                }}
                ref={themeTriggerRef}
                title="Choose theme"
                type="button"
              >
                <Palette aria-hidden="true" size={15} />
                <span>{THEME_OPTIONS.find((option) => option.value === theme)?.label}</span>
                <ChevronDown aria-hidden="true" className={themeMenuOpen ? "open" : ""} size={14} />
              </button>
              {themeMenuOpen ? (
                <div aria-label="Choose theme" className="theme-menu" id="theme-menu" onKeyDown={navigateThemeMenu} role="listbox">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      aria-selected={theme === option.value}
                      className={theme === option.value ? "selected" : ""}
                      data-theme-option={option.value}
                      key={option.value}
                      onClick={() => selectTheme(option.value)}
                      role="option"
                      type="button"
                    >
                      <span aria-hidden="true" className={`theme-preview theme-preview-${option.value}`} />
                      <span className="theme-option-copy">
                        <strong>{option.label}</strong>
                        <small>{option.description}</small>
                      </span>
                      {theme === option.value ? <Check aria-hidden="true" className="theme-option-check" size={16} /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            {headerActions}
          </div>
        </header>

        {children(theme)}
      </main>
    </div>
  );
}
