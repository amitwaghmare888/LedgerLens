"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth, getUserDisplayName } from "@/contexts/auth-context";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "./user-avatar";

interface TopBarProps {
  sidebarCollapsed: boolean;
}

interface SearchResult {
  type: 'record' | 'exception';
  id: string;
  label: string;
  secondary: string;
  source?: string;
  severity?: string;
  matchedField?: string;
}

const THEME_OPTIONS: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "light_mode" },
  { value: "dark", label: "Dark", icon: "dark_mode" },
  { value: "system", label: "System", icon: "contrast" },
];

export function TopBar({ sidebarCollapsed }: TopBarProps) {
  const { theme, setTheme } = useTheme();
  const { user, signOut } = useAuth();
  const [themeOpen, setThemeOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Track client-side mount to avoid hydration mismatch
  // Using useLayoutEffect to set flag synchronously before paint
  useEffect(() => {
    // Schedule setMounted to avoid synchronous setState in effect
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (themeRef.current && !themeRef.current.contains(e.target as Node)) {
        setThemeOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Handle search input change
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
        setSearchOpen(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.type === 'exception') {
      router.push('/exceptions');
      // Note: Modal opening would require additional state management
      // For now, navigate to exceptions page
    } else if (result.type === 'record') {
      // Navigate to a record detail view if it exists
      // For now, we don't have a dedicated record detail page
      console.log('Record selected:', result.id);
    }
    setSearchQuery("");
    setSearchOpen(false);
  };

  const currentThemeIcon = mounted
    ? THEME_OPTIONS.find((t) => t.value === theme)?.icon ?? "contrast"
    : "contrast"; // Default icon during SSR to match initial client render

  const displayName = getUserDisplayName(user);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

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
      <div className="flex-1 max-w-xl relative" ref={searchRef}>
        <div
          className="relative group h-10 w-full bg-[var(--surface-container-low)] rounded-lg border border-[var(--outline-variant)] flex items-center px-4 gap-3 text-[var(--color-on-surface-variant)] hover:border-[var(--outline)] transition-colors focus-within:border-[var(--outline)]"
          role="search"
          aria-label="Search"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            {searchLoading ? "progress_activity" : "search"}
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search transactions, UTR, order ID..."
            className="flex-1 text-[13px] bg-transparent outline-none text-[var(--color-on-surface)] placeholder:text-[var(--color-on-surface-variant)]"
          />
        </div>

        {/* Search Results Dropdown */}
        {searchOpen && searchResults.length > 0 && (
          <div className="absolute top-12 left-0 right-0 max-w-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] rounded-lg shadow-lg overflow-hidden z-50">
            <div className="max-h-96 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={`${result.type}-${result.id}-${idx}`}
                  onClick={() => handleResultClick(result)}
                  className="w-full px-4 py-3 text-left hover:bg-[var(--surface-container-low)] border-b border-[var(--outline-variant)] last:border-b-0 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {result.type === 'exception' && (
                          <span className="material-symbols-outlined text-[16px] text-[var(--color-critical)]">
                            error
                          </span>
                        )}
                        {result.type === 'record' && (
                          <span className="material-symbols-outlined text-[16px] text-[var(--color-on-surface-variant)]">
                            receipt_long
                          </span>
                        )}
                        <span className="text-[13px] font-medium text-[var(--color-on-surface)] truncate">
                          {result.label}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--color-on-surface-variant)] truncate">
                        {result.secondary}
                      </p>
                      {result.matchedField && (
                        <p className="text-[11px] text-[var(--color-on-surface-variant)] mt-1 font-mono">
                          {result.matchedField}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No Results */}
        {searchOpen && searchQuery.length >= 2 && searchResults.length === 0 && !searchLoading && (
          <div className="absolute top-12 left-0 right-0 max-w-xl bg-[var(--surface-container-lowest)] border border-[var(--outline-variant)] rounded-lg shadow-lg p-4 text-center z-50">
            <span className="material-symbols-outlined text-[24px] text-[var(--color-on-surface-variant)] opacity-40">
              search_off
            </span>
            <p className="text-[13px] text-[var(--color-on-surface-variant)] mt-2">
              No results found for &ldquo;{searchQuery}&rdquo;
            </p>
          </div>
        )}
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
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setUserMenuOpen((o) => !o)}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            aria-label="User menu"
            aria-expanded={userMenuOpen}
          >
            <div className="text-right hidden sm:block">
              <div className="text-[14px] font-semibold text-[var(--color-on-surface)]">
                {displayName}
              </div>
              <div className="text-[10px] text-[var(--color-on-surface-variant)] uppercase tracking-wider font-bold">
                Identity Verified
              </div>
            </div>
            <UserAvatar user={user} size="sm" />
          </button>

          {/* User Dropdown Menu */}
          {userMenuOpen && (
            <div
              className="absolute right-0 top-12 w-64 rounded-xl shadow-lg border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] z-50 overflow-hidden"
              role="menu"
            >
              {/* User Info */}
              <div className="px-4 py-3 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)]">
                <div className="flex items-center gap-3 mb-2">
                  <UserAvatar user={user} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--color-on-surface)] truncate">
                      {displayName}
                    </div>
                    <div className="text-[12px] text-[var(--color-on-surface-variant)] truncate">
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <button
                onClick={handleSignOut}
                role="menuitem"
                className="w-full flex items-center gap-3 px-4 py-3 text-[14px] text-[var(--color-on-surface-variant)] hover:bg-[var(--surface-container-low)] hover:text-[var(--color-on-surface)] transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
                  logout
                </span>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
