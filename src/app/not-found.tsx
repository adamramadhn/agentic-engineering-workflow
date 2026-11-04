import type { Metadata } from "next";
import { PermissionProvider } from "@/components/dashboard/permission-provider";
import { StatusShell } from "@/components/status/status-shell";
import { NotFoundView } from "@/components/status/not-found-view";

export const metadata: Metadata = {
  title: "404 Not Found — Onyx",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <StatusShell>
      {/* The 404 renders outside the workspace layout, so it mounts its own
          provider — the view's Ask AI link is gated on ask-ai.view, and a
          logged-out/401 session resolves deny-all, hiding the link. */}
      <PermissionProvider>
        <NotFoundView />
      </PermissionProvider>
    </StatusShell>
  );
}
