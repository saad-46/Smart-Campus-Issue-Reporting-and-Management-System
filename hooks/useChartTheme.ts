"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Chart colours for the current theme. Charts use the brand blue for the
 * primary series, a neutral for comparisons, and status colours only where
 * the data has that meaning (e.g. resolved = success).
 */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === "dark";
    return {
      primary: dark ? "#6f95f3" : "#1e40af",
      primarySoft: dark ? "rgba(111,149,243,0.18)" : "rgba(30,64,175,0.10)",
      secondary: dark ? "#5fd38b" : "#15803d",
      neutral: dark ? "#6b7586" : "#9aa3b2",
      warning: dark ? "#f2b650" : "#b26800",
      danger: dark ? "#ff8a80" : "#c8281d",
      grid: dark ? "#232a36" : "#e7eaef",
      axis: dark ? "#8a93a3" : "#6b7280",
      cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
      tooltip: {
        backgroundColor: dark ? "#191e29" : "#ffffff",
        border: `1px solid ${dark ? "#353d4d" : "#cdd2da"}`,
        borderRadius: 6,
        boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
        color: dark ? "#e8ebf1" : "#111827",
        fontSize: 12,
        padding: "8px 10px",
      },
      tooltipLabel: { color: dark ? "#a7afbd" : "#4b5563", marginBottom: 4, fontSize: 12 },
      tooltipItem: { color: dark ? "#e8ebf1" : "#111827", padding: 0 },
      /** Categorical palette: blue-led, muted — for category breakdowns. */
      categorical: dark
        ? ["#6f95f3", "#4fb6c9", "#5fd38b", "#c3a3f2", "#f2b650", "#ff8a80", "#9aa3b2", "#e889b9", "#a3c76d"]
        : ["#1e40af", "#0e7490", "#15803d", "#6d28d9", "#b26800", "#c8281d", "#6b7280", "#be185d", "#4d7c0f"],
    };
  }, [theme]);
}
