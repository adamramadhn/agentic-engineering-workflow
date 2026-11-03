import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function TaskPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card size="sm" className="gap-0 rounded-2xl p-1">
      <CardHeader className="flex flex-row items-center justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-3">
        <CardTitle>{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="min-w-0 p-0">{children}</CardContent>
    </Card>
  );
}
