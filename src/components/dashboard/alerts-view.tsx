"use client";

import { useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  CheckCheck,
  ExternalLink,
} from "@/components/icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
  source: string;
  time: string;
  read: boolean;
}

const initialAlerts: AlertItem[] = [
  {
    id: "alt_1",
    title: "Webhook delivery timeout (504 Gateway)",
    description: "Endpoint https://api.canguard.io/events failed to respond within 5000ms. 3 retries scheduled.",
    severity: "critical",
    source: "Canguard Security",
    time: "2 mins ago",
    read: false,
  },
  {
    id: "alt_2",
    title: "Payment intent requires 3D Secure",
    description: "Invoice in_1Oq8G8Lkd for Vanguard Tech Inc ($720.00) requires customer authentication.",
    severity: "warning",
    source: "Stripe",
    time: "14 mins ago",
    read: false,
  },
  {
    id: "alt_3",
    title: "Stripe API Key expiring in 14 days",
    description: "Restricted Key (rk_live_...9421) is set to expire on Nov 1, 2026. Please rotate your secret.",
    severity: "warning",
    source: "Stripe Connector",
    time: "1 hour ago",
    read: false,
  },
  {
    id: "alt_4",
    title: "Rate limit threshold reached (80%)",
    description: "Byteforge telemetry ingress reached 8,200 req/min. Auto-scaling cluster worker initialized.",
    severity: "critical",
    source: "Byteforge",
    time: "3 hours ago",
    read: false,
  },
  {
    id: "alt_5",
    title: "Schema migration synchronized",
    description: "OmniCorp database schema v4.2 applied successfully without downtime or table lock.",
    severity: "info",
    source: "OmniCorp",
    time: "5 hours ago",
    read: false,
  },
  {
    id: "alt_6",
    title: "Daily sync health check passed",
    description: "1,204 transactions verified against upstream ledgers. 0 discrepancies found.",
    severity: "info",
    source: "System Auditor",
    time: "Today, 09:42",
    read: false,
  },
];

export function AlertsView() {
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [filter, setFilter] = useState<"all" | "unread" | "critical">("all");

  const unreadCount = alerts.filter((a) => !a.read).length;

  const filtered = alerts.filter((a) => {
    if (filter === "unread") return !a.read;
    if (filter === "critical") return a.severity === "critical";
    return true;
  });

  const markAsRead = (id: string) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, read: true } : a))
    );
    toast.success("Alert acknowledged");
  };

  const markAllRead = () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    toast.success("All alerts marked as read");
  };

  return (
    <div className="flex flex-col space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-neutral-900 dark:text-neutral-100 leading-tight">
              Alerts
            </h1>
            {unreadCount > 0 && (
              <span className="inline-flex h-[20px] items-center rounded-full bg-red-100 dark:bg-red-950/60 px-2 text-[11px] font-semibold text-red-700 dark:text-red-300">
                {unreadCount} unread
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Issues and updates from connected sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="h-8 gap-1.5 text-[12px] font-medium border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              <span>Mark all read</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: "all", label: `All (${alerts.length})` },
          { id: "unread", label: `Unread (${unreadCount})` },
          { id: "critical", label: "Critical Only" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as any)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer shrink-0 ${
              filter === tab.id
                ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts Feed */}
      <div className="space-y-2.5">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-200 dark:border-neutral-800 p-12 text-center text-[13px] text-neutral-400 dark:text-neutral-500">
            No alerts found for this filter.
          </div>
        ) : (
          filtered.map((alert) => (
            <Card
              key={alert.id}
              className={`border transition-all shadow-none ${
                alert.read
                  ? "border-neutral-200/60 dark:border-neutral-800/60 bg-neutral-50/30 dark:bg-neutral-900/20 opacity-75"
                  : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] hover:border-neutral-300 dark:hover:border-neutral-700"
              }`}
            >
              <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3">
                  <div
                    className={`size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      alert.severity === "critical"
                        ? "bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400"
                        : alert.severity === "warning"
                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                        : "bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {alert.severity === "critical" ? (
                      <AlertCircle className="size-4" />
                    ) : alert.severity === "warning" ? (
                      <AlertTriangle className="size-4" />
                    ) : (
                      <Info className="size-4" />
                    )}
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13.5px] font-semibold text-neutral-900 dark:text-neutral-100">
                        {alert.title}
                      </span>
                      <span className="text-[10.5px] font-medium text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {alert.source}
                      </span>
                      {!alert.read && (
                        <span className="size-1.5 rounded-full bg-blue-500"></span>
                      )}
                    </div>
                    <p className="text-[12px] text-neutral-600 dark:text-neutral-400 leading-normal max-w-2xl">
                      {alert.description}
                    </p>
                    <p className="text-[11px] text-neutral-400 dark:text-neutral-500 pt-0.5">
                      {alert.time} • Alert ID: {alert.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {!alert.read ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => markAsRead(alert.id)}
                      className="h-7 text-[11.5px] font-medium border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                    >
                      Acknowledge
                    </Button>
                  ) : (
                    <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 flex items-center gap-1 px-1">
                      <CheckCircle2 className="size-3 text-neutral-400" />
                      Read
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      toast.info(`Opening telemetry trace for ${alert.id}`)
                    }
                    className="h-7 text-[11.5px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer"
                  >
                    Trace
                    <ExternalLink className="size-3 ml-1 text-neutral-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
