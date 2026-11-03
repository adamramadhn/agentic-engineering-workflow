"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "@/components/icons";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { COMPONENTS_CATALOG } from "@/lib/components-catalog";
import { ComponentsIcon } from "./icons";

interface ComponentsNavigationProps {
  collapsed?: boolean;
  onExpand?: () => void;
  onNavigate?: () => void;
}

const navTriggerClass =
  "group flex h-[31px] w-full items-center justify-between rounded-lg px-2.5 text-[13px] font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neutral-400";

const navSubClass =
  "flex h-[28px] w-full -translate-x-px items-center justify-between rounded-md px-2 text-left text-[12.5px] font-normal text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 transition-colors";

export function ComponentsNavigation({
  collapsed = false,
  onExpand,
  onNavigate,
}: ComponentsNavigationProps) {
  const pathname = usePathname();
  const isSectionActive =
    pathname === "/components" || pathname?.startsWith("/components/");
  const [open, setOpen] = useState(isSectionActive);

  useEffect(() => {
    if (isSectionActive) {
      setOpen(true);
    }
  }, [isSectionActive]);

  if (collapsed) {
    return (
      <Link
        href="/components"
        aria-label="Components library"
        title="Components"
        onClick={onNavigate}
        className={`mx-auto flex size-9 items-center justify-center rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/60 ${
          isSectionActive ? "bg-[#e5e5e7] dark:bg-[#1c1c22]" : ""
        }`}
      >
        <ComponentsIcon className="size-4" />
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
          href="/components"
          onClick={onNavigate}
          className="flex flex-1 items-center gap-2.5 text-left cursor-pointer min-w-0"
        >
          <ComponentsIcon className="size-4 shrink-0" />
          <span className="truncate">Components</span>
        </Link>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-mono text-[10px] text-neutral-400 dark:text-neutral-500 px-1 rounded bg-neutral-200/60 dark:bg-neutral-800">
            {COMPONENTS_CATALOG.length}
          </span>
          <CollapsibleTrigger
            className="p-1 -mr-1 rounded hover:bg-neutral-200/80 dark:hover:bg-neutral-700/60 transition-colors cursor-pointer"
            aria-label="Toggle Components menu"
          >
            <ChevronRight
              className={`size-3.5 text-neutral-400 transition-transform duration-150 ${
                open ? "rotate-90" : ""
              }`}
            />
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="pt-0.5">
        <div className="ml-3 border-l border-neutral-200 dark:border-neutral-800 pl-2.5 space-y-0.5 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
          {/* Overview link */}
          <Link
            href="/components"
            onClick={onNavigate}
            className={`${navSubClass} ${
              pathname === "/components"
                ? "bg-[#e5e5e7] dark:bg-[#1c1c22] font-medium text-neutral-900 dark:text-white"
                : ""
            }`}
          >
            <span>Overview Index</span>
          </Link>

          {/* Individual components */}
          {COMPONENTS_CATALOG.map((item) => {
            const itemHref = `/components/${item.slug}`;
            const isActive = pathname === itemHref;

            return (
              <Link
                key={item.slug}
                href={itemHref}
                onClick={onNavigate}
                className={`${navSubClass} ${
                  isActive
                    ? "bg-[#e5e5e7] dark:bg-[#1c1c22] font-medium text-neutral-900 dark:text-white"
                    : ""
                }`}
              >
                <span className="truncate">{item.title}</span>
              </Link>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
