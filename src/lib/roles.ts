/**
 * The roles resource's shared mapping + audit layer — what every /api/roles
 * route builds on. `./permissions` owns the catalog (what a grant means); this
 * file owns the roles table's shape at the API boundary (what a role row
 * becomes in a response) and the one audit write every mutation makes.
 */
import { query } from "./db";
import { resolvePermissions } from "./permissions";

/** A roles row as the API selects it. pg delivers the JSONB permissions column
 *  already parsed into a JS value (array — or anything, if the JSONB is
 *  malformed), so it is typed unknown and filtered defensively by
 *  toStringArray. Aggregate queries extend this with a user_count column. */
export interface RoleRow {
  key: string;
  name: string;
  description: string;
  permissions: unknown;
  is_system: boolean;
  created_at: Date;
}

/** The role shape every roles endpoint returns. `userCount` is optional because
 *  two response shapes share this interface: list/create include it, while the
 *  [key] mutation responses — which never change it — omit the key entirely. */
export interface RoleResponse {
  key: string;
  name: string;
  description: string;
  /** Raw stored grants — may contain wildcards; this is the editable state. */
  permissions: string[];
  /** Wildcards expanded against the catalog — what the role actually allows. */
  resolvedPermissions: string[];
  isSystem: boolean;
  /** Present on list/create only; see toRoleResponse for why it is conditional. */
  userCount?: number;
  createdAt: string;
}

/** JSONB is typed unknown; anything that is not a string[] degrades to []. */
export function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

/** Row → API shape. Pass `userCount` for list/create; omit it for the [key]
 *  mutation responses. The conditional spread keeps the key absent from the
 *  JSON when omitted (JSON.stringify would also drop `undefined`, but the
 *  spread makes the two shapes explicit instead of accidental) and preserves
 *  key order, so both response bodies are byte-for-byte what the routes
 *  emitted before this mapper was shared. */
export function toRoleResponse(row: RoleRow, userCount?: number): RoleResponse {
  const permissions = toStringArray(row.permissions);
  return {
    key: row.key,
    name: row.name,
    description: row.description,
    permissions,
    resolvedPermissions: resolvePermissions(permissions),
    isSystem: row.is_system,
    ...(userCount !== undefined ? { userCount } : {}),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Every action the roles API writes to role_audit. */
export type RoleAuditAction =
  | "role.created"
  | "role.updated"
  | "role.deleted"
  | "role.permissions.replaced";

/** The one audit write every successful roles mutation makes. */
export interface RoleAuditEntry {
  actorId: string;
  action: RoleAuditAction;
  roleKey: string;
  /** Stored as the row's JSONB diff — stringified here, not at the call site. */
  diff: unknown;
}

/** Audit after the mutation, sequential (not fire-and-forget) but non-fatal:
 *  insurance, not a transactional participant (design §5). A failed write is
 *  logged and swallowed — the mutation has already committed, so the caller
 *  still returns success. role_key is a raw string, not an FK: the audit row
 *  must outlive the role it describes (notably on delete). */
export async function writeRoleAudit(entry: RoleAuditEntry): Promise<void> {
  try {
    await query(
      `INSERT INTO role_audit (actor_id, action, role_key, diff)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [entry.actorId, entry.action, entry.roleKey, JSON.stringify(entry.diff)]
    );
  } catch (error) {
    console.error("role audit write failed:", error);
  }
}
