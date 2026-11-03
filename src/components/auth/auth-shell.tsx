"use client";

import Link from "next/link";
import { BrightdeskMark } from "@/components/dashboard/icons";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";

interface AuthShellProps {
  children: React.ReactNode;
}

export function AuthShell({ children }: AuthShellProps) {
  return (
    <div className="relative flex min-h-svh flex-col justify-between overflow-hidden bg-gradient-to-b from-[#fafafc] via-[#f3f4f6] to-[#ebecef] text-neutral-900 antialiased dark:from-[#09090b] dark:via-[#09090b] dark:to-[#0c0d10] dark:text-neutral-100">
      {/* 1. Technical Architectural Grid with Native SVG Radial Mask */}
      <svg
        className="pointer-events-none absolute inset-0 size-full"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <pattern
            id="auth-grid-pattern"
            width="36"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 36 0 L 0 0 0 36"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
              className="text-neutral-950/[0.045] dark:text-white/[0.04]"
            />
          </pattern>
          <radialGradient id="auth-grid-mask" cx="50%" cy="48%" r="48%">
            <stop offset="0%" stopColor="#fff" stopOpacity="1" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0.8" />
            <stop offset="85%" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="auth-mask-layer">
            <rect width="100%" height="100%" fill="url(#auth-grid-mask)" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="url(#auth-grid-pattern)"
          mask="url(#auth-mask-layer)"
        />
      </svg>

      {/* 2. Soft Horizon Top Illumination */}
      <div
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-[320px] w-[640px] rounded-full opacity-60 dark:opacity-25 blur-[100px]"
        style={{
          background:
            "radial-gradient(ellipse at center, rgba(147, 197, 253, 0.3) 0%, rgba(199, 210, 254, 0.15) 40%, transparent 75%)",
        }}
      />

      {/* 3. Subtle Card Aura Behind Center */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[340px] w-[460px] rounded-full bg-white/70 blur-[90px] dark:bg-white/[0.02]" />

      {/* Minimal Top Header */}
      <header className="relative z-10 flex h-16 items-center justify-between px-5 sm:px-8">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 transition-opacity hover:opacity-85"
        >
          <BrightdeskMark className="size-6 rounded-md transition-transform duration-200 group-hover:scale-105" />
          <span className="text-[14px] font-semibold tracking-[-0.01em]">
            Onyx
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="hidden sm:inline-flex items-center rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-neutral-500 transition-colors hover:bg-neutral-200/60 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800/60 dark:hover:text-neutral-100"
          >
            Back to dashboard
          </Link>
          <div className="hidden sm:block h-3.5 w-px bg-neutral-200 dark:bg-neutral-800" />
          <ThemeToggle />
        </div>
      </header>

      {/* Centered Main Auth Card with Precision Framing */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-8">
        <div className="relative w-full max-w-[390px]">
          {/* Subtle Corner Crosshair Accents */}
          <div
            className="pointer-events-none absolute -top-2.5 -left-2.5 hidden sm:block text-neutral-400/50 dark:text-neutral-600/60"
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="5" y1="0" x2="5" y2="10" />
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </div>
          <div
            className="pointer-events-none absolute -top-2.5 -right-2.5 hidden sm:block text-neutral-400/50 dark:text-neutral-600/60"
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="5" y1="0" x2="5" y2="10" />
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </div>
          <div
            className="pointer-events-none absolute -bottom-2.5 -left-2.5 hidden sm:block text-neutral-400/50 dark:text-neutral-600/60"
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="5" y1="0" x2="5" y2="10" />
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </div>
          <div
            className="pointer-events-none absolute -bottom-2.5 -right-2.5 hidden sm:block text-neutral-400/50 dark:text-neutral-600/60"
            aria-hidden="true"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <line x1="5" y1="0" x2="5" y2="10" />
              <line x1="0" y1="5" x2="10" y2="5" />
            </svg>
          </div>

          {/* Main Card Container */}
          <div className="relative rounded-2xl border border-neutral-200/90 bg-white/95 p-6 sm:p-7 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_8px_24px_rgba(0,0,0,0.03),0_24px_48px_-12px_rgba(0,0,0,0.04)] backdrop-blur-sm dark:border-neutral-800/80 dark:bg-[#121215]/95 dark:shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_8px_24px_rgba(0,0,0,0.4),0_24px_50px_rgba(0,0,0,0.6)]">
            {/* Top illuminated edge highlight */}
            <div
              className="pointer-events-none absolute inset-x-8 -top-px h-px bg-gradient-to-r from-transparent via-neutral-300 dark:via-white/20 to-transparent"
              aria-hidden="true"
            />
            {children}
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-2 px-6 py-5 text-[11.5px] text-neutral-400 dark:text-neutral-500">
        <p>© 2025 Onyx. All rights reserved.</p>
        <div className="flex items-center gap-3">
          <a
            href="#"
            className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Privacy
          </a>
          <span>•</span>
          <a
            href="#"
            className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Terms
          </a>
          <span>•</span>
          <a
            href="#"
            className="transition-colors hover:text-neutral-700 dark:hover:text-neutral-300"
          >
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}
