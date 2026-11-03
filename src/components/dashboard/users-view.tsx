"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Calendar, CheckCircle2, Filter, Mail, Search, User, UserCheck, Users, X } from "@/components/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button-clean";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { FilterMenu, type FilterValue } from "@/components/ui/filter-menu-clean";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { apiFetch } from "@/lib/api";

type DirectoryUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  team: string;
  joined: string;
};
const columns = [
  { label: "Name", icon: User }, { label: "Email", icon: Mail },
  { label: "Role", icon: Filter }, { label: "Team", icon: Users },
  { label: "Status", icon: CheckCircle2 }, { label: "Joined", icon: Calendar },
];
const formatDate = (date: string) => new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));

export function UsersView() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({});
  const roles = filters.role ?? [];
  const [view, setView] = useState("All");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [openedUser, setOpenedUser] = useState<DirectoryUser | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [users, setUsers] = useState<DirectoryUser[]>([]);

  const loadUsers = useCallback(() => {
    apiFetch("/api/users")
      .then(res => (res.ok ? res.json() : null))
      .then(data => { if (data?.users) setUsers(data.users); })
      .catch(() => { /* keep the previous list on transient network errors */ });
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const filtered = users.filter(user => (view === "All" || user.status === view) && (!roles.length || roles.includes(user.role)) && `${user.name} ${user.email} ${user.team} ${user.id}`.toLowerCase().includes(query.toLowerCase()));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const visible = filtered.slice(page * 10, (page + 1) * 10);
  const selectedOnPage = visible.filter(user => selected.has(user.id)).length;

  function selectUsers(ids: string[], checked: boolean) {
    setSelected(previous => {
      const next = new Set(previous);
      for (const id of ids) { if (checked) next.add(id); else next.delete(id); }
      return next;
    });
  }

  return (
    <section aria-label="User administration" className="users-workspace flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">Users</h1>
      <Tabs value={view} onValueChange={value => { setView(String(value)); setPage(0); setSelected(new Set()); }}>
        <div className="users-viewbar flex min-w-0 flex-wrap items-center justify-between gap-3">
          <TabsList variant="line" aria-label="User views">
            {[{ value: "All", label: "All users", icon: Users }, { value: "Active", label: "Active", icon: CheckCircle2 }, { value: "Invited", label: "Invited", icon: Mail }, { value: "Inactive", label: "Inactive", icon: User }].map(({ value, label, icon: Icon }) => (
              <TabsTrigger key={value} value={value}><span className="users-view-icon" aria-hidden="true"><Icon /></span>{label}</TabsTrigger>
            ))}
          </TabsList>
          <div className="users-controls flex w-full min-w-0 gap-2 sm:w-auto">
            <InputGroup className="min-w-0 flex-1 sm:w-56">
              <InputGroupInput aria-label="Search users" placeholder="Search users…" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
              <InputGroupAddon><Search /></InputGroupAddon>
              {query && <InputGroupAddon align="inline-end"><InputGroupButton size="icon-xs" aria-label="Clear user search" onClick={() => { setQuery(""); setPage(0); }}><X /></InputGroupButton></InputGroupAddon>}
            </InputGroup>
            <Popover>
              <PopoverTrigger render={<Button size="lg" variant="secondary" className="users-role-trigger" icon={<Filter />} aria-label="Filter by role" />}>
                {roles.length ? `Role · ${roles.length}` : "Role"}
              </PopoverTrigger>
              <PopoverContent unstyled align="end" className="users-role-popover">
                <PopoverTitle className="sr-only">Filter users by role</PopoverTitle>
                <FilterMenu title="Filters" groups={[{ id: "role", label: "Role", options: ["Admin", "Editor", "Member"].map(role => ({ id: role, label: role })) }]} value={filters} onChange={value => { setFilters(value); setPage(0); }} />
              </PopoverContent>
            </Popover>
            <Button size="lg" icon={<UserCheck />} onClick={() => setAddOpen(true)}>Add user</Button>
          </div>
        </div>
        <TabsContent value={view}>
        <section className="task-sheet users-sheet min-w-0" aria-labelledby="users-table-title">
          <div className="task-sheet-toolbar flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5"><Users className="size-4" aria-hidden="true" /><h2 id="users-table-title">Users directory</h2></div>
            <span className="task-sheet-count tabular-nums">{filtered.length} users</span>
          </div>
        <div className="task-sheet-scroll" role="region" aria-label="Users spreadsheet, scroll horizontally for more columns" tabIndex={0}>
          <Table aria-label="Users" className="min-w-[1040px]">
            <colgroup><col style={{ width: "4%" }} /><col style={{ width: "22%" }} /><col style={{ width: "24%" }} /><col style={{ width: "11%" }} /><col style={{ width: "14%" }} /><col style={{ width: "11%" }} /><col style={{ width: "14%" }} /></colgroup>
            <TableHeader><TableRow>
              <TableHead className="task-sheet-select" scope="col"><Checkbox aria-label="Select all users on this page" checked={visible.length > 0 && selectedOnPage === visible.length} indeterminate={selectedOnPage > 0 && selectedOnPage < visible.length} disabled={!visible.length} onCheckedChange={checked => selectUsers(visible.map(user => user.id), checked)} /></TableHead>
              {columns.map(({ label, icon: Icon }) => <TableHead key={label} scope="col"><span className="flex items-center gap-2"><Icon className="size-3.5" aria-hidden="true" />{label}</span></TableHead>)}
            </TableRow></TableHeader>
            <TableBody>
              {visible.map(user => <TableRow key={user.id} data-state={selected.has(user.id) ? "selected" : undefined}>
                <TableCell className="task-sheet-select"><Checkbox aria-label={`Select ${user.name}`} checked={selected.has(user.id)} onCheckedChange={checked => selectUsers([user.id], checked)} /></TableCell>
                <TableCell><button type="button" onClick={() => setOpenedUser(user)} className="task-sheet-name flex items-center gap-2.5 text-start"><Avatar size="sm" aria-hidden="true"><AvatarFallback>{user.name.split(" ").map(part => part[0]).join("")}</AvatarFallback></Avatar>{user.name}</button></TableCell>
                <TableCell><button type="button" className="users-email" onClick={() => setOpenedUser(user)} aria-label={`View email details for ${user.name}`}>{user.email}</button></TableCell>
                <TableCell><Badge variant={user.role === "Admin" ? "secondary" : "outline"} data-role={user.role}>{user.role}</Badge></TableCell>
                <TableCell>{user.team}</TableCell>
                <TableCell><Badge variant="outline" data-status={user.status}><span className="users-status-dot" aria-hidden="true" />{user.status}</Badge></TableCell>
                <TableCell><time dateTime={user.joined}>{formatDate(user.joined)}</time></TableCell>
              </TableRow>)}
              {!visible.length && <TableRow><TableCell colSpan={7} className="h-32 text-center"><div className="flex flex-col items-center gap-2"><p>No matching users</p><Button size="sm" variant="secondary" onClick={() => { setQuery(""); setFilters({}); setView("All"); setPage(0); }}>Reset filters</Button></div></TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
        <div className="task-sheet-footer flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3"><p aria-live="polite">{selected.size ? `${selected.size} selected` : `${filtered.length ? page * 10 + 1 : 0}–${Math.min((page + 1) * 10, filtered.length)} of ${filtered.length} users`}</p>{selected.size > 0 && <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear selection</Button>}</div>
          <div className="flex items-center gap-3"><span className="hidden sm:inline">Click a user to open details</span><span className="tabular-nums">{page + 1} / {pageCount}</span><div className="flex items-center gap-1"><Button size="sm" variant="ghost" icon={<ArrowLeft />} aria-label="Previous user page" disabled={page === 0} onClick={() => setPage(page - 1)} /><Button size="sm" variant="ghost" icon={<ArrowRight />} aria-label="Next user page" disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)} /></div></div>
        </div>
        </section>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-muted-foreground">Sample users · Demo workspace only. No account permissions are changed.</p>
      <Dialog open={openedUser !== null} onOpenChange={open => { if (!open) setOpenedUser(null); }}>
        <DialogContent className="sm:max-w-md">
          {openedUser && <><DialogHeader><DialogTitle>{openedUser.name}</DialogTitle><DialogDescription>{openedUser.email} · {openedUser.id}</DialogDescription></DialogHeader><dl className="grid grid-cols-2 gap-4 text-sm">{[["Role", openedUser.role], ["Team", openedUser.team], ["Status", openedUser.status], ["Joined", formatDate(openedUser.joined)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1">{value}</dd></div>)}</dl></>}
        </DialogContent>
      </Dialog>
      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onAdded={loadUsers} />
    </section>
  );
}

const ROLE_OPTIONS = ["Admin", "Editor", "Member"];
const TEAM_OPTIONS = ["Design", "Engineering", "Marketing", "Operations", "General"];

function AddUserDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Member");
  const [team, setTeam] = useState("General");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setName("");
    setEmail("");
    setPassword("");
    setRole("Member");
    setTeam("General");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const res = await apiFetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role, team }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Failed to add user");
        return;
      }
      toast.success(`Added ${data.user?.name ?? name}`);
      resetForm();
      onOpenChange(false);
      await onAdded();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { if (!value) { resetForm(); } onOpenChange(value); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>Create a new account for this workspace.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="add-user-name" className="text-xs font-medium text-muted-foreground">Full name</label>
            <Input id="add-user-name" name="name" value={name} onChange={event => setName(event.target.value)} placeholder="Alex Morgan" required autoComplete="name" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="add-user-email" className="text-xs font-medium text-muted-foreground">Work email</label>
            <Input id="add-user-email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" required autoComplete="email" />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="add-user-password" className="text-xs font-medium text-muted-foreground">Password</label>
            <Input id="add-user-password" name="password" type="password" value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete="new-password" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <span id="add-user-role-label" className="text-xs font-medium text-muted-foreground">Role</span>
              <Select value={role} onValueChange={value => setRole(value ?? "Member")}>
                <SelectTrigger aria-labelledby="add-user-role-label" className="w-full"><SelectValue>{role}</SelectValue></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <span id="add-user-team-label" className="text-xs font-medium text-muted-foreground">Team</span>
              <Select value={team} onValueChange={value => setTeam(value ?? "General")}>
                <SelectTrigger aria-labelledby="add-user-team-label" className="w-full"><SelectValue>{team}</SelectValue></SelectTrigger>
                <SelectContent>{TEAM_OPTIONS.map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" size="lg" variant="secondary" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" size="lg" loading={saving}>Add user</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
