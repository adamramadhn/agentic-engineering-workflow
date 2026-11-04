import { Suspense } from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  // The shell's sidebar highlights the active route via usePathname(). On
  // static routes the pathname resolves at build time and this boundary never
  // shows; on routes with an uncovered dynamic param (e.g. /wiki/<page-id>) the
  // pathname is request-time data — with cacheComponents the build REQUIRES a
  // Suspense boundary above the hook so prerendering has a fallback. Same
  // visual language as the pages' own fallbacks: one centered pulse.
  return (
    <Suspense
      fallback={
        <div
          className="flex h-dvh items-center justify-center"
          role="status"
          aria-label="Loading workspace"
        >
          <div className="size-2 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>
      }
    >
      <DashboardShell>{children}</DashboardShell>
    </Suspense>
  );
}
