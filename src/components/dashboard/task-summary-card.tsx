"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Copy, Info, Minus, MoreHorizontal, type IconComponent } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

export interface TaskSummaryCardProps {
  label: string;
  count: number;
  change: number;
  icon: IconComponent;
  description: string;
  period?: string;
  highlighted?: boolean;
}

export function TaskSummaryCard({
  label,
  count,
  change,
  icon: Icon,
  description,
  period = "vs last week",
  highlighted = false,
}: TaskSummaryCardProps) {
  const titleId = useId();
  const ChangeIcon = change > 0 ? ArrowUp : change < 0 ? ArrowDown : Minus;
  const changeLabel = `${change > 0 ? "+" : ""}${change} ${Math.abs(change) === 1 ? "Task" : "Tasks"}`;

  const copySummary = async () => {
    try {
      await navigator.clipboard.writeText(`${label}: ${count} tasks (${changeLabel} ${period})`);
      toast.success(`${label} summary copied`);
    } catch {
      toast.error("Couldn't copy the summary. Please try again.");
    }
  };

  return (
    <article
      aria-labelledby={titleId}
      className={`min-w-0 rounded-2xl border p-1 transition-colors ${
        highlighted
          ? "border-neutral-900 bg-neutral-50 dark:border-neutral-400 dark:bg-neutral-900"
          : "border-neutral-200/80 bg-white dark:border-neutral-800 dark:bg-neutral-950"
      }`}
    >
      <div className="rounded-xl border border-neutral-200/70 bg-neutral-50 px-3 pb-3 pt-2.5 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="flex items-center gap-2.5">
          <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg border shadow-2xs ${
            highlighted
              ? "border-neutral-900 bg-neutral-900 text-white dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-950"
              : "border-neutral-200/80 bg-white text-neutral-700 dark:border-neutral-700/60 dark:bg-neutral-800 dark:text-neutral-200"
          }`}>
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
          <h2 id={titleId} className="min-w-0 flex-1 text-[13px] font-medium tracking-[-0.2px] text-neutral-900 dark:text-neutral-100">
            {label}
          </h2>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`${label} options`}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-200/70 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:text-neutral-400 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-100 cursor-pointer"
            >
              <MoreHorizontal aria-hidden="true" className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={copySummary}>
                <Copy aria-hidden="true" className="size-3.5" />
                Copy summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-x-2 gap-y-2">
          <p className="flex items-baseline gap-1.5 text-neutral-900 dark:text-neutral-100">
            <span className="text-2xl font-medium leading-none tracking-[-0.02em] tabular-nums">{count}</span>
            <span className="text-xs">{count === 1 ? "Task" : "Tasks"}</span>
          </p>
          <span className="inline-flex items-center gap-0.5 rounded bg-neutral-200/60 px-1.5 py-0.5 text-[10px] font-medium text-neutral-700 tabular-nums dark:bg-neutral-800 dark:text-neutral-300">
            <ChangeIcon aria-hidden="true" className="size-2.5" />
            {changeLabel}
          </span>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2 pb-0.5 pt-1.5">
        <p className="text-[10px] text-neutral-500 dark:text-neutral-400">{period}</p>
        <Tooltip>
          <TooltipTrigger
            aria-label={`About ${label}`}
            className="flex size-6 items-center justify-center rounded text-neutral-500 hover:text-neutral-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-400 dark:text-neutral-400 dark:hover:text-neutral-100 cursor-help"
          >
            <Info aria-hidden="true" className="size-3" />
          </TooltipTrigger>
          <TooltipContent>{description}</TooltipContent>
        </Tooltip>
      </div>
    </article>
  );
}
