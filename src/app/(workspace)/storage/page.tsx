import { Suspense } from "react";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";
import { StorageView } from "@/components/dashboard/storage-view";
import { ForbiddenView } from "@/components/status/forbidden-view";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { readStorageView } from "@/lib/storage";

/**
 * /storage — RSC first paint + client island, same shape as /roles. The server
 * gate runs BEFORE the settings read so a forbidden session never receives the
 * (already masked) connection details at all.
 */
async function StoragePageBody() {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.permissions, "storage.view")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ForbiddenView permission="storage.view" />
      </div>
    );
  }

  const settings = await readStorageView();

  return (
    <PagePermissionGate permission="storage.view">
      <StorageView initialSettings={settings} />
    </PagePermissionGate>
  );
}

export default function StoragePage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[50vh] items-center justify-center"
          role="status"
          aria-label="Loading storage settings"
        >
          <div className="size-2 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>
      }
    >
      <StoragePageBody />
    </Suspense>
  );
}
