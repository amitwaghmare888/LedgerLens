"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeContextValue {
  theme: ThemeMode;
  resolvedTheme: "light" | "dark";
  setTheme: (t: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "ledgerlens-theme";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode: ThemeMode) {
  const resolved = mode === "system" ? getSystemTheme() : mode;
  document.documentElement.setAttribute("data-theme", resolved);
  return resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    try {
      return (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
    } catch {
      return "system";
    }
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() => {
    if (typeof window === "undefined") return "light";
    try {
      const stored = (localStorage.getItem(STORAGE_KEY) as ThemeMode | null) ?? "system";
      return applyTheme(stored);
    } catch {
      return "light";
    }
  });

  // React to system preference changes when theme === "system"
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(applyTheme("system"));
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    localStorage.setItem(STORAGE_KEY, t);
    setResolved(applyTheme(t));
  }, []);

  return (
    <ThemeContext value={{ theme, resolvedTheme: resolved, setTheme }}>
      {children}
    </ThemeContext>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
