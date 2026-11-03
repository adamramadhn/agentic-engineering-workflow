"use client";

import Link from "next/link";
import { ArrowLeft } from "@/components/icons";

export function NotFoundView() {
  return (
    <div className="flex flex-col items-center">
      {/* Category / Status Code Tag */}
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        404
      </span>

      {/* H1 Page Title */}
      <h1 className="mt-2.5 text-[20px] font-bold tracking-[-0.011em] text-[#09090b] dark:text-[#fafafa]">
        Page not found
      </h1>

      {/* Body / Description */}
      <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]">
        The page you are looking for doesn&apos;t exist, has been removed, or is temporarily unavailable.
      </p>

      {/* Tactile Action Buttons */}
      <div className="mt-6 flex items-center gap-2">
        <Link
          href="/"
          className="h-7.5 px-3 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-all select-none active:scale-[0.96]"
        >
          <ArrowLeft className="size-3" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/ask-ai"
          className="h-7.5 px-2.5 rounded-lg border border-[#e2e2e5] dark:border-neutral-800 bg-white dark:bg-[#18181b] hover:bg-[#fafafb] dark:hover:bg-neutral-800 text-[#18181b] dark:text-neutral-200 text-[11.5px] font-medium inline-flex items-center justify-center gap-1.5 transition-all select-none active:scale-[0.96]"
        >
          Ask AI
        </Link>
      </div>
    </div>
  );
}
