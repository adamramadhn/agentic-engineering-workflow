"use client";

import { HomeIcon } from "./icons";

interface HomeNavigationProps {
  currentRoute: string;
  collapsed?: boolean;
  onNavigate: (route: string) => void;
}

export function HomeNavigation({
  currentRoute,
  collapsed = false,
  onNavigate,
}: HomeNavigationProps) {
  const active = currentRoute === "home";

  return (
    <button
      type="button"
      aria-label="Home"
      aria-current={active ? "page" : undefined}
      title={collapsed ? "Home" : undefined}
      onClick={() => onNavigate("home")}
      className={`flex items-center gap-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 ${
        collapsed ? "mx-auto size-9 justify-center" : "h-[31px] w-full px-2.5"
      } ${
        active
          ? "bg-[#e5e5e7] dark:bg-[#1c1c22] text-neutral-900 dark:text-white"
          : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60"
      }`}
    >
      <HomeIcon className="size-4 shrink-0" />
      {!collapsed && <span>Home</span>}
    </button>
  );
}
