"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "@/components/icons";

interface ServerErrorViewProps {
  reset?: () => void;
  error?: Error & { digest?: string };
}

export function ServerErrorView({ reset }: ServerErrorViewProps) {
  const [retrying, setRetrying] = useState(false);

  const handleReload = () => {
    setRetrying(true);
    setTimeout(() => {
      if (reset) {
        reset();
      } else {
        window.location.reload();
      }
    }, 400);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Category / Status Code Tag */}
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        500
      </span>

      {/* H1 Page Title */}
      <h1 className="mt-2.5 text-[20px] font-bold tracking-[-0.011em] text-[#09090b] dark:text-[#fafafa]">
        Internal server error
      </h1>

      {/* Body / Description */}
      <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]">
        An unexpected condition occurred on the server. Please try refreshing, or return to the dashboard.
      </p>

      {/* Tactile Action Buttons */}
      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          onClick={handleReload}
          disabled={retrying}
          className="h-7.5 px-3 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-all select-none active:scale-[0.96] cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`size-3 ${retrying ? "animate-spin" : ""}`} />
          <span>{retrying ? "Reloading..." : "Reload page"}</span>
        </button>

        <Link
          href="/"
          className="h-7.5 px-2.5 rounded-lg border border-[#e2e2e5] dark:border-neutral-800 bg-white dark:bg-[#18181b] hover:bg-[#fafafb] dark:hover:bg-neutral-800 text-[#18181b] dark:text-neutral-200 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-all select-none active:scale-[0.96]"
        >
          <ArrowLeft className="size-3" />
          <span>Dashboard</span>
        </Link>
      </div>
    </div>
  );
}
