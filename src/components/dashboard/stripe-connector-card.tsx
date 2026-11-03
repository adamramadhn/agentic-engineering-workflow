"use client";

import { Check, ChevronDown, ChevronRight } from "@/components/icons";
import { StripeMark } from "./icons";

const stats = [
  { label: "Customers", value: "162" },
  { label: "Active subs", value: "49" },
  { label: "Invoices", value: "1,204" },
  { label: "Payments & refunds", value: "1,206" },
];

const syncHistory = [
  "Today 09:42",
  "Today 09:42",
  "Today 03:00",
  "Yesterday 21:00",
  "Yesterday 15:00",
];

export function StripeConnectorCard() {
  return (
    <section className="rounded-xl sm:rounded-2xl border border-[#e5e5e7] dark:border-neutral-800 bg-white dark:bg-[#121215] p-3.5 sm:p-4 shadow-2xs">
      {/* Connector Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <StripeMark />
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-[-0.14px] text-neutral-900 dark:text-neutral-100 leading-none">
                Stripe
              </span>
              <ChevronDown className="size-3 text-neutral-500 dark:text-neutral-400" />
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-[12px] font-normal text-neutral-500 dark:text-neutral-400">Acct_•••4821</span>
              <span className="inline-flex items-center rounded-full bg-[#eefaf3] dark:bg-emerald-950/50 px-2 py-0.5 text-[11.5px] font-medium text-[#16a34a] dark:text-emerald-400">
                Synced 2 min ago
              </span>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="self-start sm:self-auto inline-flex h-[32px] items-stretch overflow-hidden rounded-lg border border-[#e5e7eb] dark:border-neutral-700 bg-white dark:bg-[#18181c] text-[12px] font-medium text-neutral-700 dark:text-neutral-200 shadow-2xs hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
        >
          <span className="inline-flex items-center gap-1.5 px-3">
            <Check className="size-3 text-neutral-500 dark:text-neutral-400" strokeWidth={2.2} />
            <span>Connected</span>
          </span>
          <span className="inline-flex items-center border-l border-[#e5e7eb] dark:border-neutral-700 px-2 text-neutral-400">
            <ChevronDown className="size-3" />
          </span>
        </button>
      </div>

      {/* 4 Stat Boxes */}
      <div className="mt-5 sm:mt-[29px] grid grid-cols-2 lg:grid-cols-4 items-stretch gap-2 sm:gap-2.5">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex min-h-[66px] h-full flex-col justify-center rounded-xl border border-[#ededef] dark:border-neutral-800 bg-white dark:bg-[#16161a] px-3 sm:px-3.5 py-2.5 sm:py-0"
          >
            <p className="text-[12px] font-normal text-neutral-500 dark:text-neutral-400 leading-tight">
              {stat.label}
            </p>
            <p className="mt-1 text-[16px] font-semibold tracking-[-0.2px] text-neutral-900 dark:text-neutral-100 leading-tight">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* What we never do */}
      <div className="mt-4 sm:mt-[24px] rounded-xl bg-[#fafafa] dark:bg-[#16161a] px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-4 sm:pb-[19px]">
        <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-500 dark:text-neutral-400 uppercase leading-none">
          WHAT WE NEVER DO
        </p>
        <p className="mt-1 text-[13px] text-neutral-800 dark:text-neutral-200 leading-normal">
          Write, modify or charge anything. Read-only API key, revocable anytime.
        </p>
      </div>

      {/* Sync history */}
      <div className="mt-1 rounded-xl bg-[#fafafa] dark:bg-[#16161a] px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-4 sm:pb-[20px]">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-500 dark:text-neutral-400 uppercase leading-none">
            SYNC HISTORY
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span>Full log</span>
            <ChevronRight className="size-3 text-neutral-400" />
          </button>
        </div>
        <ul className="mt-[17px] space-y-[9px]">
          {syncHistory.map((entry, index) => (
            <li
              key={`${entry}-${index}`}
              className="flex items-center gap-2 text-[13px] text-neutral-800 dark:text-neutral-200"
            >
              <Check className="size-3.5 text-[#16a34a] dark:text-emerald-400" strokeWidth={2.2} />
              <span>{entry}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Data health */}
      <div className="mt-1 rounded-xl bg-[#fafafa] dark:bg-[#16161a] px-3.5 sm:px-4 pt-3 sm:pt-3.5 pb-4">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-medium tracking-[0.04em] text-neutral-500 dark:text-neutral-400 uppercase leading-none">
            DATA HEALTH
          </p>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <span>Details</span>
            <ChevronRight className="size-3 text-neutral-400" />
          </button>
        </div>
        <p className="mt-[15px] text-[13px] text-neutral-800 dark:text-neutral-200 leading-normal">
          0 unexplained gaps · 2 EUR invoices converted at daily rate
        </p>
      </div>
    </section>
  );
}
