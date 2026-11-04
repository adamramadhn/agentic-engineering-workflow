"use client";

import type { RoleResponse } from "@/lib/roles";

/**
 * /roles and /permissions' shared grant-editing helpers (2.4's cleanup): the
 * two views edit the same raw-grant working set against the same roles API,
 * so the response-body reader, the dirty check, and the field-level rejection
 * message live here once instead of as local twins in each view.
 */

/** Parse an API body without throwing on empty or non-JSON responses. Success
 *  bodies carry `role`; error bodies carry `error` and, on the field-level
 *  rejections, `invalidPermissions` / `userCount`. */
export async function readBody(response: Response): Promise<{
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

/** Set equality between a working grant set and a role's saved grants. */
export function sameGrants(working: ReadonlySet<string>, saved: readonly string[]): boolean {
  const savedSet = new Set(saved);
  if (working.size !== savedSet.size) return false;
  for (const grant of working) if (!savedSet.has(grant)) return false;
  return true;
}

/** Inline message for the API's field-level rejections. With invalid grants
 *  present, the constructed detail IS the message: the API's own `error` for
 *  that case is the bare "Unknown permission", and prefixing it would state
 *  the same thing twice. */
export function invalidMessage(error: string, invalidPermissions?: string[]): string {
  if (invalidPermissions?.length) {
    return `Unknown permission${invalidPermissions.length === 1 ? "" : "s"}: ${invalidPermissions.join(", ")}`;
  }
  return error;
}
