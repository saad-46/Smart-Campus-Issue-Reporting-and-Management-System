"use client";

import { useMemo } from "react";
import { useTheme } from "@/components/ThemeProvider";

/**
 * Chart colours for the current theme. Charts use the brand indigo for the
 * primary series, a neutral for comparisons, and status colours only where
 * the data has that meaning (e.g. resolved = success).
 */
export function useChartTheme() {
  const { theme } = useTheme();
  return useMemo(() => {
    const dark = theme === "dark";
    return {
      primary: dark ? "#8f84ff" : "#4f46e5",
      primarySoft: dark ? "rgba(143,132,255,0.22)" : "rgba(79,70,229,0.12)",
      secondary: dark ? "#5fd38b" : "#15803d",
      neutral: dark ? "#6f6c94" : "#9a98b5",
      warning: dark ? "#f2b650" : "#b26800",
      danger: dark ? "#ff8a80" : "#c8281d",
      grid: dark ? "#26234a" : "#e6e4f2",
      axis: dark ? "#918eb5" : "#65637f",
      cursor: dark ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.05)",
      tooltip: {
        backgroundColor: dark ? "#1a1836" : "#ffffff",
        border: `1px solid ${dark ? "#3a3668" : "#c9c5e2"}`,
        borderRadius: 10,
        boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
        color: dark ? "#eceafb" : "#16142b",
        fontSize: 12,
        padding: "8px 10px",
      },
      tooltipLabel: { color: dark ? "#b0adcf" : "#4a4865", marginBottom: 4, fontSize: 12 },
      tooltipItem: { color: dark ? "#eceafb" : "#16142b", padding: 0 },
      /** Categorical palette: blue-led, muted — for category breakdowns. */
      categorical: dark
        ? ["#8f84ff", "#4fb6c9", "#5fd38b", "#c79bf5", "#f2b650", "#ff8a80", "#9a98b5", "#e889b9", "#a3c76d"]
        : ["#4f46e5", "#0e7490", "#15803d", "#9333ea", "#b26800", "#c8281d", "#65637f", "#be185d", "#4d7c0f"],
    };
  }, [theme]);
}
