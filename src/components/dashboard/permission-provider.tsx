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
  /** `"error"` means unknown, not denied: the first load failed at transport
   *  level with nothing committed. Nav surfaces still filter against the
   *  (empty) set; only the gate's copy changes (Retry, not the 403). */
  status: "loading" | "ready" | "error";
  /** Manual re-fetch (the gate's Retry): back to `"loading"`, then the load's
   *  own guards decide the next status. */
  reload(): void;
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
 *
 * Status: `"loading"` until the first load settles; `"error"` only when that
 * first load fails at transport level with nothing committed (unknown ≠
 * denied — a focus re-fetch failure after a commit keeps the prior state and
 * stays `"ready"`); `reload()` re-runs the fetch from the gate's Retry.
 */
export function PermissionProvider({ children }: { children: ReactNode }) {
  const latestLoadRef = useRef(0);
  // Whether any payload has committed yet (a 401's deny-all counts): the
  // "error" status is exclusive to a transport failure with nothing committed.
  const committedRef = useRef(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [permissions, setPermissions] = useState<ReadonlySet<string>>(EMPTY_PERMISSIONS);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

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
        committedRef.current = true;
        const me = payload?.user ?? null;
        const granted = me?.permissions;
        setUser(me);
        setPermissions(new Set(Array.isArray(granted) ? granted : []));
        setStatus("ready");
      })
      .catch(() => {
        // Transport-level failure (offline, stalled connection). Before
        // anything has committed, access is unknown rather than denied —
        // surface "error" so the gate offers Retry instead of an authoritative
        // 403. After a commit, keep the prior state and stay "ready": a
        // transient focus re-fetch must never flash deny-all (or a wider set).
        if (!isStale() && !committedRef.current) setStatus("error");
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

  const reload = useCallback(() => {
    // Flip to the checking placeholder first so the gate's Retry button
    // disappears for the duration (no double fires); the load's own guards
    // then commit "ready" or re-enter "error".
    setStatus("loading");
    load();
  }, [load]);

  const value = useMemo<PermissionContextValue>(
    () => ({ user, permissions, can, status, reload }),
    [user, permissions, can, status, reload]
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
