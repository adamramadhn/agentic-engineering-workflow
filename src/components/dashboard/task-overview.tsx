"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Filter, Folder, Layout, Search, User, X } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-clean";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { taskStatuses, taskStatusIcons, formatTaskDate, type Task, type TaskStatus } from "./task-data";

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const Icon = taskStatusIcons[status];
  return <Badge variant={status === "Completed" ? "secondary" : "outline"}><Icon data-icon="inline-start" />{status}</Badge>;
}

const columns = [
  { label: "Task", icon: Layout },
  { label: "Project", icon: Folder },
  { label: "Assignee", icon: User },
  { label: "Status", icon: CheckCircle2 },
  { label: "Priority", icon: Filter },
  { label: "Due date", icon: Calendar },
];

export function TaskOverview({ tasks, onOpenTask }: { tasks: Task[]; onOpenTask: (task: Task) => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<TaskStatus | "All">("All");
  const [priority, setPriority] = useState("All");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const filtered = tasks.filter(task =>
    (status === "All" || task.status === status) &&
    (priority === "All" || task.priority === priority) &&
    `${task.title} ${task.project} ${task.assignee.name} ${task.id}`.toLowerCase().includes(query.toLowerCase())
  );
  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selectedOnPage = visible.filter(task => selected.has(task.id)).length;

  function selectTask(id: string, checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  }

  function selectPage(checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      for (const task of visible) {
        if (checked) next.add(task.id); else next.delete(task.id);
      }
      return next;
    });
  }

  return (
    <section className="task-sheet min-w-0" aria-labelledby="task-overview-title">
      <Tabs value={status} onValueChange={value => { setStatus(value as TaskStatus | "All"); setPage(0); }} className="gap-0">
        <div className="task-sheet-views overflow-x-auto">
          <TabsList variant="line" aria-label="Filter tasks by status">
            {(["All", ...taskStatuses] as const).map(item => {
              const Icon = item === "All" ? Layout : taskStatusIcons[item];
              return <TabsTrigger key={item} value={item}><Icon aria-hidden="true" />{item === "All" ? "All tasks" : item}</TabsTrigger>;
            })}
          </TabsList>
        </div>
        <div className="task-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Layout className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <h2 id="task-overview-title">Task workspace</h2>
            <span className="task-sheet-count tabular-nums">{tasks.length}</span>
          </div>
          <div className="flex w-full min-w-0 gap-2 sm:w-auto">
            <InputGroup className="min-w-0 flex-1 sm:w-48">
              <InputGroupInput aria-label="Search tasks" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Search tasks…" />
              <InputGroupAddon><Search /></InputGroupAddon>
              {query && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear task search" onClick={() => { setQuery(""); setPage(0); }}><X /></InputGroupButton></InputGroupAddon>}
            </InputGroup>
            <Select value={priority} onValueChange={value => { setPriority(value ?? "All"); setPage(0); }}>
              <SelectTrigger aria-label="Filter by priority"><Filter /><SelectValue>{priority === "All" ? "Priority" : priority}</SelectValue></SelectTrigger>
              <SelectContent><SelectGroup>{["All", "High", "Medium", "Low"].map(item => <SelectItem key={item} value={item}>{item === "All" ? "All priorities" : item}</SelectItem>)}</SelectGroup></SelectContent>
            </Select>
          </div>
        </div>
        <TabsContent value={status} className="min-w-0">
          <div className="task-sheet-scroll" role="region" aria-label="Tasks spreadsheet, scroll horizontally for more columns" tabIndex={0}>
            <Table className="min-w-[960px]" aria-label="Tasks">
              <TableHeader><TableRow>
                <TableHead scope="col" className="task-sheet-select">
                  <Checkbox aria-label="Select all tasks on this page" checked={visible.length > 0 && selectedOnPage === visible.length} indeterminate={selectedOnPage > 0 && selectedOnPage < visible.length} disabled={!visible.length} onCheckedChange={selectPage} />
                </TableHead>
                {columns.map(({ label, icon: Icon }) => <TableHead scope="col" key={label}>
                  <span className="flex items-center gap-2"><Icon className="size-3.5 shrink-0" aria-hidden="true" />{label}</span>
                </TableHead>)}
              </TableRow></TableHeader>
              <TableBody>
                {visible.map(task => (
                  <TableRow key={task.id} data-state={selected.has(task.id) ? "selected" : undefined}>
                    <TableCell className="task-sheet-select"><Checkbox aria-label={`Select ${task.id}`} checked={selected.has(task.id)} onCheckedChange={checked => selectTask(task.id, checked)} /></TableCell>
                    <TableCell><button type="button" onClick={() => onOpenTask(task)} className="task-sheet-name flex items-center gap-2.5 text-start">
                      <span className="task-sheet-task-icon"><Folder className="size-3.5" aria-hidden="true" /></span>
                      {task.title}
                    </button></TableCell>
                    <TableCell><span className="task-sheet-project">{task.project}</span></TableCell>
                    <TableCell>{task.assignee.name}</TableCell>
                    <TableCell><TaskStatusBadge status={task.status} /></TableCell>
                    <TableCell><Badge variant="outline">{task.priority}</Badge></TableCell>
                    <TableCell><time dateTime={task.dueDate}>{formatTaskDate(task.dueDate)}</time></TableCell>
                  </TableRow>
                ))}
                {!visible.length && <TableRow><TableCell colSpan={7} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><p className="text-muted-foreground">No matching tasks</p><Button variant="secondary" size="sm" onClick={() => { setQuery(""); setStatus("All"); setPriority("All"); setPage(0); }}>Reset filters</Button></div></TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      <div className="task-sheet-footer flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <p aria-live="polite">{selected.size ? `${selected.size} selected` : `${filtered.length ? currentPage * pageSize + 1 : 0}–${Math.min((currentPage + 1) * pageSize, filtered.length)} of ${filtered.length} tasks`}</p>
          {selected.size > 0 && <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>Clear selection</Button>}
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:inline">Click a task to open details</span>
          <span className="tabular-nums">{currentPage + 1} / {pageCount}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" icon={<ArrowLeft />} aria-label="Previous task page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} />
            <Button variant="ghost" size="sm" icon={<ArrowRight />} aria-label="Next task page" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)} />
          </div>
        </div>
      </div>
    </section>
  );
}
