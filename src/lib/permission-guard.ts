/**
 * The API-layer permission gate — the only place that can say yes.
 *
 * Server-side only by contract (it reads cookies via getSessionUser); the pure
 * catalog helpers it builds on live in `./permissions`, which client code may
 * also import. Usage at the top of every data API handler:
 *
 *   const guard = await requirePermission("users.view");
 *   if (!guard.ok) return guard.response;
 *   const user = guard.user;   // actor for audit writes
 */
import { getSessionUser, type SessionUser } from "./auth";
import { hasPermission } from "./permissions";

export type GuardResult =
  | { ok: true; user: SessionUser }
  | { ok: false; response: Response };

export async function requirePermission(required: string): Promise<GuardResult> {
  const user = await getSessionUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (!hasPermission(user.permissions, required)) {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden", requiredPermission: required }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
