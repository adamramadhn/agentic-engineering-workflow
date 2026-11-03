"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  Info,
  KeyRound,
  Plus,
  RefreshCw,
  Sliders,
  Trash2,
  Users,
} from "@/components/icons";
import { usePermission } from "@/components/dashboard/permission-provider";
import {
  PermissionToggles,
  toggleGroupInSet,
  toggleVerbInSet,
} from "@/components/dashboard/permission-toggles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-clean";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { PERMISSION_LABELS } from "@/lib/permissions";
import type { RoleResponse } from "@/lib/roles";

/**
 * The /roles client island (design §6). The RSC page hands it the first paint
 * (`initialRoles`); from the first mutation on, the island owns the list — every
 * successful save refetches `GET /api/roles` rather than patching local state,
 * so what is on screen is always what the audited API says.
 *
 * Grants are edited as the raw stored list (wildcards included); the toggles
 * display the *resolved* set, exactly like the API resolves it, so a
 * `resource.*` grant shows up as its group checked rather than as a key the
 * catalog never lists.
 */

/** Monotonic id so each create-drawer open remounts the form with its prefill. */
let nextDraftId = 1;

interface CreateDraft {
  id: number;
  name: string;
  description: string;
  permissions: string[];
}

/** Parse an API body without throwing on empty or non-JSON responses. Success
 *  bodies carry `role`; error bodies carry `error` and, on the two field-level
 *  rejections, `invalidPermissions` / `userCount`. */
async function readBody(response: Response): Promise<{
  role?: RoleResponse;
  error?: string;
  invalidPermissions?: string[];
  userCount?: number;
}> {
  return ((await response.json().catch(() => null)) ?? {}) as {
    role?: RoleResponse;
    error?: string;
    invalidPermissions?: string[];
    userCount?: number;
  };
}

/** Set equality between the drawer's working grants and a role's saved grants. */
function sameGrants(working: ReadonlySet<string>, saved: readonly string[]): boolean {
  const savedSet = new Set(saved);
  if (working.size !== savedSet.size) return false;
  for (const grant of working) if (!savedSet.has(grant)) return false;
  return true;
}

/** Inline message for the API's field-level rejections. */
function invalidMessage(error: string, invalidPermissions?: string[]): string {
  const detail = invalidPermissions?.length
    ? ` Unknown permission${invalidPermissions.length === 1 ? "" : "s"}: ${invalidPermissions.join(", ")}`
    : "";
  return `${error}${detail}`;
}

export function RolesView({
  initialRoles,
  initialRoleKey,
}: {
  initialRoles: RoleResponse[];
  initialRoleKey?: string;
}) {
  const { user, can } = usePermission();
  // The API is the enforcement point; this only keeps the UI from offering
  // actions it would refuse (a roles.view-only session can read, not write).
  const canManage = can("roles.manage");

  const [roles, setRoles] = useState(initialRoles);
  // `?role=<key>` opens that role's drawer on load; an unknown key is ignored.
  const [editingKey, setEditingKey] = useState<string | null>(() =>
    initialRoleKey && initialRoles.some((role) => role.key === initialRoleKey)
      ? initialRoleKey
      : null
  );
  const [draft, setDraft] = useState<CreateDraft | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const editingRole = useMemo(
    () => roles.find((role) => role.key === editingKey) ?? null,
    [roles, editingKey]
  );
  const deletingRole = useMemo(
    () => roles.find((role) => role.key === deletingKey) ?? null,
    [roles, deletingKey]
  );

  const refreshRoles = useCallback(async () => {
    try {
      const response = await apiFetch("/api/roles");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.roles)) setRoles(data.roles);
    } catch {
      /* transient — the table keeps its last good rows */
    }
  }, []);

  function openCreate(source?: RoleResponse) {
    setDraft({
      id: nextDraftId++,
      name: source ? `${source.name} (copy)` : "",
      description: source?.description ?? "",
      // Duplicate copies the resolved set: cloning a wildcard role as `*` would
      // hand the copy every key the catalog ever adds.
      permissions: source ? [...source.resolvedPermissions] : [],
    });
  }

  return (
    <section aria-label="Role administration" className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">Roles</h1>

      <section className="task-sheet roles-sheet min-w-0" aria-labelledby="roles-table-title">
        <div className="task-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <KeyRound className="size-4" aria-hidden="true" />
            <h2 id="roles-table-title">Roles &amp; permissions</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="task-sheet-count tabular-nums">{roles.length} roles</span>
            <Button size="sm" variant="ghost" icon={<RefreshCw />} aria-label="Refresh roles" onClick={() => void refreshRoles()}>
              Refresh
            </Button>
            <Button size="sm" icon={<Plus />} disabled={!canManage} onClick={() => openCreate()}>
              New role
            </Button>
          </div>
        </div>

        <div
          className="task-sheet-scroll"
          role="region"
          aria-label="Roles table, scroll horizontally for more columns"
          tabIndex={0}
        >
          <Table aria-label="Roles" className="min-w-[900px]">
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Key</TableHead>
                <TableHead scope="col">Name</TableHead>
                <TableHead scope="col">Description</TableHead>
                <TableHead scope="col">Users</TableHead>
                <TableHead scope="col">Type</TableHead>
                <TableHead scope="col">Permissions</TableHead>
                <TableHead scope="col">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <TableRow key={role.key}>
                  <TableCell className="font-mono text-xs">{role.key}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      className="text-start font-medium hover:underline"
                      onClick={() => setEditingKey(role.key)}
                    >
                      {role.name}
                    </button>
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <span className="block truncate text-muted-foreground" title={role.description}>
                      {role.description || "—"}
                    </span>
                  </TableCell>
                  <TableCell className="tabular-nums">{role.userCount ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={role.isSystem ? "secondary" : "outline"}>
                      {role.isSystem ? "System" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {role.permissions.includes("*") ? (
                      <span>All permissions (wildcard)</span>
                    ) : (
                      <span className="tabular-nums">{role.resolvedPermissions.length}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" icon={<Sliders />} onClick={() => setEditingKey(role.key)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Copy />}
                        disabled={!canManage}
                        onClick={() => openCreate(role)}
                      >
                        Duplicate
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Trash2 />}
                        disabled={!canManage}
                        onClick={() => setDeletingKey(role.key)}
                      >
                        Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!roles.length && (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <p>No roles yet</p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="task-sheet-footer flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Click a role to edit its details and permissions. Every change is recorded in the role audit log.
          </p>
        </div>
      </section>

      {editingRole && (
        <RoleEditSheet
          key={editingRole.key}
          role={editingRole}
          isOwnRole={user?.role === editingRole.key}
          readOnly={!canManage}
          onClose={() => setEditingKey(null)}
          onMutated={refreshRoles}
        />
      )}

      {draft && (
        <RoleCreateSheet
          key={draft.id}
          draft={draft}
          onClose={() => setDraft(null)}
          onCreated={refreshRoles}
        />
      )}

      {deletingRole && (
        <DeleteRoleDialog
          role={deletingRole}
          onClose={() => setDeletingKey(null)}
          onMutated={refreshRoles}
        />
      )}
    </section>
  );
}

/** One resource's toggles, the shared toggle engine, and the cross-link drawer
 *  header all live in ./permission-toggles — the module is /roles and
 *  /permissions' single definition of raw-grant editing. */

function RoleEditSheet({
  role,
  isOwnRole,
  readOnly,
  onClose,
  onMutated,
}: {
  role: RoleResponse;
  /** The session's own role: the API refuses grant replaces there (403), so the
   *  permissions area is rendered read-only instead of offering a doomed save. */
  isOwnRole: boolean;
  readOnly: boolean;
  onClose: () => void;
  onMutated: () => Promise<void> | void;
}) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description);
  const [grants, setGrants] = useState<Set<string>>(() => new Set(role.permissions));
  const [savingDetails, setSavingDetails] = useState(false);
  const [savingGrants, setSavingGrants] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const detailsDirty = name !== role.name || description !== role.description;
  const grantsDirty = !sameGrants(grants, role.permissions);
  const wildcardActive = grants.has("*");

  async function saveDetails() {
    setSavingDetails(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/roles/${encodeURIComponent(role.key)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const data = await readBody(response);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("This role was deleted elsewhere");
          onClose();
          await onMutated();
          return;
        }
        setError(data.error ?? "Could not save the role details");
        return;
      }
      // Resync from the response, not from what was typed: the API trims (and
      // could otherwise normalize) the fields, so keeping the local value would
      // leave detailsDirty true — a still-enabled Save that fires a no-op PATCH
      // and a second, identical role.updated audit row. This also keeps the
      // drawer consistent when the follow-up list refetch fails transiently.
      setName(data.role?.name ?? name);
      setDescription(data.role?.description ?? description);
      toast.success(`Updated ${data.role?.name ?? name}`);
      await onMutated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveGrants() {
    setSavingGrants(true);
    setError(null);
    try {
      const response = await apiFetch(
        `/api/roles/${encodeURIComponent(role.key)}/permissions`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: [...grants] }),
        }
      );
      const data = await readBody(response);
      if (!response.ok) {
        if (response.status === 404) {
          toast.error("This role was deleted elsewhere");
          onClose();
          await onMutated();
          return;
        }
        // 400 invalid grants, 403 own-role, 409 lockout: the API's own copy.
        setError(invalidMessage(data.error ?? "Could not save permissions", data.invalidPermissions));
        return;
      }
      setGrants(new Set(data.role?.permissions ?? [...grants]));
      toast.success(`Permissions updated for ${data.role?.name ?? role.name}`);
      await onMutated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSavingGrants(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex flex-wrap items-center gap-2">
            {role.name}
            {role.isSystem && <Badge variant="secondary">System</Badge>}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono text-xs">{role.key}</span>
            <span aria-hidden="true">·</span>
            <span>
              {role.userCount ?? 0} user{role.userCount === 1 ? "" : "s"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" aria-hidden="true" />
              created {new Date(role.createdAt).toLocaleDateString()}
            </span>
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-6 p-4">
          <section className="grid gap-3" aria-label="Role details">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Details
            </h3>
            <div className="grid gap-1.5">
              <label htmlFor="role-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="role-name"
                name="name"
                value={name}
                disabled={readOnly}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="role-description" className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id="role-description"
                name="description"
                value={description}
                disabled={readOnly}
                rows={2}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The key <span className="font-mono">{role.key}</span> is immutable; renaming keeps it.
            </p>
            <div>
              <Button
                size="sm"
                variant="secondary"
                loading={savingDetails}
                disabled={readOnly || !detailsDirty || !name.trim()}
                onClick={() => void saveDetails()}
              >
                Save details
              </Button>
            </div>
          </section>

          <section className="grid gap-3" aria-label="Role permissions">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Permissions
              </h3>
              {/* Cross-link: the matrix view edits the same raw grant set with
                  every resource on screen at once. */}
              <Link
                href={`/permissions?role=${role.key}`}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Edit in permissions
              </Link>
            </div>

            {isOwnRole ? (
              <div className="grid gap-3">
                <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    This is your own role, so its permissions are read-only here — editing them could
                    grant or revoke your own access.
                  </span>
                </p>
                <PermissionToggles
                  grants={new Set(role.permissions)}
                  disabled
                  onToggleGroup={() => undefined}
                  onToggleVerb={() => undefined}
                />
              </div>
            ) : readOnly ? (
              <div className="grid gap-3">
                <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    You can view these permissions but not change them — the{" "}
                    {PERMISSION_LABELS["roles.manage"] ?? "roles.manage"} permission is required.
                  </span>
                </p>
                <PermissionToggles
                  grants={new Set(role.permissions)}
                  disabled
                  onToggleGroup={() => undefined}
                  onToggleVerb={() => undefined}
                />
              </div>
            ) : wildcardActive ? (
              <div className="grid gap-3">
                <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span>
                    All permissions (wildcard). This role&apos;s grants are the <span className="font-mono">*</span>{" "}
                    wildcard, so it holds every catalog key — including keys added later. Customize to
                    pin the concrete set instead.
                  </span>
                </p>
                <div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setGrants(new Set(role.resolvedPermissions))}
                  >
                    Customize
                  </Button>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <PermissionToggles
                  grants={grants}
                  onToggleGroup={(group, checked) =>
                    setGrants((previous) => toggleGroupInSet(previous, group, checked))
                  }
                  onToggleVerb={(group, verb, checked) =>
                    setGrants((previous) => toggleVerbInSet(previous, group, verb, checked))
                  }
                />
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    loading={savingGrants}
                    disabled={!grantsDirty}
                    onClick={() => void saveGrants()}
                  >
                    Save permissions
                  </Button>
                  {grantsDirty && (
                    <span className="text-xs text-muted-foreground">
                      Unsaved changes — saving replaces the whole grant set.
                    </span>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RoleCreateSheet({
  draft,
  onClose,
  onCreated,
}: {
  draft: CreateDraft;
  onClose: () => void;
  onCreated: () => Promise<void> | void;
}) {
  const [name, setName] = useState(draft.name);
  const [description, setDescription] = useState(draft.description);
  const [grants, setGrants] = useState<Set<string>>(() => new Set(draft.permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await apiFetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, permissions: [...grants] }),
      });
      const data = await readBody(response);
      if (!response.ok) {
        if (response.status === 409) {
          // Key derivation exhausted its candidates — a toast, not a field error.
          toast.error(data.error ?? "Could not derive a unique key for this name");
          return;
        }
        setError(invalidMessage(data.error ?? "Could not create the role", data.invalidPermissions));
        return;
      }
      toast.success(`Created ${data.role?.name ?? name}`);
      onClose();
      await onCreated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle>Create a role</SheetTitle>
          <SheetDescription>
            The key is derived from the name and stays immutable; grants start from the toggles below.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="grid gap-6 p-4">
          <section className="grid gap-3" aria-label="New role details">
            <div className="grid gap-1.5">
              <label htmlFor="new-role-name" className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                id="new-role-name"
                name="name"
                value={name}
                placeholder="Support Tier 2"
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="new-role-description" className="text-xs font-medium text-muted-foreground">
                Description
              </label>
              <Textarea
                id="new-role-description"
                name="description"
                value={description}
                rows={2}
                placeholder="What this role is for"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </section>

          <section className="grid gap-3" aria-label="New role permissions">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Permissions
            </h3>
            <PermissionToggles
              grants={grants}
              onToggleGroup={(group, checked) =>
                setGrants((previous) => toggleGroupInSet(previous, group, checked))
              }
              onToggleVerb={(group, verb, checked) =>
                setGrants((previous) => toggleVerbInSet(previous, group, verb, checked))
              }
            />
            {error && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </section>

          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button type="button" size="lg" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={saving} disabled={!name.trim()}>
              Create role
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function DeleteRoleDialog({
  role,
  onClose,
  onMutated,
}: {
  role: RoleResponse;
  onClose: () => void;
  onMutated: () => Promise<void> | void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const userCount = role.userCount ?? 0;
  // Both blocks are decided without a request: the API would only refuse with
  // the same reason (409), and `error` below still covers a stale count.
  const blocked = role.isSystem || userCount > 0;

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const response = await apiFetch(`/api/roles/${encodeURIComponent(role.key)}`, {
        method: "DELETE",
      });
      const data = await readBody(response);
      if (!response.ok) {
        if (response.status === 409) {
          // In-use after all (users were assigned since the list loaded).
          setError(data.error ?? "Role is still assigned — reassign its users first");
          await onMutated();
          return;
        }
        if (response.status === 404) {
          toast.error("This role was already deleted");
        } else {
          toast.error(data.error ?? "Failed to delete the role");
        }
        onClose();
        await onMutated();
        return;
      }
      toast.success(`Deleted ${role.name}`);
      onClose();
      await onMutated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {role.name}?</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs">{role.key}</span> · {userCount} user
            {userCount === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        {role.isSystem ? (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              System roles cannot be deleted. They back the workspace&apos;s baseline access levels and
              are managed by the application.
            </span>
          </p>
        ) : userCount > 0 ? (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              This role is still assigned to {userCount} user{userCount === 1 ? "" : "s"}. Reassign
              them to another role on the Users page first — deleting an assigned role would leave
              those accounts without a role.
            </span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            This permanently deletes the role and its {role.resolvedPermissions.length} granted
            permission{role.resolvedPermissions.length === 1 ? "" : "s"}. The audit log keeps the
            record.
          </p>
        )}

        {error && (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button size="lg" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="lg"
            variant="destructive"
            loading={deleting}
            disabled={blocked}
            onClick={() => void handleDelete()}
          >
            Delete role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
