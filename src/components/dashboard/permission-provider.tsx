"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";

/** What `usePermission()` exposes to gated surfaces (sidebar, palette, gates). */
interface PermissionContextValue {
  user: SessionUser | null;
  permissions: ReadonlySet<string>;
  can(permission: string): boolean;
  status: "loading" | "ready";
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/** Stable empty set: a denied/absent session keeps one Set identity forever. */
const EMPTY_PERMISSIONS: ReadonlySet<string> = new Set<string>();

/**
 * Client half of RBAC (design §6): fetches `GET /api/auth/me` once on mount
 * and again whenever the window regains focus (what makes revokes feel
 * near-instant — same session, no re-login), and exposes the resolved
 * permission set to every gated surface.
 *
 * `can` is plain Set membership over the already-expanded payload — the
 * resolver ran server-side (epic 1), so the client interprets no wildcards.
 * The API remains the enforcement point; this provider only drives UX.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const latestLoadRef = useRef(0);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(EMPTY_PERMISSIONS);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  const load = useCallback(() => {
    // Monotonic token: only the most recently started fetch may commit state.
    // A slow earlier fetch (e.g. one riding apiFetch's 401→refresh→retry) that
    // resolves after a newer focus re-fetch must not overwrite the newer,
    // possibly narrower permissions — a revoked grant would otherwise flash
    // back in until the next focus.
    const id = ++latestLoadRef.current;
    const isStale = () => id !== latestLoadRef.current;
    apiFetch("/api/auth/me")
      .then(response => (response.ok
        ? (response.json() as Promise<{ user?: SessionUser | null } | null>)
        // 401 — middleware normally redirects first; deny-all is the safe rest state.
        : Promise.resolve(null)))
      .then(payload => {
        if (isStale()) return;
        const me = payload?.user ?? null;
        const granted = me?.permissions;
        setUser(me);
        setPermissions(new Set(Array.isArray(granted) ? granted : []));
      })
      .catch(() => {
        // Transient failure: a focus re-fetch keeps the prior state; the initial
        // mount keeps its deny-all default. Never flash a wider set on error.
      })
      .finally(() => {
        // A stale finally must not flip status either (it could mark "ready"
        // around whatever the newer fetch is about to commit).
        if (!isStale()) setStatus("ready");
      });
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refetch = () => {
      void load();
    };
    window.addEventListener("focus", refetch);
    return () => window.removeEventListener("focus", refetch);
  }, [load]);

  const can = useCallback((permission: string) => permissions.has(permission), [permissions]);

  const value = useMemo<PermissionContextValue>(
    () => ({ user, permissions, can, status }),
    [user, permissions, can, status]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}

/** Read the session's resolved permissions. Throws outside a PermissionProvider. */
export function usePermission(): PermissionContextValue {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return context;
}
