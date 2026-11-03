"use client";

import { useState } from "react";
import { RefreshCw, Search, Wand2 } from "@/components/icons";
import { useSidebar, SidebarTrigger } from "@/components/ui/sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { ConnectIcon } from "./icons";
import { StripeConnectorCard } from "./stripe-connector-card";

type FilterTab = "all" | "not_connected" | "connected";

interface ConnectPageProps {
  onOpenAI?: () => void;
  hideHeader?: boolean;
}

export function ConnectPage({ onOpenAI, hideHeader = false }: ConnectPageProps) {
  const [tab, setTab] = useState<FilterTab>("connected");
  const [query, setQuery] = useState("");
  const { open, isMobile } = useSidebar();
  const isCollapsed = !open;
  const showTrigger = isCollapsed || isMobile;

  return (
    <div className="flex h-full flex-col">
      {/* Top Header inside inset panel (only rendered if not embedded) */}
      {!hideHeader && (
        <header className="flex h-[58px] shrink-0 items-center justify-between px-4 sm:px-6 pt-1 border-b border-transparent dark:border-neutral-800">
          {/* Breadcrumb / Left Section */}
          <div className="flex items-center">
            {/* Smooth Expand Button to the left of breadcrumb */}
            <div
              className={`flex items-center overflow-hidden transition-all duration-200 ease-in-out ${
                showTrigger ? "w-8 opacity-100 mr-1.5" : "w-0 opacity-0 mr-0"
              }`}
            >
              <SidebarTrigger
                className="size-7 rounded-md text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0 cursor-pointer"
                title="Toggle sidebar (Cmd+B)"
              />
            </div>

            <Breadcrumb>
              <BreadcrumbList className="gap-2 text-[13px] font-medium text-neutral-800 dark:text-neutral-200">
                <BreadcrumbItem>
                  <BreadcrumbPage className="inline-flex items-center gap-2 font-medium text-neutral-800 dark:text-neutral-200">
                    <ConnectIcon className="size-4 text-neutral-700 dark:text-neutral-300 shrink-0" />
                    <span>Connect</span>
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[12px] font-normal text-neutral-400 dark:text-neutral-500">
              <RefreshCw className="size-3.5 text-neutral-400 dark:text-neutral-500" />
              <span>Synced 2 min ago</span>
            </span>

            <span className="inline-flex h-[22px] items-center rounded-full bg-[#fdf3fb] dark:bg-pink-950/40 px-2.5 text-[11px] font-semibold text-[#9a116f] dark:text-pink-300">
              1,204
            </span>

            <button
              type="button"
              onClick={onOpenAI}
              className="inline-flex h-[32px] items-center gap-1.5 rounded-lg bg-[#f4f4f5] dark:bg-neutral-800 px-2.5 sm:px-3 text-[12px] sm:text-[12.5px] font-medium text-neutral-800 dark:text-neutral-200 hover:bg-[#eaeaea] dark:hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <Wand2 className="size-3.5 text-neutral-700 dark:text-neutral-300" />
              <span>Ask AI</span>
            </button>
          </div>
        </header>
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-5 sm:pt-[31px] pb-6 custom-scrollbar">
        <div className="mx-auto w-full max-w-[808px]">
          <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.24px] text-neutral-900 dark:text-neutral-100 leading-none">
            Connect source
          </h1>

          {/* Search Source Input */}
          <div className="relative mt-3 sm:mt-[14px]">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connectors..."
              className="h-[38px] w-full rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#141417] pl-9 pr-4 text-[13px] text-neutral-800 dark:text-neutral-100 outline-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:border-neutral-400 dark:focus:border-neutral-600 transition-colors"
            />
          </div>

          {/* Filter Pills */}
          <div className="mt-4 sm:mt-[22px] flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
                tab === "all"
                  ? "bg-[#ededef] dark:bg-[#222228] text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setTab("not_connected")}
              className={`rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
                tab === "not_connected"
                  ? "bg-[#ededef] dark:bg-[#222228] text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Not connected
            </button>
            <button
              type="button"
              onClick={() => setTab("connected")}
              className={`rounded-lg px-2.5 py-1 text-[13px] font-medium transition-colors cursor-pointer shrink-0 ${
                tab === "connected"
                  ? "bg-[#ededef] dark:bg-[#222228] text-neutral-900 dark:text-white"
                  : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
              }`}
            >
              Connected
            </button>
          </div>

          {/* Stripe Connector Card */}
          <div className="mt-4 sm:mt-[22px] pb-8">
            <StripeConnectorCard />
          </div>
        </div>
      </main>
    </div>
  );
}
