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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Plus,
  MoreHorizontal,
  Mail,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  TrendingUp,
  UserCheck,
} from "@/components/icons";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  avatarSeed: string;
  tier: "Enterprise" | "Pro" | "Starter";
  status: "Active" | "Trial" | "Inactive";
  totalSpent: string;
  invoicesCount: number;
  joined: string;
}

const mockCustomers: Customer[] = [
  {
    id: "cus_1",
    name: "Elena Rostova",
    email: "elena@acmecloud.io",
    company: "Acme Cloud Corp",
    avatarSeed: "Elena",
    tier: "Enterprise",
    status: "Active",
    totalSpent: "$24,500.00",
    invoicesCount: 18,
    joined: "Jan 12, 2025",
  },
  {
    id: "cus_2",
    name: "Marcus Vance",
    email: "marcus@canguard.com",
    company: "Canguard Security",
    avatarSeed: "Marcus",
    tier: "Enterprise",
    status: "Active",
    totalSpent: "$18,900.00",
    invoicesCount: 14,
    joined: "Feb 03, 2025",
  },
  {
    id: "cus_3",
    name: "Sophia Zhang",
    email: "sophia@byteforge.dev",
    company: "Byteforge Labs",
    avatarSeed: "Sophia",
    tier: "Pro",
    status: "Active",
    totalSpent: "$8,400.00",
    invoicesCount: 9,
    joined: "Mar 19, 2025",
  },
  {
    id: "cus_4",
    name: "David Kelling",
    email: "dk@omnicorp.net",
    company: "OmniCorp Global",
    avatarSeed: "David",
    tier: "Enterprise",
    status: "Active",
    totalSpent: "$32,000.00",
    invoicesCount: 22,
    joined: "Apr 04, 2025",
  },
  {
    id: "cus_5",
    name: "Aria Thorne",
    email: "aria@hyperscale.ai",
    company: "HyperScale AI",
    avatarSeed: "Aria",
    tier: "Pro",
    status: "Trial",
    totalSpent: "$1,490.00",
    invoicesCount: 2,
    joined: "Jul 01, 2026",
  },
  {
    id: "cus_6",
    name: "Julian Gomez",
    email: "julian@segnalio.co",
    company: "Segnalio Data Ltd",
    avatarSeed: "Julian",
    tier: "Pro",
    status: "Active",
    totalSpent: "$12,500.00",
    invoicesCount: 11,
    joined: "May 15, 2025",
  },
  {
    id: "cus_7",
    name: "Claire Becker",
    email: "claire@vanguard.org",
    company: "Vanguard Tech Inc",
    avatarSeed: "Claire",
    tier: "Starter",
    status: "Inactive",
    totalSpent: "$720.00",
    invoicesCount: 1,
    joined: "Jun 28, 2026",
  },
];

export function CustomersView() {
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  const filtered = mockCustomers.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase());
    const matchesTier = tierFilter === "all" || c.tier.toLowerCase() === tierFilter.toLowerCase();
    return matchesSearch && matchesTier;
  });

  const toggleSelect = (id: string) => {
    setSelectedCustomers((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedCustomers.length === filtered.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filtered.map((c) => c.id));
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-neutral-900 dark:text-neutral-100 leading-tight">
            Customers
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Manage customers and subscriptions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => toast.info("New customer modal opened")}
            className="h-8 gap-1.5 text-[12px] bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-100 rounded-lg cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Customers", value: "3,420", change: "+12.4%", icon: Users },
          { label: "Active Subscriptions", value: "1,204", change: "+4.2%", icon: UserCheck },
          { label: "Average LTV", value: "$1,840.50", change: "+8.1%", icon: DollarSign },
          { label: "Gross Churn Rate", value: "0.78%", change: "-0.15%", icon: TrendingUp },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <Card
              key={idx}
              className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none"
            >
              <CardContent className="p-3.5 sm:p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
                    {kpi.label}
                  </span>
                  <div className="size-6 rounded-md bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-300">
                    <Icon className="size-3.5" />
                  </div>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-[20px] font-semibold text-neutral-900 dark:text-neutral-100 tracking-tight">
                    {kpi.value}
                  </span>
                  <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    {kpi.change}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-neutral-400 pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, company, or email..."
            className="pl-9 h-[36px] text-[13px] bg-white dark:bg-[#121215] border-neutral-200/90 dark:border-neutral-800 rounded-lg focus-visible:ring-1 focus-visible:ring-neutral-400"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: "all", label: "All Tiers" },
            { id: "enterprise", label: "Enterprise" },
            { id: "pro", label: "Pro" },
            { id: "starter", label: "Starter" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTierFilter(t.id)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition-colors cursor-pointer shrink-0 ${
                tierFilter === t.id
                  ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
                  : "bg-neutral-100 dark:bg-neutral-800/80 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/70 dark:hover:bg-neutral-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] overflow-hidden shadow-2xs">
        <Table>
          <TableHeader className="bg-neutral-50/70 dark:bg-neutral-900/40 border-b border-neutral-200/70 dark:border-neutral-800">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 px-3 text-center">
                <input
                  type="checkbox"
                  checked={selectedCustomers.length === filtered.length && filtered.length > 0}
                  onChange={selectAll}
                  className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0 cursor-pointer"
                />
              </TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Customer</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Company</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Tier</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Status</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400 text-right pr-6">LTV / Spent</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Invoices</TableHead>
              <TableHead className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Joined</TableHead>
              <TableHead className="w-10 text-right pr-4 text-[12px] font-medium text-neutral-500 dark:text-neutral-400">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-32 text-center text-neutral-400 text-[13px]">
                  No matching customers found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((customer) => (
                <TableRow
                  key={customer.id}
                  className={`hover:bg-neutral-50/70 dark:hover:bg-neutral-900/60 transition-colors ${
                    selectedCustomers.includes(customer.id) ? "bg-neutral-50/90 dark:bg-neutral-900/70" : ""
                  }`}
                >
                  <TableCell className="px-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCustomers.includes(customer.id)}
                      onChange={() => toggleSelect(customer.id)}
                      className="rounded border-neutral-300 dark:border-neutral-700 text-neutral-900 focus:ring-0 cursor-pointer"
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200/80 dark:border-neutral-700">
                        <AvatarImage
                          src={`https://api.dicebear.com/7.x/notionists/png?seed=${customer.avatarSeed}&size=400&backgroundColor=f5f5f5`}
                          alt={customer.name}
                          className="size-full object-cover scale-[1.25] origin-center"
                        />
                        <AvatarFallback className="text-[11px] font-semibold">
                          {customer.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-[13px] font-medium text-neutral-900 dark:text-neutral-100 leading-tight">
                          {customer.name}
                        </span>
                        <span className="text-[11.5px] text-neutral-400 leading-tight mt-0.5">
                          {customer.email}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-700 dark:text-neutral-300 font-medium">
                    {customer.company}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-[11px] font-medium border ${
                        customer.tier === "Enterprise"
                          ? "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900"
                          : customer.tier === "Pro"
                          ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                          : "bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-700"
                      }`}
                    >
                      {customer.tier}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-600 dark:text-neutral-400">
                      <span
                        className={`size-1.5 rounded-full ${
                          customer.status === "Active"
                            ? "bg-emerald-500"
                            : customer.status === "Trial"
                            ? "bg-amber-500"
                            : "bg-neutral-400"
                        }`}
                      />
                      {customer.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-[13px] font-semibold text-neutral-900 dark:text-neutral-100 text-right pr-6">
                    {customer.totalSpent}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-neutral-500 dark:text-neutral-400">
                    {customer.invoicesCount} invoices
                  </TableCell>
                  <TableCell className="text-[12px] text-neutral-500 dark:text-neutral-400">
                    {customer.joined}
                  </TableCell>
                  <TableCell className="text-right pr-3">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="p-1 rounded-md text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer">
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44 bg-white dark:bg-[#141417] rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-800">
                        <DropdownMenuItem
                          onClick={() => toast.success(`Email drafted to ${customer.email}`)}
                          className="flex items-center gap-2 text-[12.5px] cursor-pointer"
                        >
                          <Mail className="size-3.5 text-neutral-500" />
                          <span>Send Email</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => toast.info(`Viewing transactions for ${customer.name}`)}
                          className="flex items-center gap-2 text-[12.5px] cursor-pointer"
                        >
                          <ExternalLink className="size-3.5 text-neutral-500" />
                          <span>View Invoices</span>
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
            <strong className="text-neutral-800 dark:text-neutral-200">3,420</strong> customers
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-7 px-2 text-[11.5px] border-neutral-200 dark:border-neutral-800 cursor-pointer"
            >
              <ChevronLeft className="size-3.5 mr-0.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Fetched page 2 of customer directory")}
              className="h-7 px-2 text-[11.5px] border-neutral-200 dark:border-neutral-800 cursor-pointer"
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
