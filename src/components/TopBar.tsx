"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { useState, useRef, useEffect } from "react";

interface TopBarProps {
  sidebarCollapsed: boolean;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "contrast" },
];

export function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const currentThemeIcon =
    THEME_OPTIONS.find((t) => t.value === theme)?.icon ?? "contrast";

  const sidebarWidth = sidebarCollapsed ? "64px" : "240px";

  return (
    <header
      className="sidebar-transition fixed top-0 right-0 h-16 z-40 flex items-center justify-between px-6 border-b border-[var(--outline-variant)] backdrop-blur-xl"
      style={{
        left: sidebarWidth,
        backgroundColor: "var(--topbar-bg)",
      }}
      role="banner"
    >
      {/* Search */}
      <div className="flex-1 max-w-xl">
        <div
          className="relative group cursor-pointer h-10 w-full bg-[var(--surface-container-low)] rounded-lg border border-[var(--outline-variant)] flex items-center px-4 gap-3 text-[var(--color-on-surface-variant)] hover:border-[var(--outline)] transition-colors"
          role="search"
          aria-label="Search"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            search
          </span>
          <span className="text-[13px]">Search transactions, reports...</span>
          <div className="ml-auto flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] text-[11px] font-mono">
              ⌘
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded border border-[var(--outline-variant)] bg-[var(--surface-container-highest)] text-[11px] font-mono">
              K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-6 ml-4">
        {/* Notifications */}
        <button
          className="p-2 rounded-full hover:bg-[var(--surface-container)] transition-colors relative text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
          aria-label="Notifications"
          title="Notifications"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>notifications</span>
          <span className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-critical)] rounded-full border-2 border-[var(--surface)]" aria-label="New notifications" />
        </button>

        {/* Theme switcher */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => setThemeOpen((o) => !o)}
            className="p-2 rounded-full hover:bg-[var(--surface-container)] transition-colors text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)]"
            aria-label="Switch theme"
            aria-expanded={themeOpen}
            aria-haspopup="listbox"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>{currentThemeIcon}</span>
          </button>
          {themeOpen && (
            <div
              className="absolute right-0 top-12 w-40 rounded-xl shadow-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] z-50 overflow-hidden"
              role="listbox"
              aria-label="Theme options"
            >
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => {
                    setTheme(opt.value);
                    setThemeOpen(false);
                  }}
                  role="option"
                  aria-selected={theme === opt.value}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors",
                    theme === opt.value
                      ? "bg-[var(--surface-container)] text-[var(--color-on-surface)] font-medium"
                      : "text-[var(--color-on-surface-variant)] hover:bg-[var(--surface-container-low)]",
                  ].join(" ")}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: "18px" }}>
                    {opt.icon}
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-8 w-px bg-[var(--outline-variant)]" />

        {/* User menu */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-[14px] font-semibold text-[var(--color-on-surface)]">
              Ops Admin
            </div>
            <div className="text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-wider font-bold">
              Identity Verified
            </div>
          </div>
          <button
            className="w-8 h-8 rounded-full bg-[var(--color-primary)] flex items-center justify-center hover:opacity-80 transition-opacity"
            aria-label="User menu"
          >
            <span
              className="material-symbols-outlined text-[var(--color-on-primary)]"
              style={{ fontSize: "18px" }}
            >
              person
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
