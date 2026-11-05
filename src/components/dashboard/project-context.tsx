"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch } from "@/lib/api";

/** The subset of `GET /api/projects` the dashboard actually consumes. */
export interface WorkspaceProject {
  id: string;
  name: string;
  gitRemoteUrl: string | null;
  workspacePath: string | null;
}

interface ProjectContextValue {
  /** Every registered project, in the order the API returned them. */
  projects: WorkspaceProject[];
  /** Active project id; `null` only while nothing is selectable (loading, error, or empty). */
  projectId: string | null;
  project: WorkspaceProject | null;
  /** `"error"` means the list could not be read — not that there are no projects. */
  status: "loading" | "ready" | "error";
  setProjectId(id: string): void;
  reload(): void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

/** Remembers the selection across reloads. Holds a project *id*: workspace
 *  names are display labels, and the API does not promise they are unique. */
const STORAGE_KEY = "bmad-monitor.active-project-id";

function readStoredProjectId(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage disabled (private mode, blocked origin): no persistence, no crash.
    return null;
  }
}

function storeProjectId(id: string | null): void {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Same as above: the selection simply does not survive a reload.
  }
}

function toProject(value: unknown): WorkspaceProject | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.name !== "string") return null;
  return {
    id: row.id,
    name: row.name,
    gitRemoteUrl: typeof row.gitRemoteUrl === "string" ? row.gitRemoteUrl : null,
    workspacePath: typeof row.workspacePath === "string" ? row.workspacePath : null,
  };
}

/**
 * Which project a freshly loaded list should activate. The current selection
 * wins if it still exists (a re-fetch must not yank the user elsewhere), then
 * the stored one, then the first project returned — so a deleted project falls
 * back instead of leaving the board pointed at nothing.
 */
function resolveActiveProjectId(
  projects: WorkspaceProject[],
  current: string | null,
  stored: string | null
): string | null {
  const exists = (id: string | null) => id !== null && projects.some(project => project.id === id);
  if (exists(current)) return current;
  if (exists(stored)) return stored;
  return projects[0]?.id ?? null;
}

/**
 * Secondary line of a Workspace Switcher entry. `bmad_projects` has no plan
 * tier, so the honest equivalent is where the workspace lives: the git remote
 * host, or the fact that it is a local checkout.
 */
export function workspaceSubtitle(project: WorkspaceProject): string {
  const remote = project.gitRemoteUrl?.trim();
  if (remote) {
    // scp-like form: git@github.com:owner/repo.git
    const scpHost = /^[^/@\s]+@([^:/\s]+):/.exec(remote);
    if (scpHost) return scpHost[1];
    try {
      const host = new URL(remote).host;
      if (host) return host;
    } catch {
      // Not a URL — fall through to the path-based label below.
    }
  }
  if (project.workspacePath) return "Workspace lokal";
  return "Workspace";
}

/**
 * Single source of truth for "which project is active": the sidebar highlights
 * from it and the Agent Board reads every request (and mutation) from it. The
 * project list comes from `GET /api/projects` — `bmad_projects` is the registry
 * of workspaces, not a hardcoded menu.
 */
export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [projectId, setProjectIdState] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let ignore = false;
    apiFetch("/api/projects", { cache: "no-store" })
      .then(response => (response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))))
      .then((payload: unknown) => {
        if (ignore) return;
        // A non-array payload is a broken response, not an empty workspace. It
        // must not be reported as "ready with zero projects": that would clear
        // the stored selection and leave the user with no workspace, from a
        // single transient bad response.
        if (!Array.isArray(payload)) {
          throw new Error("Unexpected /api/projects payload");
        }
        const list = payload
          .map(toProject)
          .filter((project): project is WorkspaceProject => project !== null);
        setProjects(list);
        setStatus("ready");
        setProjectIdState(current => resolveActiveProjectId(list, current, readStoredProjectId()));
      })
      .catch((error: unknown) => {
        if (ignore) return;
        console.warn("[Workspace] Gagal memuat daftar project:", error);
        setStatus("error");
      });
    return () => {
      ignore = true;
    };
  }, [reloadToken]);

  // Persist only a selection the list confirmed. Writing during the initial
  // `null` would erase the remembered id before the fetch that reads it lands,
  // which is exactly how a reload would lose the workspace.
  useEffect(() => {
    // Only forget the remembered project when the list is known and non-empty
    // and the stored id is genuinely gone from it. Clearing on an EMPTY list
    // would let one transient incomplete response erase the user's choice for
    // good, since the id can only be repaired on the next successful load.
    if (status !== "ready" || projectId === null) return;
    const stored = readStoredProjectId();
    if (projects.length === 0 && stored !== null) return;
    storeProjectId(projectId);
  }, [projectId, projects.length, status]);

  const setProjectId = useCallback((id: string) => {
    setProjectIdState(id);
  }, []);

  const reload = useCallback(() => {
    // From the event handler, not the effect: the effect body may only kick
    // off the request, never set state synchronously with the render.
    setStatus("loading");
    setReloadToken(current => current + 1);
  }, []);

  const value = useMemo<ProjectContextValue>(() => ({
    projects,
    projectId,
    project: projects.find(project => project.id === projectId) ?? null,
    status,
    setProjectId,
    reload,
  }), [projects, projectId, status, setProjectId, reload]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useActiveProject(): ProjectContextValue {
  const value = useContext(ProjectContext);
  if (!value) throw new Error("useActiveProject must be used inside <ProjectProvider>");
  return value;
}
