"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  Zap,
  CreditCard,
  ExternalLink,
} from "@/components/icons";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  type: "success" | "warning" | "billing" | "system";
}

const initialNotifications: NotificationItem[] = [
  {
    id: "notif_1",
    title: "Stripe Ledger Synchronized",
    description: "1,204 transactions verified with 0 discrepancies.",
    time: "2 mins ago",
    unread: true,
    type: "success",
  },
  {
    id: "notif_2",
    title: "Enterprise Upgrade: Acme Corp",
    description: "New subscription payment of $2,450.00 processed successfully.",
    time: "42 mins ago",
    unread: true,
    type: "billing",
  },
  {
    id: "notif_3",
    title: "Webhook Gateway Timeout",
    description: "Canguard endpoint took >5000ms. Retry #1 executed.",
    time: "1 hour ago",
    unread: true,
    type: "warning",
  },
  {
    id: "notif_4",
    title: "Daily Audit Report Generated",
    description: "Export file ready for download in CSV format.",
    time: "4 hours ago",
    unread: false,
    type: "system",
  },
];

interface NotificationDropdownProps {
  onNavigateToAlerts?: () => void;
}

export function NotificationDropdown({ onNavigateToAlerts }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const unreadCount = notifications.filter((n) => n.unread).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    toast.success("All notifications marked as read");
  };

  const markSingleRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const filtered = notifications.filter((n) => {
    if (filter === "unread") return n.unread;
    return true;
  });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative inline-flex items-center justify-center size-8 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors outline-hidden"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-neutral-900 animate-pulse" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[360px] p-0 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/50 dark:bg-neutral-900/40">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-neutral-900 dark:text-neutral-100">
              Notifications
            </span>
            {unreadCount > 0 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-950/70 text-red-600 dark:text-red-400">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11.5px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200 flex items-center gap-1 cursor-pointer"
            >
              <CheckCheck className="size-3.5" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter sub-tabs */}
        <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-neutral-100 dark:border-neutral-800/60">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium cursor-pointer transition-colors ${
              filter === "all"
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("unread")}
            className={`px-2.5 py-1 rounded-md text-[11.5px] font-medium cursor-pointer transition-colors ${
              filter === "unread"
                ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
                : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {/* Notifications List */}
        <div className="max-h-[320px] overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 custom-scrollbar">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-[12px] text-neutral-400">
              No notifications to display.
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => markSingleRead(item.id)}
                className={`p-3.5 flex items-start gap-3 hover:bg-neutral-50 dark:hover:bg-neutral-900/60 transition-colors cursor-pointer ${
                  item.unread ? "bg-neutral-50/40 dark:bg-neutral-900/30" : ""
                }`}
              >
                <div
                  className={`size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                    item.type === "success"
                      ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
                      : item.type === "warning"
                      ? "bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400"
                      : item.type === "billing"
                      ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400"
                      : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
                  }`}
                >
                  {item.type === "success" ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : item.type === "warning" ? (
                    <AlertTriangle className="size-3.5" />
                  ) : item.type === "billing" ? (
                    <CreditCard className="size-3.5" />
                  ) : (
                    <Zap className="size-3.5" />
                  )}
                </div>

                <div className="flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-[12.5px] font-semibold text-neutral-900 dark:text-neutral-100 leading-tight">
                      {item.title}
                    </p>
                    {item.unread && (
                      <span className="size-1.5 rounded-full bg-blue-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11.5px] text-neutral-500 dark:text-neutral-400 leading-snug line-clamp-2">
                    {item.description}
                  </p>
                  <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500 pt-0.5">
                    {item.time}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 text-center">
          <button
            type="button"
            onClick={() => {
              if (onNavigateToAlerts) onNavigateToAlerts();
            }}
            className="w-full py-1.5 rounded-lg text-[11.5px] font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span>View all live system alerts</span>
            <ExternalLink className="size-3 text-neutral-400" />
          </button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
