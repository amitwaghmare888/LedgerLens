"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useCallback } from "react";

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: "dashboard", group: "Operations" },
  { href: "/reconciliation", label: "Reconciliation", icon: "sync_alt", group: "Operations" },
  { href: "/exceptions", label: "Exception Queue", icon: "report", group: "Operations", badge: true },
  { href: "/audit", label: "Audit Trail", icon: "history_edu", group: "Governance" },
  { href: "/settings", label: "Settings", icon: "settings", group: "Governance" },
];

// LedgerLens symbol SVG from Stitch (the actual brand asset)
function LedgerLensSymbol({ size = 28 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="https://lh3.googleusercontent.com/aida-public/AB6AXuCrhtYuXBqsZQzQwDkkJJVbyqSOcZ9kNyYcV0hu_GbFHtxTcUp0-jkeRYflD1Bf8ehSn2ueanYGV63z8cdw3iQm2VTVu0_INyC-82nrxGUeBaOR90Nhv64fIrxVxiRljkckald7kZ3v7FBDr_2yv74PT9FhVHScQAxNSx1jJIuasttTsK3lBWrc_dwtJmL8wb2deHR2ChDf_6bEPIjRf7233FlusN_iI1M2oq-AQvvdOQJBfxMnxwcmqyUMbPhIhqYPsFo"
      alt="LedgerLens"
      width={size}
      height={size}
      style={{ objectFit: "contain" }}
    />
  );
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  // Keyboard shortcut: Ctrl/Cmd + B
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  // Group nav items
  const groups: Record<string, typeof NAV_ITEMS> = {};
  for (const item of NAV_ITEMS) {
    if (!groups[item.group]) groups[item.group] = [];
    groups[item.group].push(item);
  }

  return (
    <aside
      id="ledgerlens-sidebar"
      className="sidebar-transition fixed left-0 top-0 h-full z-50 flex flex-col bg-[var(--surface-container-low)] border-r border-[var(--outline-variant)]"
      style={{ width: collapsed ? "64px" : "240px" }}
      aria-label="Main navigation"
    >
      {/* Branding + collapse toggle */}
      <div
        className="h-16 flex items-center justify-between overflow-hidden"
        style={{ padding: collapsed ? "12px 8px" : "0 8px 0 16px" }}
      >
        <div className="flex items-center gap-3 shrink-0 min-w-0">
          <LedgerLensSymbol size={28} />
          {!collapsed && (
            <span
              className="text-[18px] leading-[24px] font-semibold tracking-tight text-[var(--color-on-surface)] whitespace-nowrap"
              aria-hidden={collapsed}
            >
              LedgerLens
            </span>
          )}
        </div>
        <button
          onClick={onToggle}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (Ctrl+B)`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="p-1.5 rounded-md hover:bg-[var(--surface-container)] transition-colors text-[var(--color-on-surface-variant)] shrink-0 flex items-center justify-center"
        >
          <span className="material-symbols-outlined" style={{ fontSize: "20px" }}>
            {collapsed ? "menu" : "menu_open"}
          </span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 pt-2 space-y-1 overflow-y-auto" aria-label="Site navigation">
        {Object.entries(groups).map(([group, items], gi) => (
          <div key={group} className={gi > 0 ? "pt-4 mt-4 border-t border-[var(--outline-variant)]" : ""}>
            {!collapsed && (
              <span className="block px-3 mb-1 text-[11px] font-bold uppercase tracking-[0.05em] text-[var(--color-on-surface-variant)] opacity-60">
                {group}
              </span>
            )}
            {items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                  className={[
                    "group relative flex items-center h-12 rounded-lg transition-all",
                    collapsed ? "px-0 justify-center" : "px-3",
                    active
                      ? "bg-[var(--surface-container-highest)] text-[var(--color-on-surface)] font-semibold"
                      : "text-[var(--color-on-surface-variant)] hover:bg-[var(--surface-container)] hover:text-[var(--color-on-surface)]",
                  ].join(" ")}
                >
                  {/* Active indicator bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[var(--color-primary)] rounded-r" />
                  )}
                  <span className={`material-symbols-outlined shrink-0 ${collapsed ? "" : "mr-3"}`} style={{ fontSize: "22px" }}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="text-[14px] leading-[20px] truncate">{item.label}</span>
                  )}
                  {/* Exception badge */}
                  {item.badge && !collapsed && (
                    <span className="ml-auto w-2 h-2 rounded-full bg-[var(--color-critical)]" aria-label="Has critical items" />
                  )}
                  {item.badge && collapsed && (
                    <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--color-critical)]" aria-label="Has critical items" />
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
