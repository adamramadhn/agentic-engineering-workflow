"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { EChartsAreaChart, type EChartsAreaChartProps } from "@/components/evilcharts/charts/echarts-area-chart";
import { EChartsBarChart, type EChartsBarChartProps } from "@/components/evilcharts/charts/echarts-bar-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/echarts-chart";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableCaption } from "@/components/ui/table";
import { formatTaskDate, type Task } from "./task-data";

type ChartRow = { label: string; tasks: number };
const config = {
  tasks: { label: "Tasks", colors: { light: ["#525252"], dark: ["#d4d4d4"] } },
} satisfies ChartConfig;

// Preserve the registry's resolved theme and tooltip while refining chart geometry.
type ScheduleTransform = Extract<EChartsAreaChartProps<ChartRow>["chartOptions"], (...args: never[]) => unknown>;
type BarTransform = Extract<EChartsBarChartProps<ChartRow>["chartOptions"], (...args: never[]) => unknown>;
const scheduleOptions: ScheduleTransform = option => {
  const axes = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis ?? {}];
  const categories = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis ?? {}];
  for (const axis of [...axes, ...categories]) {
    if (axis.axisLabel) axis.axisLabel.fontSize = 11;
  }
  return {
    ...option,
    yAxis: axes.map(axis => ({
      ...axis,
      min: 0,
      minInterval: 1,
      splitNumber: 3,
      splitLine: { ...axis.splitLine, lineStyle: { ...axis.splitLine?.lineStyle, type: "solid" } },
    })),
  };
};

const barOptions: BarTransform = option => {
  const axes = Array.isArray(option.xAxis) ? option.xAxis : [option.xAxis ?? {}];
  const categories = Array.isArray(option.yAxis) ? option.yAxis : [option.yAxis ?? {}];
  const series = Array.isArray(option.series) ? option.series : [option.series ?? {}];
  const tooltip = Array.isArray(option.tooltip) ? option.tooltip[0] : option.tooltip;
  for (const axis of [...axes, ...categories]) {
    if (axis.axisLabel) axis.axisLabel.fontSize = 11;
  }
  return {
    ...option,
    tooltip: { ...tooltip, trigger: "item" },
    xAxis: axes.map(axis => ({
      ...axis,
      min: 0,
      minInterval: 1,
      splitNumber: 3,
      splitLine: { ...axis.splitLine, lineStyle: { ...axis.splitLine?.lineStyle, type: "solid" } },
    })),
    yAxis: categories.map(axis => ({ ...axis, inverse: true })),
    series: series.map(series => ({ ...series, barMaxWidth: 14 })),
  };
};

function ChartData({ title, label, rows, scope }: { title: string; label: string; rows: ChartRow[]; scope: string }) {
  const [open, setOpen] = useState(false);
  return (
    <details className="w-full" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
      <summary className="w-fit cursor-pointer rounded-sm text-xs text-muted-foreground underline decoration-border underline-offset-4 outline-offset-4 hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
        {open ? "Hide data" : "View data"}
      </summary>
      {open && <Table className="mt-3">
        <TableCaption>{title} · {scope}.</TableCaption>
        <TableHeader><TableRow><TableHead scope="col">{label}</TableHead><TableHead scope="col" className="text-end">Tasks</TableHead></TableRow></TableHeader>
        <TableBody>{rows.map(row => <TableRow key={row.label}>
          <TableCell><bdi>{row.label}</bdi></TableCell><TableCell className="text-end tabular-nums">{row.tasks}</TableCell>
        </TableRow>)}</TableBody>
      </Table>}
    </details>
  );
}

function ChartPanel({ title, description, label, rows, scope, className, children }: {
  title: string; description: string; label: string; rows: ChartRow[]; scope: string; className: string; children: ReactNode;
}) {
  const id = useId();
  return (
    <Card size="sm" className={className} role="region" aria-labelledby={id}>
      <CardHeader>
        <CardTitle id={id} role="heading" aria-level={2}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="img" aria-label={`${title}. ${scope}. Open View data below for exact values.`}>
          {children}
        </div>
      </CardContent>
      <CardFooter><ChartData title={title} label={label} rows={rows} scope={scope} /></CardFooter>
    </Card>
  );
}

function TaskBars({ rows }: { rows: ChartRow[] }) {
  return (
    <EChartsBarChart data={rows} config={config} xDataKey="label" layout="horizontal" barRadius={4} className="h-44 w-full" chartOptions={barOptions}>
      <EChartsBarChart.Grid />
      <EChartsBarChart.XAxis hideDots />
      <EChartsBarChart.YAxis dataKey="label" hideDots />
      <EChartsBarChart.Tooltip />
      <EChartsBarChart.Bar dataKey="tasks" enableHoverHighlight />
    </EChartsBarChart>
  );
}

function rankedRows(counts: Map<string, number>): ChartRow[] {
  return [...counts].map(([label, tasks]) => ({ label, tasks })).sort((a, b) => b.tasks - a.tasks || a.label.localeCompare(b.label));
}

export function HomeCharts({ tasks }: { tasks: Task[] }) {
  const { schedule, projects, priorities, assignees } = useMemo(() => {
    const dates = new Map<string, number>();
    const projects = new Map<string, number>();
    const priorities = new Map<string, number>([["High", 0], ["Medium", 0], ["Low", 0]]);
    const assignees = new Map<string, number>();
    for (const task of tasks) {
      dates.set(task.dueDate, (dates.get(task.dueDate) ?? 0) + 1);
      projects.set(task.project, (projects.get(task.project) ?? 0) + 1);
      priorities.set(task.priority, (priorities.get(task.priority) ?? 0) + 1);
      assignees.set(task.assignee.name, (assignees.get(task.assignee.name) ?? 0) + (task.status === "Completed" ? 0 : 1));
    }
    const sortedDates = [...dates.keys()].sort();
    const schedule: ChartRow[] = [];
    // Include zero-task days so the time axis never compresses a gap.
    if (sortedDates.length) {
      const date = new Date(`${sortedDates[0]}T12:00:00Z`);
      const last = sortedDates[sortedDates.length - 1];
      while (date.toISOString().slice(0, 10) <= last) {
        const key = date.toISOString().slice(0, 10);
        schedule.push({ label: formatTaskDate(key), tasks: dates.get(key) ?? 0 });
        date.setUTCDate(date.getUTCDate() + 1);
      }
    }
    return {
      schedule,
      projects: rankedRows(projects),
      priorities: [...priorities].map(([label, tasks]) => ({ label, tasks })),
      assignees: rankedRows(assignees),
    };
  }, [tasks]);

  return (
    <section aria-label="Task analytics" className="home-analytics @container min-w-0">
      <div className="grid min-w-0 grid-cols-1 items-start gap-3 @3xl:grid-cols-12">
        <ChartPanel title="Task schedule" description="Tasks by due date · all statuses" label="Due date (2026)" rows={schedule} scope="Sample tasks, all statuses" className="min-w-0 @3xl:col-span-7">
          <EChartsAreaChart data={schedule} config={config} xDataKey="label" className="h-44 w-full" curveType="linear" chartOptions={scheduleOptions}>
            <EChartsAreaChart.Grid />
            <EChartsAreaChart.XAxis dataKey="label" hideDots />
            <EChartsAreaChart.YAxis hideDots />
            <EChartsAreaChart.Tooltip cursor />
            <EChartsAreaChart.Area dataKey="tasks" variant="gradient" strokeVariant="solid" strokeWidth={2}>
              <EChartsAreaChart.ActiveDot />
            </EChartsAreaChart.Area>
          </EChartsAreaChart>
        </ChartPanel>
        <ChartPanel title="Tasks by project" description={`${projects.length} projects · ${tasks.length} sample tasks`} label="Project" rows={projects} scope="Sample tasks, all statuses" className="min-w-0 @3xl:col-span-5">
          <TaskBars rows={projects} />
        </ChartPanel>
        <ChartPanel title="Task priorities" description="High, medium, and low · all statuses" label="Priority" rows={priorities} scope="Sample tasks, all statuses" className="min-w-0 @3xl:col-span-5">
          <TaskBars rows={priorities} />
        </ChartPanel>
        <ChartPanel title="Team workload" description="Open tasks by assignee · completed excluded" label="Assignee" rows={assignees} scope="Sample open tasks, completed excluded" className="min-w-0 @3xl:col-span-7">
          <TaskBars rows={assignees} />
        </ChartPanel>
      </div>
    </section>
  );
}
