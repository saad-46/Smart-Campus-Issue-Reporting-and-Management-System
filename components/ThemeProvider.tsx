// ============================================
// ThemeProvider — Dark/Light Theme Management
// ============================================
// Tailwind v4: darkMode is configured via @variant in globals.css
// This provider toggles the "dark" class on <html> directly.

"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  toggleTheme: () => {},
});

/** Directly manipulates <html> classList — works regardless of Tailwind version */
function applyTheme(t: Theme) {
  const html = document.documentElement;
  if (t === "dark") {
    html.classList.add("dark");
    html.style.colorScheme = "dark";
  } else {
    html.classList.remove("dark");
    html.style.colorScheme = "light";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Read saved preference or fall back to system
    // localStorage can throw (private mode, blocked storage) and may hold anything.
    let saved: Theme | null = null;
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light" || stored === "dark") saved = stored;
    } catch {
      saved = null;
    }
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved: Theme = saved ?? (systemDark ? "dark" : "light");

    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      try {
        localStorage.setItem("theme", next);
      } catch {
        // Preference just won't persist.
      }
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
