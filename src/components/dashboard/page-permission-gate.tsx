"use client";

import type { ReactNode } from "react";
import { ForbiddenView } from "@/components/status/forbidden-view";
import { usePermission } from "./permission-provider";

/**
 * Per-page client guard (design §6): mounts its children only once the
 * session's permissions are known AND include `permission`. While loading the
 * children stay unmounted — a forbidden view must never mount (and never fire
 * its API calls) in either direction; nav surfaces filter against the empty
 * set at the same time, so hidden is the loading-time default. Once ready
 * without the permission, the in-app 403 replaces the view inside the
 * dashboard chrome. The API remains the enforcement point.
 */
export function PagePermissionGate({ permission, children }: { permission: string; children: ReactNode }) {
  const { can, status } = usePermission();

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-label="Checking access">
        <div className="size-2 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
      </div>
    );
  }

  if (!can(permission)) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ForbiddenView permission={permission} />
      </div>
    );
  }

  return <>{children}</>;
}
