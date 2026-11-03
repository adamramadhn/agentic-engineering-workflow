"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "@/components/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        className="size-8 inline-flex items-center justify-center text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg cursor-pointer"
        aria-label="Toggle theme"
      >
        <Sun className="size-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <Tooltip>
      <TooltipTrigger
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="inline-flex items-center justify-center size-8 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors outline-hidden"
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <Sun className="size-4 text-amber-400 transition-transform duration-200 rotate-0 scale-100" />
        ) : (
          <Moon className="size-4 text-neutral-600 transition-transform duration-200 rotate-0 scale-100" />
        )}
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px] font-medium">
        {isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
      </TooltipContent>
    </Tooltip>
  );
}
