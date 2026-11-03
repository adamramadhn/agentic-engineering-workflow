import type { Metadata } from "next";
import { StatusShell } from "@/components/status/status-shell";
import { NotFoundView } from "@/components/status/not-found-view";

export const metadata: Metadata = {
  title: "404 Not Found — Onyx",
  description: "The page you are looking for does not exist.",
};

export default function NotFound() {
  return (
    <StatusShell>
      <NotFoundView />
    </StatusShell>
  );
}
