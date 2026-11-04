import { Suspense } from "react";
import { PagePermissionGate } from "@/components/dashboard/page-permission-gate";
import { WikiView } from "@/components/wiki/wiki-view";
import { ForbiddenView } from "@/components/status/forbidden-view";
import { getSessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { listWikiLabels, listWikiPages } from "@/lib/wiki";

/**
 * /wiki — RSC first paint + client island, following the /roles shape.
 *
 * The gate is server-side AND load-bearing for the flight payload: the session
 * read and the `wiki.view` check run BEFORE either wiki query, so a forbidden
 * visitor never gets page titles serialized into the RSC payload — not merely
 * hidden by the client gate, which stays as the second layer.
 */
async function WikiPageBody() {
  const user = await getSessionUser();
  // Return before any query: no wiki row may reach a forbidden user's payload.
  if (!user || !hasPermission(user.permissions, "wiki.view")) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <ForbiddenView permission="wiki.view" />
      </div>
    );
  }

  const [pages, labels] = await Promise.all([listWikiPages(), listWikiLabels()]);

  return (
    <PagePermissionGate permission="wiki.view">
      <WikiView initialPages={pages} initialLabels={labels} />
    </PagePermissionGate>
  );
}

export default function WikiPage() {
  // The session read (cookies) is a request-time API, so with cacheComponents
  // it belongs behind a Suspense boundary — the shell streams, the gated body
  // follows.
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-[50vh] items-center justify-center"
          role="status"
          aria-label="Loading wiki"
        >
          <div className="size-2 animate-pulse rounded-full bg-neutral-300 dark:bg-neutral-700" />
        </div>
      }
    >
      <WikiPageBody />
    </Suspense>
  );
}
