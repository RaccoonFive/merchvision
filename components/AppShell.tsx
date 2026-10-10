"use client";

import { BriefcaseBusiness, ChartNoAxesCombined, Check, ChevronDown, ChevronsLeft, ChevronsRight, House, LogIn, LogOut, Palette, Search, Skull, Star, TrendingUp, User } from "lucide-react";
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
  activePath: "/welcome" | "/flips" | "/investments" | "/investment-tracker" | "/lookup" | "/bosses" | "/favorites" | "/account";
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
    <div className={`app-frame${sidebarCollapsed ? " sidebar-collapsed" : ""}`} data-tool={activePath.slice(1)}>
      <aside className="sidebar">
        <div className="sidebar-head">
          <Link className="brand" href="/welcome" aria-label="Merchvision home">
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
          <Link aria-current={activePath === "/welcome" ? "page" : undefined} aria-label="Welcome" className={`nav-item${activePath === "/welcome" ? " active" : ""}`} data-tool="welcome" href="/welcome" title="Welcome">
            <House size={19} />
            <span>Welcome</span>
          </Link>
          <Link aria-current={activePath === "/flips" ? "page" : undefined} aria-label="Flip Finder" className={`nav-item${activePath === "/flips" ? " active" : ""}`} data-tool="flips" href="/flips" title="Flip Finder">
            <TrendingUp size={19} />
            <span>Flip Finder</span>
          </Link>
          <Link aria-current={activePath === "/investments" ? "page" : undefined} aria-label="Investment Finder" className={`nav-item${activePath === "/investments" ? " active" : ""}`} data-tool="investments" href="/investments" title="Investment Finder">
            <ChartNoAxesCombined size={19} />
            <span>Investment Finder</span>
          </Link>
          <Link aria-current={activePath === "/investment-tracker" ? "page" : undefined} aria-label="Investment Tracker" className={`nav-item${activePath === "/investment-tracker" ? " active" : ""}`} data-tool="investment-tracker" href="/investment-tracker" title="Investment Tracker">
            <BriefcaseBusiness size={19} />
            <span>Investment Tracker</span>
          </Link>
          <Link aria-current={activePath === "/lookup" ? "page" : undefined} aria-label="Item Lookup" className={`nav-item${activePath === "/lookup" ? " active" : ""}`} data-tool="lookup" href="/lookup" title="Item Lookup">
            <Search size={19} />
            <span>Item Lookup</span>
          </Link>
          <Link aria-current={activePath === "/bosses" ? "page" : undefined} aria-label="Bosses" className={`nav-item${activePath === "/bosses" ? " active" : ""}`} data-tool="bosses" href="/bosses" title="Bosses">
            <Skull size={19} />
            <span>Bosses</span>
          </Link>
          <Link aria-current={activePath === "/favorites" ? "page" : undefined} aria-label="Favorites" className={`nav-item${activePath === "/favorites" ? " active" : ""}`} data-tool="favorites" href="/favorites" title="Favorites">
            <Star size={19} />
            <span>Favorites</span>
          </Link>
        </nav>

        <div className="sidebar-account">
          {session?.user ? (
            <>
              <Link aria-label="Your account" className={`account-summary${activePath === "/account" ? " active" : ""}`} href="/account" title={session.user.displayUsername ?? session.user.username ?? session.user.email}>
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
            <Link aria-label="Sign in" className={`account-action${activePath === "/account" ? " active" : ""}`} href="/account" title="Sign in">
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
                aria-label="Choose theme"
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
