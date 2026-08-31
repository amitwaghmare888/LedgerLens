"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";

const STORAGE_KEY = "ledgerlens-sidebar-collapsed";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored === "true";
    } catch {
      return false;
    }
  });

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  }

  const sidebarWidth = collapsed ? "64px" : "240px";

  return (
    <div className="min-h-screen bg-[var(--surface)]">
      <Sidebar collapsed={collapsed} onToggle={toggle} />

      <TopBar sidebarCollapsed={collapsed} />

      {/* Main content area */}
      <main
        className="content-transition min-h-screen bg-[var(--surface)]"
        style={{ marginLeft: sidebarWidth, paddingTop: "64px" }}
        id="main-content"
        role="main"
      >
        {children}
      </main>
    </div>
  );
}
