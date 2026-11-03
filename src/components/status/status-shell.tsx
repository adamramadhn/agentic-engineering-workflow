"use client";

import Link from "next/link";
import { BrightdeskMark } from "@/components/dashboard/icons";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

interface StatusShellProps {
  children: React.ReactNode;
}

export function StatusShell({ children }: StatusShellProps) {
  return (
    <div className="relative flex min-h-svh flex-col justify-between bg-[#fafafc] text-[#09090b] antialiased dark:bg-[#09090b] dark:text-[#fafafa]">
      {/* Subtle architectural grid that fades smoothly */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.2]"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(0, 0, 0, 0.05) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: "32px 32px",
          maskImage: "radial-gradient(ellipse 60% 50% at 50% 45%, black 20%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 50% 45%, black 20%, transparent 100%)",
        }}
      />

      {/* Top Header */}
      <header className="relative z-10 flex h-14 items-center justify-between px-6 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-80"
        >
          <BrightdeskMark className="size-5 rounded-md" />
          <span className="text-[13px] font-semibold tracking-[-0.011em]">
            Onyx
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="text-[11.5px] font-medium text-[#71717a] hover:text-[#09090b] dark:text-neutral-400 dark:hover:text-[#fafafa] tracking-[-0.011em] transition-colors px-2 py-1"
          >
            Dashboard
          </Link>
          <div className="h-3 w-px bg-neutral-200 dark:bg-neutral-800" />
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Content */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px] text-center">
          {children}
        </div>
      </main>

      {/* Minimal Bottom Footer */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-4 text-[11px] text-[#71717a] dark:text-neutral-600 tracking-[-0.011em]">
        <p>© 2025 Onyx Inc.</p>
        <div className="flex items-center gap-4">
          <Link href="/" className="hover:text-[#09090b] dark:hover:text-neutral-400 transition-colors">
            Overview
          </Link>
          <a href="#" className="hover:text-[#09090b] dark:hover:text-neutral-400 transition-colors">
            Status
          </a>
          <a href="#" className="hover:text-[#09090b] dark:hover:text-neutral-400 transition-colors">
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}
