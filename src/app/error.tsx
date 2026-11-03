"use client";

import { useEffect } from "react";
import { StatusShell } from "@/components/status/status-shell";
import { ServerErrorView } from "@/components/status/server-error-view";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Runtime error caught:", error);
  }, [error]);

  return (
    <StatusShell>
      <ServerErrorView error={error} reset={reset} />
    </StatusShell>
  );
}
