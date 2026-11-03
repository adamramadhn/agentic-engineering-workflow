"use client";

import Link from "next/link";
import { ArrowLeft } from "@/components/icons";
import { PERMISSION_LABELS } from "@/lib/permissions";

/**
 * In-app 403 (design §6): rendered inside the page body by PagePermissionGate —
 * the dashboard chrome stays and only the gated view is replaced, so this is a
 * content block mirroring not-found-view.tsx's structure and styling (mono
 * status tag, title, description, one action), not a full StatusShell page.
 */
export function ForbiddenView({ permission }: { permission: string }) {
  const label = PERMISSION_LABELS[permission] ?? permission;
  return (
    <div className="flex flex-col items-center">
      {/* Category / Status Code Tag */}
      <span className="font-mono text-[10.5px] font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 select-none">
        403
      </span>

      {/* H1 Page Title */}
      <h1 className="mt-2.5 text-[20px] font-bold tracking-[-0.011em] text-[#09090b] dark:text-[#fafafa]">
        You don&apos;t have access to this page
      </h1>

      {/* Body / Description */}
      <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-[#71717a] dark:text-neutral-400 tracking-[-0.011em]">
        Ask an administrator to grant you the{" "}
        <span className="font-medium text-[#52525b] dark:text-neutral-300">{label}</span> permission.
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
      </div>
    </div>
  );
}
