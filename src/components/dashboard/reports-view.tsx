"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Download,
  MoreHorizontal,
  Copy,
  ExternalLink,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "@/components/icons";
import { toast } from "sonner";

interface Transaction {
  id: string;
  customer: string;
  email: string;
  source: string;
  amount: string;
  date: string;
  status: "completed" | "processing" | "pending" | "failed";
}

const allTransactions: Transaction[] = [
  { id: "in_1Oq8A2Lkd", customer: "Acme Cloud Corp", email: "billing@acme.io", source: "Stripe", amount: "$2,450.00", date: "Today, 09:42", status: "completed" },
  { id: "in_1Oq8B1Lkd", customer: "Canguard Security", email: "finance@canguard.com", source: "Stripe", amount: "$1,890.00", date: "Today, 09:42", status: "completed" },
  { id: "in_1Oq8C9Lkd", customer: "Byteforge Labs", email: "admin@byteforge.dev", source: "Stripe", amount: "$840.00", date: "Today, 03:00", status: "processing" },
  { id: "in_1Oq8D4Lkd", customer: "OmniCorp Global", email: "pay@omnicorp.net", source: "Stripe", amount: "$3,200.00", date: "Yesterday, 21:00", status: "completed" },
  { id: "in_1Oq8E7Lkd", customer: "HyperScale AI", email: "founder@hyperscale.ai", source: "Stripe", amount: "$490.00", date: "Yesterday, 15:00", status: "pending" },
  { id: "in_1Oq8F3Lkd", customer: "Segnalio Data Ltd", email: "ops@segnalio.co", source: "Stripe", amount: "$1,250.00", date: "Jul 14, 18:22", status: "completed" },
  { id: "in_1Oq8G8Lkd", customer: "Vanguard Tech Inc", email: "dev@vanguard.org", source: "Stripe", amount: "$720.00", date: "Jul 14, 11:05", status: "failed" },
];

export function ReportsView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const filtered = allTransactions.filter((tx) => {
    const matchesSearch =
      tx.customer.toLowerCase().includes(search.toLowerCase()) ||
      tx.email.toLowerCase().includes(search.toLowerCase()) ||
      tx.id.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((t) => t.id));
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard", { description: text });
  };

  const handleExport = () => {
    toast.success("CSV export ready", {
      description: `Exported ${filtered.length} transaction records.`,
    });
  };

  return (
    <div className="flex flex-col space-y-5 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-neutral-900 dark:text-neutral-100 leading-tight">
            Transactions
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Payments and invoices across connected sources.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="h-9 gap-1.5 text-[12px] font-medium border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by customer, email or ID..."
            className="pl-9 h-[36px] text-[13px] bg-white dark:bg-[#141417] border-neutral-200/90 dark:border-neutral-800 rounded-lg text-neutral-900 dark:text-neutral-100 focus-visible:ring-1 focus-visible:ring-neutral-400"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All" },
            { id: "completed", label: "Completed" },
            { id: "processing", label: "Processing" },
            { id: "pending", label: "Pending" },
            { id: "failed", label: "Failed" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setStatusFilter(st.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer shrink-0 ${
                statusFilter === st.id
                  ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200/70 dark:hover:bg-neutral-700"
              }`}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* Shadcn Table */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-neutral-50/70 dark:bg-neutral-900/60 border-b border-neutral-200/70 dark:border-neutral-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 px-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedIds.length === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0 cursor-pointer"
                />
              </TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Invoice ID</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Customer</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Source</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Date & Time</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 text-right pr-6">Amount</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Status</TableHead>
              <TableHead className="w-10 text-right pr-4 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-neutral-400 dark:text-neutral-500 text-[13px]">
                  No matching transaction records found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tx) => (
                <TableRow
                  key={tx.id}
                  className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-900/50 transition-colors border-neutral-100 dark:border-neutral-800/80 ${
                    selectedIds.includes(tx.id) ? "bg-neutral-50/90 dark:bg-neutral-900/70" : ""
                  }`}
                >
                  <TableCell className="px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(tx.id)}
                      onChange={() => toggleSelect(tx.id)}
                      className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell className="font-mono text-[12px] text-neutral-800 dark:text-neutral-200 font-medium">
                    {tx.id}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                        {tx.customer}
                      </span>
                      <span className="text-[11.5px] text-neutral-400 dark:text-neutral-500 leading-tight">
                        {tx.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-600 dark:text-neutral-300">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-indigo-500"></span>
                      {tx.source}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                    {tx.date}
                  </TableCell>
                  <TableCell className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 text-right pr-6">
                    {tx.amount}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                        tx.status === "completed"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          : tx.status === "processing"
                          ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                          : tx.status === "pending"
                          ? "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                          : "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                      }`}
                    >
                      {tx.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right pr-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-[#18181c] rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800">
                        <DropdownMenuItem
                          onClick={() => handleCopy(tx.id)}
                          className="flex items-center gap-2 text-[12.5px] text-neutral-700 dark:text-neutral-200 cursor-pointer"
                        >
                          <Copy className="size-3.5 text-neutral-500" />
                          <span>Copy Invoice ID</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.info(`Opening Stripe portal for ${tx.id}`)}
                          className="flex items-center gap-2 text-[12.5px] text-neutral-700 dark:text-neutral-200 cursor-pointer"
                        >
                          <ExternalLink className="size-3.5 text-neutral-500" />
                          <span>View on Stripe</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.warning(`Refund dialog queued for ${tx.id}`)}
                          className="flex items-center gap-2 text-[12.5px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                        >
                          <RotateCcw className="size-3.5" />
                          <span>Issue Refund</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200/70 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-900/40 text-[12px] text-neutral-500 dark:text-neutral-400">
          <span>
            Showing <strong className="text-neutral-800 dark:text-neutral-200">1-{filtered.length}</strong> of{" "}
            <strong className="text-neutral-800 dark:text-neutral-200">1,204</strong> transactions
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="h-7 px-2 text-[11.5px] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              <ChevronLeft className="size-3.5 mr-0.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setPage((p) => p + 1);
                toast.info("Fetched next 10 transactions");
              }}
              className="h-7 px-2 text-[11.5px] border-neutral-200 dark:border-neutral-800 text-neutral-700 dark:text-neutral-300 cursor-pointer"
            >
              Next
              <ChevronRight className="size-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
