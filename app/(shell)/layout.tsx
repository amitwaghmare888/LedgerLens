"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { LoadingScreen } from "@/components/LoadingScreen";

const STORAGE_KEY = "ledgerlens-sidebar-collapsed";

export default function AppShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [showLoading, setShowLoading] = useState(true)
  const collapsed = useSyncExternalStore(
    (cb) => { window.addEventListener("storage", cb); return () => window.removeEventListener("storage", cb); },
    () => { try { return localStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; } },
    () => false
  );

  function setCollapsed(value: boolean | ((prev: boolean) => boolean)) {
    const next = typeof value === "function" ? value(localStorage.getItem(STORAGE_KEY) === "true") : value;
    try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
    // Force re-render by dispatching a storage event
    window.dispatchEvent(new Event("storage"));
  }

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    // Mark loading as complete after initial render
    const timer = setTimeout(() => {
      setShowLoading(false)
    }, 1400) // Total loading duration (aligned with LoadingScreen stages)

    return () => clearTimeout(timer)
  }, [])

  function toggle() {
    setCollapsed((prev) => !prev);
  }

  const sidebarWidth = collapsed ? "64px" : "240px";

  // Show loading screen while checking auth
  if (authLoading) {
    return <LoadingScreen />;
  }

  // Don't render shell if not authenticated (redirect will happen)
  if (!user) {
    return null;
  }

  return (
    <>
      {showLoading && <LoadingScreen />}
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
    </>
  );
}
