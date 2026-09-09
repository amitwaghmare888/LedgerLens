"use client";

import { useTheme, type ThemeMode } from "@/lib/theme";
import { useAuth, getUserDisplayName } from "@/contexts/auth-context";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { UserAvatar } from "./user-avatar";
import { TransactionDetailModal, type TransactionRecord } from "./TransactionDetailModal";

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

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "critical" | "warning" | "success" | "info";
  icon: string;
  read: boolean;
  link?: string;
  category?: string;
}

const DEFAULT_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "notif-critical-exc",
    title: "Amount Mismatch Detected",
    description: "Razorpay vs Core Ledger variance of ₹14,250.00 flagged for review.",
    time: "12m ago",
    type: "critical",
    icon: "error",
    read: false,
    link: "/exceptions",
    category: "Exception",
  },
  {
    id: "notif-recon-run",
    title: "Reconciliation Run Completed",
    description: "Batch #RR-2026-03 finished with 98.4% match rate across 3,482 records.",
    time: "35m ago",
    type: "success",
    icon: "check_circle",
    read: false,
    link: "/reconciliation",
    category: "Pipeline",
  },
  {
    id: "notif-ai-investigation",
    title: "AI Root Cause Diagnosis",
    description: "Automated analysis ready for gateway timeout on TXN-8492.",
    time: "1h ago",
    type: "info",
    icon: "psychology",
    read: false,
    link: "/exceptions",
    category: "AI Investigation",
  },
  {
    id: "notif-audit-checksum",
    title: "Audit Integrity Check Passed",
    description: "Cryptographic hash verification succeeded for all settlement batches.",
    time: "3h ago",
    type: "info",
    icon: "verified_user",
    read: true,
    link: "/audit",
    category: "Audit",
  },
];

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
  const [notificationOpen, setNotificationOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>(DEFAULT_NOTIFICATIONS);
  const [selectedSearchRecord, setSelectedSearchRecord] = useState<TransactionRecord | null>(null);
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

  // Restore stored read notification state on client mount
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem("ledgerlens_read_notifications");
        if (stored) {
          const readIds = new Set<string>(JSON.parse(stored));
          if (readIds.size > 0) {
            setNotifications((prev) =>
              prev.map((n) => (readIds.has(n.id) ? { ...n, read: true } : n))
            );
          }
        }
      } catch {}
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Fetch live exceptions to enrich notifications
  useEffect(() => {
    let isMounted = true;
    fetch("/api/exceptions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.exceptions?.length) return;
        const criticals = data.exceptions.filter(
          (e: { severity?: string }) => e.severity === "CRITICAL" || e.severity === "HIGH"
        );
        if (criticals.length > 0) {
          const top = criticals[0];
          const formattedAmount = top.amountPaise
            ? ` (₹${(top.amountPaise / 100).toLocaleString("en-IN")})`
            : "";
          const dynamicId = `exc-${top.id}`;

          let isRead = false;
          try {
            const stored = localStorage.getItem("ledgerlens_read_notifications");
            if (stored) {
              const readIds = new Set<string>(JSON.parse(stored));
              isRead = readIds.has(dynamicId);
            }
          } catch {}

          const dynamicItem: NotificationItem = {
            id: dynamicId,
            title: `${top.severity === "CRITICAL" ? "Critical" : "High"} Exception: ${String(top.type || "").replace(/_/g, " ")}`,
            description: `${top.description || "Unresolved mismatch"}${formattedAmount}`,
            time: "Just now",
            type: top.severity === "CRITICAL" ? "critical" : "warning",
            icon: top.severity === "CRITICAL" ? "error" : "warning",
            read: isRead,
            link: "/exceptions",
            category: "Live Exception",
          };

          setNotifications((prev) => {
            if (prev.some((n) => n.id === dynamicId)) return prev;
            return [dynamicItem, ...prev];
          });
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationOpen(false);
      }
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

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleToggleNotifications = () => {
    setNotificationOpen((prev) => {
      const next = !prev;
      if (next) {
        setThemeOpen(false);
        setUserMenuOpen(false);
        setSearchOpen(false);
      }
      return next;
    });
  };

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setNotifications((prev) => {
      const next = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      try {
        const readIds = next.filter((n) => n.read).map((n) => n.id);
        localStorage.setItem("ledgerlens_read_notifications", JSON.stringify(readIds));
      } catch {}
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => {
      const next = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem("ledgerlens_read_notifications", JSON.stringify(next.map((n) => n.id)));
      } catch {}
      return next;
    });
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (item: NotificationItem) => {
    handleMarkAsRead(item.id);
    setNotificationOpen(false);
    if (item.link) {
      router.push(item.link);
    }
  };

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
      router.push(`/exceptions?id=${encodeURIComponent(result.id)}`);
    } else if (result.type === 'record') {
      fetch(`/api/records/${encodeURIComponent(result.id)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.record) {
            setSelectedSearchRecord(data.record);
          }
        })
        .catch((err) => console.error('Failed to load record details:', err));
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
        <div className="relative" ref={notificationRef}>
          <button
            onClick={handleToggleNotifications}
            className="p-2 rounded-full hover:bg-[var(--surface-container)] transition-colors relative text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] cursor-pointer"
            aria-label="Notifications"
            title="Notifications"
            aria-expanded={notificationOpen}
            aria-haspopup="dialog"
          >
            <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>notifications</span>
            {unreadCount > 0 && (
              <span
                className="absolute top-2 right-2 w-2 h-2 bg-[var(--color-critical)] rounded-full border-2 border-[var(--surface)] animate-pulse"
                aria-label={`${unreadCount} new notifications`}
              />
            )}
          </button>

          {/* Notifications Dropdown */}
          {notificationOpen && (
            <div
              className="absolute right-0 top-12 w-80 sm:w-96 rounded-xl shadow-2xl border border-[var(--outline-variant)] bg-[var(--surface-container-lowest)] z-50 overflow-hidden"
              role="dialog"
              aria-label="Notifications panel"
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--outline-variant)] bg-[var(--surface-container-low)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-[var(--color-on-surface)]">
                    Notifications
                  </span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--color-critical)] text-white">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] font-medium text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors cursor-pointer"
                    >
                      Mark all as read
                    </button>
                  )}
                  {notifications.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-[11px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-critical)] transition-colors cursor-pointer"
                      title="Clear notifications"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Notification List */}
              <div className="max-h-96 overflow-y-auto divide-y divide-[var(--outline-variant)]">
                {notifications.length === 0 ? (
                  <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[32px] text-[var(--color-on-surface-variant)] opacity-40">
                      notifications_paused
                    </span>
                    <p className="text-[13px] font-medium text-[var(--color-on-surface)]">
                      All caught up!
                    </p>
                    <p className="text-[11px] text-[var(--color-on-surface-variant)]">
                      No unread reconciliation alerts or exceptions.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => {
                    const iconColor =
                      item.type === "critical"
                        ? "text-[var(--color-critical)] bg-[var(--color-critical)]/10"
                        : item.type === "warning"
                        ? "text-[var(--color-review)] bg-[var(--color-review)]/10"
                        : item.type === "success"
                        ? "text-[var(--color-explained)] bg-[var(--color-explained)]/10"
                        : "text-blue-500 bg-blue-500/10";

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`w-full p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left ${
                          item.read
                            ? "hover:bg-[var(--surface-container-low)] opacity-75 hover:opacity-100"
                            : "bg-[var(--surface-container-low)]/50 hover:bg-[var(--surface-container-low)]"
                        }`}
                      >
                        {/* Status Icon */}
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconColor}`}
                        >
                          <span
                            className="material-symbols-outlined"
                            style={{ fontSize: "18px" }}
                          >
                            {item.icon}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <span
                              className={`text-[12px] truncate ${
                                item.read
                                  ? "text-[var(--color-on-surface-variant)] font-medium"
                                  : "text-[var(--color-on-surface)] font-semibold"
                              }`}
                            >
                              {item.title}
                            </span>
                            <span className="text-[10px] text-[var(--color-on-surface-variant)] shrink-0">
                              {item.time}
                            </span>
                          </div>

                          <p className="text-[11px] text-[var(--color-on-surface-variant)] line-clamp-2 leading-relaxed">
                            {item.description}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-0.5">
                            {item.category && (
                              <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-[var(--surface-container)] text-[var(--color-on-surface-variant)]">
                                {item.category}
                              </span>
                            )}
                            <div className="flex items-center gap-2 ml-auto">
                              {!item.read && (
                                <button
                                  onClick={(e) => handleMarkAsRead(item.id, e)}
                                  className="text-[10px] text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] transition-colors hover:underline cursor-pointer"
                                  title="Mark as read"
                                >
                                  Mark read
                                </button>
                              )}
                              {item.link && (
                                <span className="text-[10px] font-medium text-[var(--primary)] flex items-center">
                                  View
                                  <span
                                    className="material-symbols-outlined"
                                    style={{ fontSize: "12px" }}
                                  >
                                    chevron_right
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Unread indicator */}
                        {!item.read && (
                          <span
                            className="w-2 h-2 rounded-full bg-[var(--color-critical)] shrink-0 mt-1.5"
                            title="Unread"
                          />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-[var(--outline-variant)] bg-[var(--surface-container-low)] flex items-center justify-between text-[11px]">
                <button
                  onClick={() => {
                    setNotificationOpen(false);
                    router.push("/exceptions");
                  }}
                  className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Exceptions</span>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    arrow_forward
                  </span>
                </button>
                <div className="h-3 w-px bg-[var(--outline-variant)]" />
                <button
                  onClick={() => {
                    setNotificationOpen(false);
                    router.push("/reconciliation");
                  }}
                  className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Reconciliation</span>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    arrow_forward
                  </span>
                </button>
                <div className="h-3 w-px bg-[var(--outline-variant)]" />
                <button
                  onClick={() => {
                    setNotificationOpen(false);
                    router.push("/audit");
                  }}
                  className="text-[var(--color-on-surface-variant)] hover:text-[var(--color-on-surface)] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>Audit</span>
                  <span
                    className="material-symbols-outlined"
                    style={{ fontSize: "14px" }}
                  >
                    arrow_forward
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme switcher */}
        <div className="relative" ref={themeRef}>
          <button
            onClick={() => {
              setThemeOpen((o) => !o);
              setNotificationOpen(false);
            }}
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
            onClick={() => {
              setUserMenuOpen((o) => !o);
              setNotificationOpen(false);
            }}
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

      {selectedSearchRecord && (
        <TransactionDetailModal
          record={selectedSearchRecord}
          onClose={() => setSelectedSearchRecord(null)}
        />
      )}
    </header>
  );
}
