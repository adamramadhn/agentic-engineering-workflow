"use client";

import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  resolvePermissions,
  type ResourceGroup,
  type Verb,
} from "@/lib/permissions";

/**
 * The raw-grant toggle engine, shared by /roles' edit drawer and /permissions'
 * per-role matrix (moved verbatim from roles-view.tsx).
 *
 * The working set is always the RAW stored grant list — wildcards included —
 * while the checkboxes display `resolvePermissions([...grants])`, exactly what
 * the API would resolve; the two toggle functions below are the only
 * sanctioned way to mutate that set, so `resource.*` narrowing is defined
 * exactly once for both pages.
 */

/** One resource's toggles: a group checkbox plus its verbs, in catalog order. */
export function PermissionGroupToggles({
  group,
  resolved,
  disabled,
  verbLabel,
  onToggleGroup,
  onToggleVerb,
}: {
  group: ResourceGroup;
  resolved: ReadonlySet<string>;
  disabled?: boolean;
  /** Per-verb display text — /permissions passes short labels ("View"), while
   *  the default keeps the catalog's full "View users"-style wording so /roles
   *  renders identically. The accessible name always stays the full catalog
   *  label: a bare "View" must never be the only context a screen reader gets. */
  verbLabel?: (verb: Verb) => string;
  onToggleGroup: (group: ResourceGroup, checked: boolean) => void;
  onToggleVerb: (group: ResourceGroup, verb: Verb, checked: boolean) => void;
}) {
  const keys = group.verbs.map((verb) => `${group.resource}.${verb}`);
  const granted = keys.filter((key) => resolved.has(key)).length;
  const allOn = granted === keys.length;
  const someOn = granted > 0 && !allOn;
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center gap-2">
        <Checkbox
          checked={allOn}
          indeterminate={someOn}
          disabled={disabled}
          aria-label={`Toggle all ${group.label} permissions`}
          onCheckedChange={(checked) => onToggleGroup(group, Boolean(checked))}
        />
        <span className="text-xs font-medium">{group.label}</span>
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">
          {granted}/{keys.length}
        </span>
      </div>
      <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
        {group.verbs.map((verb) => {
          const key = `${group.resource}.${verb}`;
          const checked = resolved.has(key);
          return (
            <label key={key} className="flex items-center gap-2 text-xs">
              <Checkbox
                checked={checked}
                disabled={disabled}
                aria-label={PERMISSION_LABELS[key] ?? key}
                onCheckedChange={(next) => onToggleVerb(group, verb, Boolean(next))}
              />
              {verbLabel ? verbLabel(verb) : (PERMISSION_LABELS[key] ?? key)}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/** The full catalog as toggles. `grants` is the working set, already expanded. */
export function PermissionToggles({
  grants,
  disabled,
  verbLabel,
  onToggleGroup,
  onToggleVerb,
}: {
  grants: ReadonlySet<string>;
  disabled?: boolean;
  /** See PermissionGroupToggles — short labels for the matrix page. */
  verbLabel?: (verb: Verb) => string;
  onToggleGroup: (group: ResourceGroup, checked: boolean) => void;
  onToggleVerb: (group: ResourceGroup, verb: Verb, checked: boolean) => void;
}) {
  // resolvePermissions is pure and client-safe; running it here keeps the
  // checkbox display exactly what the API would resolve from the raw grants.
  const resolved = useMemo(() => new Set(resolvePermissions([...grants])), [grants]);
  return (
    <div className="grid gap-2.5">
      {PERMISSION_GROUPS.map((group) => (
        <PermissionGroupToggles
          key={group.resource}
          group={group}
          resolved={resolved}
          disabled={disabled}
          verbLabel={verbLabel}
          onToggleGroup={onToggleGroup}
          onToggleVerb={onToggleVerb}
        />
      ))}
    </div>
  );
}

/**
 * Mutate the working grant set one verb at a time, raw-grant-faithful:
 * turning a verb on under a stored `resource.*` is a no-op (already implied),
 * turning one off narrows the wildcard to the group's other concrete keys —
 * "everything except this" has no other storage shape.
 */
export function toggleVerbInSet(
  previous: ReadonlySet<string>,
  group: ResourceGroup,
  verb: Verb,
  checked: boolean
): Set<string> {
  const next = new Set(previous);
  const wildcard = `${group.resource}.*`;
  const key = `${group.resource}.${verb}`;
  if (checked) {
    if (!next.has(wildcard)) next.add(key);
    return next;
  }
  if (next.has(wildcard)) {
    next.delete(wildcard);
    for (const candidate of group.verbs) {
      if (candidate !== verb) next.add(`${group.resource}.${candidate}`);
    }
    return next;
  }
  next.delete(key);
  return next;
}

export function toggleGroupInSet(
  previous: ReadonlySet<string>,
  group: ResourceGroup,
  checked: boolean
): Set<string> {
  const next = new Set(previous);
  const wildcard = `${group.resource}.*`;
  if (checked) {
    // A stored wildcard already grants the whole group; keep it stored as-is.
    if (!next.has(wildcard)) {
      for (const verb of group.verbs) next.add(`${group.resource}.${verb}`);
    }
    return next;
  }
  next.delete(wildcard);
  for (const verb of group.verbs) next.delete(`${group.resource}.${verb}`);
  return next;
}
