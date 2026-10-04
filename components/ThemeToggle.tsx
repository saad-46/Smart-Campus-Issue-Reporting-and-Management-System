"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { IconButton } from "@/components/ui/Button";

export default function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // The theme is only known on the client; render a same-size placeholder first.
  useEffect(() => setMounted(true), []);
  if (!mounted) return <span className="inline-block h-9 w-9" aria-hidden="true" />;

  const isDark = theme === "dark";
  return (
    <IconButton label={isDark ? "Switch to light theme" : "Switch to dark theme"} onClick={toggleTheme} className={className}>
      {isDark ? <Sun className="h-[18px] w-[18px]" aria-hidden="true" /> : <Moon className="h-[18px] w-[18px]" aria-hidden="true" />}
    </IconButton>
  );
}
