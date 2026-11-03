"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Info, Lock, RefreshCw, SlidersHorizontal, X } from "@/components/icons";
import { usePermission } from "@/components/dashboard/permission-provider";
import {
  PermissionToggles,
  toggleGroupInSet,
  toggleVerbInSet,
} from "@/components/dashboard/permission-toggles";
import { invalidMessage, readBody, sameGrants } from "@/components/dashboard/roles-shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button-clean";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { isValidGrant, PERMISSION_LABELS, type Verb } from "@/lib/permissions";
import type { RoleResponse } from "@/lib/roles";

/**
 * The /permissions client island: /roles' matrix counterpart, organized per
 * role. The RSC page hands it the first paint (`initialRoles` + the `?role=`
 * preselect); picking a role in the selector reveals the editor — one row per
 * catalog resource, short verb-labeled checkboxes reflecting the role's
 * RESOLVED grants, edited through the same raw-grant working set /roles'
 * drawer uses (the shared toggle engine), with dead stored grants surfaced as
 * removable chips. Every successful save refetches `GET /api/roles`, so what
 * is on screen is always what the audited API says.
 */

/** Short checkbox labels: the row already names the resource, so the verb
 *  alone disambiguates. /roles' drawer keeps the catalog's full labels. */
const SHORT_VERB_LABELS: Record<Verb, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  use: "Use",
  manage: "Manage",
};

function shortVerbLabel(verb: Verb): string {
  return SHORT_VERB_LABELS[verb];
}

/** The /roles drawer's view-only note, mirrored: a roles.view-only session
 *  gets read-only toggles because every write (save, chip cleanup) needs
 *  roles.manage — the API would 403 anyway. */
function ManageRequiredNote() {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>
        You can view these permissions but not change them — the{" "}
        {PERMISSION_LABELS["roles.manage"] ?? "roles.manage"} permission is required.
      </span>
    </p>
  );
}

/** Dead stored grants as chips, in every branch (editable and read-only
 *  alike). `onRemove` omitted (own-role, wildcard, or view-only session —
 *  every save would 403) renders the remove buttons disabled; the chips stay
 *  informative either way. */
function DeadGrantChips({
  deadGrants,
  onRemove,
}: {
  deadGrants: readonly string[];
  onRemove?: (grant: string) => void;
}) {
  if (deadGrants.length === 0) return null;
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="flex items-start gap-2 text-xs">
        <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Dead grants — no longer in the catalog, so they grant nothing. Remove them
          before saving: while one is left in the set, the API rejects the whole save.
        </span>
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {deadGrants.map((grant) => (
          <li key={grant}>
            <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 py-0.5 pl-2 pr-1 text-xs">
              <span className="font-mono">{grant}</span>
              <button
                type="button"
                aria-label={`Remove dead grant ${grant}`}
                disabled={!onRemove}
                className="rounded p-0.5 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                onClick={() => onRemove?.(grant)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PermissionsView({
  initialRoles,
  initialRoleKey,
}: {
  initialRoles: RoleResponse[];
  initialRoleKey?: string;
}) {
  const { user, can } = usePermission();
  // The API is the enforcement point; this only keeps the UI from offering
  // saves it would refuse (a roles.view-only session can read, not write).
  const canManage = can("roles.manage");
  const [roles, setRoles] = useState(initialRoles);
  // `?role=<key>` preselects on load; an unknown key is ignored (placeholder).
  const [selectedKey, setSelectedKey] = useState<string | null>(() =>
    initialRoleKey && initialRoles.some((role) => role.key === initialRoleKey)
      ? initialRoleKey
      : null
  );

  const selectedRole = useMemo(
    () => roles.find((role) => role.key === selectedKey) ?? null,
    [roles, selectedKey]
  );

  const refreshRoles = useCallback(async () => {
    try {
      const response = await apiFetch("/api/roles");
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data?.roles)) setRoles(data.roles);
    } catch {
      /* transient — the selector keeps its last good rows */
    }
  }, []);

  /** A 404 on save means the role vanished elsewhere: deselect and refetch. */
  async function handleRoleDeleted() {
    setSelectedKey(null);
    await refreshRoles();
  }

  return (
    <section aria-label="Permission administration" className="flex min-w-0 flex-col gap-4">
      <h1 className="sr-only">Permissions</h1>

      <section className="task-sheet min-w-0" aria-labelledby="permissions-title">
        <div className="task-sheet-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            <h2 id="permissions-title">Permissions</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="task-sheet-count tabular-nums">{roles.length} roles</span>
            <Button size="sm" variant="ghost" icon={<RefreshCw />} aria-label="Refresh roles" onClick={() => void refreshRoles()}>
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-1.5 border-b border-border p-4">
          <span id="permissions-role-label" className="text-xs font-medium text-muted-foreground">
            Role
          </span>
          <Select value={selectedKey} onValueChange={(value) => setSelectedKey(value ?? null)}>
            <SelectTrigger aria-labelledby="permissions-role-label" className="w-full max-w-72">
              <SelectValue>
                {selectedRole ? roleOptionLabel(selectedRole) : "Select a role"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {roles.map((role) => (
                <SelectItem key={role.key} value={role.key}>
                  {role.name}
                  <span className="text-muted-foreground">
                    {" "}
                    · {role.userCount ?? 0} user{(role.userCount ?? 0) === 1 ? "" : "s"}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedRole ? (
          <RolePermissionsEditor
            key={selectedRole.key}
            role={selectedRole}
            isOwnRole={user?.role === selectedRole.key}
            canManage={canManage}
            onDeleted={handleRoleDeleted}
            onMutated={refreshRoles}
          />
        ) : (
          <div className="p-6">
            <p className="text-sm text-muted-foreground">
              Pick a role to see every resource&apos;s verbs as checkboxes and edit them.
            </p>
          </div>
        )}

        <div className="task-sheet-footer flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Saving replaces the role&apos;s whole grant set. Every change is recorded in the role
            audit log.
          </p>
        </div>
      </section>
    </section>
  );
}

/** The selector's compact "name · count" hint. */
function roleOptionLabel(role: RoleResponse): string {
  const count = role.userCount ?? 0;
  return `${role.name} · ${count} user${count === 1 ? "" : "s"}`;
}

/**
 * One selected role's editor: the raw-grant working set (wildcards kept as
 * stored, dead grants chipped), displayed through the resolver. Read-only for
 * the session's own role (the API 403s own-role writes), for `*`-wildcard
 * roles (customizing a wildcard is /roles' drawer move, so this page links
 * there instead of offering a doomed save), and for sessions without
 * roles.manage (every save would 403 — the /roles drawer's view-only note).
 * The own-role and wildcard notes display first; the manage note renders
 * alongside them when it also applies.
 */
function RolePermissionsEditor({
  role,
  isOwnRole,
  canManage,
  onDeleted,
  onMutated,
}: {
  role: RoleResponse;
  /** The session's own role: rendered read-only with the own-role note first —
   *  a role can be both own and wildcard, and the own-role reason wins. */
  isOwnRole: boolean;
  /** The session holds roles.manage. Without it the editor is view-only: the
   *  PATCH (and the chip cleanup a clean save implies) would only ever 403. */
  canManage: boolean;
  onDeleted: () => Promise<void> | void;
  onMutated: () => Promise<void> | void;
}) {
  const [grants, setGrants] = useState<Set<string>>(() => new Set(role.permissions));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = !sameGrants(grants, role.permissions);
  const wildcardActive = role.permissions.includes("*");
  // Dead grants live only in the raw set — the resolver drops them silently,
  // so they have no row to sit in; they surface as removable chips instead.
  const deadGrants = useMemo(
    () => [...grants].filter((grant) => !isValidGrant(grant)),
    [grants]
  );

  async function save() {
    setSaving(true);
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
          await onDeleted();
          return;
        }
        // 400 invalid grants (dead chips still present), 409 lockout: the
        // API's own copy; the editor stays dirty so nothing is lost.
        setError(invalidMessage(data.error ?? "Could not save permissions", data.invalidPermissions));
        return;
      }
      // Resync from the response, not from what was typed: keeping local state
      // would leave `dirty` true — a still-enabled Save firing a no-op PATCH
      // and a second, identical audit row (the 2.2 patch's lesson).
      setGrants(new Set(data.role?.permissions ?? [...grants]));
      toast.success(`Permissions updated for ${data.role?.name ?? role.name}`);
      await onMutated();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 border-b border-border p-4">
      {/* Selected-role header; the counterpart of /roles' "Edit in permissions"
          link, so the two pages round-trip on ?role=<key>. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-medium">{role.name}</span>
        {role.isSystem && <Badge variant="secondary">System</Badge>}
        {!role.isSystem && <Badge variant="outline">Custom</Badge>}
        <span className="font-mono text-xs text-muted-foreground">{role.key}</span>
        <span aria-hidden="true">·</span>
        <span className="text-xs text-muted-foreground">
          {role.userCount ?? 0} user{(role.userCount ?? 0) === 1 ? "" : "s"}
        </span>
        <Link
          href={`/roles?role=${role.key}`}
          className="ms-auto text-xs text-muted-foreground underline-offset-2 hover:underline"
        >
          Open in roles
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
          {!canManage && <ManageRequiredNote />}
          <PermissionToggles
            grants={new Set(role.permissions)}
            verbLabel={shortVerbLabel}
            disabled
            onToggleGroup={() => undefined}
            onToggleVerb={() => undefined}
          />
          <DeadGrantChips deadGrants={deadGrants} />
        </div>
      ) : wildcardActive ? (
        <div className="grid gap-3">
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              <span className="font-medium">{role.name}</span> grants every permission via the{" "}
              <span className="font-mono">*</span> wildcard — including keys added later.{" "}
              <Link
                href={`/roles?role=${role.key}`}
                className="underline underline-offset-2"
              >
                Customize
              </Link>{" "}
              pins the concrete set in the roles drawer instead.
            </span>
          </p>
          {!canManage && <ManageRequiredNote />}
          <PermissionToggles
            grants={new Set(role.permissions)}
            verbLabel={shortVerbLabel}
            disabled
            onToggleGroup={() => undefined}
            onToggleVerb={() => undefined}
          />
          <DeadGrantChips deadGrants={deadGrants} />
        </div>
      ) : !canManage ? (
        <div className="grid gap-3">
          <ManageRequiredNote />
          <PermissionToggles
            grants={new Set(role.permissions)}
            verbLabel={shortVerbLabel}
            disabled
            onToggleGroup={() => undefined}
            onToggleVerb={() => undefined}
          />
          <DeadGrantChips deadGrants={deadGrants} />
        </div>
      ) : (
        <div className="grid gap-3">
          <PermissionToggles
            grants={grants}
            verbLabel={shortVerbLabel}
            onToggleGroup={(group, checked) =>
              setGrants((previous) => toggleGroupInSet(previous, group, checked))
            }
            onToggleVerb={(group, verb, checked) =>
              setGrants((previous) => toggleVerbInSet(previous, group, verb, checked))
            }
          />

          <DeadGrantChips
            deadGrants={deadGrants}
            onRemove={(grant) =>
              setGrants((previous) => {
                const next = new Set(previous);
                next.delete(grant);
                return next;
              })
            }
          />

          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" loading={saving} disabled={!dirty} onClick={() => void save()}>
              Save permissions
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={!dirty || saving}
              onClick={() => setGrants(new Set(role.permissions))}
            >
              Reset
            </Button>
            {dirty && (
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
    </div>
  );
}
