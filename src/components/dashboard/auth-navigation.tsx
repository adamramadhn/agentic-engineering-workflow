"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, KeyRound } from "@/components/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const authItems = [
  { href: "/login", label: "Sign in" },
  { href: "/register", label: "Create account" },
  { href: "/forgot-password", label: "Forgot password" },
];

interface AuthNavigationProps {
  collapsed?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
}

const navTriggerClass =
  "group flex h-[31px] w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neutral-400";

const navSubClass =
  "flex h-[28px] w-full -translate-x-px items-center rounded-md px-2 text-left text-[12.5px] font-normal text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors";

export function AuthNavigation({
  collapsed = false,
  onExpand,
  onNavigate,
}: AuthNavigationProps) {
  const pathname = usePathname();
  const isSectionActive = authItems.some((item) => item.href === pathname);
  const [open, setOpen] = useState(isSectionActive);

  useEffect(() => {
    if (isSectionActive) {
      setOpen(true);
    }
  }, [isSectionActive]);

  if (collapsed) {
    return (
      <Link
        href="/login"
        aria-label="Auth pages"
        title="Auth"
        onClick={onNavigate}
        className={`mx-auto flex size-9 items-center justify-center rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 ${
          isSectionActive ? "bg-[#e5e5e7] dark:bg-[#1c1c22]" : ""
        }`}
      >
        <KeyRound className="size-4" />
      </Link>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`${navTriggerClass} ${
          isSectionActive && !open ? "text-neutral-900 dark:text-white" : ""
        }`}
      >
        <Link
          href="/login"
          onClick={onNavigate}
          className="flex flex-1 items-center gap-2.5 text-left cursor-pointer min-w-0"
        >
          <KeyRound className="size-4 shrink-0" />
          <span className="truncate">Auth</span>
        </Link>
        <CollapsibleTrigger
          className="p-1 -mr-1 rounded hover:bg-neutral-200/80 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer shrink-0"
          aria-label="Toggle Auth menu"
        >
          <ChevronRight
            className={`size-3.5 text-neutral-400 transition-transform duration-150 ${
              open ? "rotate-90" : ""
            }`}
          />
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="pt-0.5">
        <ul
          className="my-0.5 ml-[18px] flex flex-col gap-0.5 border-l border-neutral-200 dark:border-neutral-800 pl-3 pr-0"
        >
          {authItems.map((item) => {
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={`${navSubClass} ${
                    active
                      ? "bg-[#e5e5e7] dark:bg-[#1c1c22] font-medium text-neutral-900 dark:text-white"
                      : ""
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
