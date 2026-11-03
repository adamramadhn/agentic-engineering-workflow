"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { toast } from "sonner";

const metricsChartData = [
  { day: "Mon", sessions: 4200, completed: 3780 },
  { day: "Tue", sessions: 5100, completed: 4620 },
  { day: "Wed", sessions: 4900, completed: 4410 },
  { day: "Thu", sessions: 6200, completed: 5740 },
  { day: "Fri", sessions: 5800, completed: 5220 },
  { day: "Sat", sessions: 3900, completed: 3510 },
  { day: "Sun", sessions: 4400, completed: 3960 },
];

const metricsChartConfig = {
  sessions: {
    label: "Total Sessions",
    color: "#18181b",
  },
  completed: {
    label: "Completed Checkouts",
    color: "#10b981",
  },
} satisfies ChartConfig;

export function MetricsView() {
  const [range, setRange] = useState("30d");
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const barMainColor = isDark ? "#ffffff" : "#18181b";

  const handleRangeChange = (val: string) => {
    setRange(val);
    toast.info(`Updated analytics window to ${val}`);
  };

  return (
    <div className="flex flex-col space-y-6 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 dark:border-neutral-800 pb-4">
        <div>
          <h1 className="text-[24px] font-semibold tracking-[-0.4px] text-neutral-900 dark:text-neutral-100 leading-tight">
            Metrics
          </h1>
          <p className="mt-1 text-[13px] text-neutral-500 dark:text-neutral-400">
            Checkout conversion and payment performance.
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex items-center gap-1.5 bg-[#f0f0f1] dark:bg-[#18181c] p-1 rounded-lg">
          {[
            { id: "7d", label: "7 Days" },
            { id: "30d", label: "30 Days" },
            { id: "90d", label: "Quarter" },
            { id: "12m", label: "12 Months" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleRangeChange(item.id)}
              className={`rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors cursor-pointer ${
                range === item.id
                  ? "bg-white dark:bg-[#24242a] text-neutral-900 dark:text-white shadow-2xs"
                  : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Funnel Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              Checkout Views
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[24px] font-semibold text-neutral-900 dark:text-neutral-100">
              34,500
            </div>
            <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              +12.4% vs prev period
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              Checkout Conversions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[24px] font-semibold text-neutral-900 dark:text-neutral-100">
              1,204
            </div>
            <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              3.49% overall conversion
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              Average Cart Lifetime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[24px] font-semibold text-neutral-900 dark:text-neutral-100">
              4.2 mins
            </div>
            <p className="text-[11.5px] text-neutral-400 dark:text-neutral-500 mt-1">
              -18s reduction in friction
            </p>
          </CardContent>
        </Card>

        <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none hover:border-neutral-300 dark:hover:border-neutral-700 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="text-[12px] font-medium text-neutral-500 dark:text-neutral-400">
              API Webhook Throughput
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-[24px] font-semibold text-neutral-900 dark:text-neutral-100">
              2.4M reqs
            </div>
            <p className="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              99.98% delivery rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Traffic vs Conversion Chart */}
      <Card className="border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-[#121215] shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-[14.5px] font-semibold text-neutral-900 dark:text-neutral-100">
              Checkout Sessions vs Successful Completions
            </CardTitle>
            <CardDescription className="text-[12px] text-neutral-500 dark:text-neutral-400">
              Daily customer velocity through the Stripe checkout pipeline
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[11px] font-normal bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
              <span className="size-2 rounded-full bg-[#18181b] dark:bg-neutral-100 mr-1.5"></span>
              Total Sessions
            </Badge>
            <Badge variant="outline" className="text-[11px] font-normal bg-neutral-50 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300">
              <span className="size-2 rounded-full bg-[#10b981] mr-1.5"></span>
              Completed Checkouts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-1">
          <ChartContainer config={metricsChartConfig} className="h-[270px] w-full">
            <BarChart data={metricsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#888888" strokeOpacity={0.15} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#888888" }} />
              <YAxis width={40} tickLine={false} axisLine={false} tickFormatter={(val) => `${Math.round(val / 1000)}k`} tick={{ fontSize: 11, fill: "#888888" }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="sessions" fill={barMainColor} radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
              <Bar dataKey="completed" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={20} isAnimationActive={false} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  );
}
