/**
 * Workspace identity — the TypeScript half of the normalisation contract.
 *
 * `NORMALIZED_REMOTE_SQL` / `NORMALIZED_WORKSPACE_SQL` in `./db` are the other
 * half: the two partial unique indexes (`uq_bmad_projects_remote`,
 * `uq_bmad_projects_workspace`) are built from them, and `resolveProject`
 * compares this module's output against those same expressions. The halves must
 * produce byte-identical keys — if TS normalised more aggressively than the
 * index, a lookup would miss a row the index considers equal and a second
 * project for the same repo would be inserted.
 *
 * Every step below is the same step, in the same order, as identity-mapping.md
 * and its SQL. Lowercasing runs FIRST in both, which is what makes `.GIT` strip
 * by the same rule as `.git`; lowercasing at the end would run after the strip
 * had already missed it.
 *
 * Pure by design — no `pg`, no `next/*` — so the keys can be exercised without
 * a database.
 */
import { homedir } from "node:os";
import path from "node:path";

/**
 * The caller supplied an identity this module refuses to turn into a key.
 * Lives here, not in ./projects, because both normalisers below throw it and
 * this module must stay free of `pg`. ./projects re-exports it, so the API
 * routes keep importing it from there.
 */
export class ProjectIdentityError extends Error {
  constructor(message = "A git remote URL or a workspace path is required") {
    super(message);
    this.name = "ProjectIdentityError";
  }
}

/**
 * PostgreSQL `btrim(x)` with no character set strips spaces (U+0020) and
 * nothing else. `String#trim()` strips a wider set (tabs, newlines, Unicode
 * spaces), so using it here would diverge from the SQL on inputs like
 * `" /a/b\t"`.
 */
function btrimSpaces(value: string): string {
  return value.replace(/^ +/, "").replace(/ +$/, "");
}

/**
 * Comparable form of a git remote: `host/owner/repo`, lowercased.
 *
 * Mirrors `NORMALIZED_REMOTE_SQL` step for step:
 *   lower(btrim(x))            → btrimSpaces + toLowerCase
 *   strip trailing "/"         → /\/+$/ (one maximal run, like POSIX)
 *   strip ".git" suffix        → /\.git$/
 *   strip scheme               → ^[A-Za-z][A-Za-z0-9+.-]*://
 *   strip userinfo             → ^[^/@]*@   (git@, ssh://git@)
 *   host:port/path → host/path → ^([^/:]+):[0-9]+(/.*)$
 *   host:path      → host/path → ^([^/:]+):(.*)$   (scp-like)
 *
 * So all four forms from identity-mapping.md — scp-like, https with and
 * without `.git`, and ssh:// with userinfo and a port — collapse to one key.
 * An input with no host (e.g. `""`) yields `""`; the caller decides whether an
 * empty key still counts as an identity.
 *
 * NON-ASCII IS REJECTED, deliberately. JS `toLowerCase()` and PostgreSQL
 * `lower()` are different implementations: on `ΑΣ` JS produces a final sigma
 * (U+03C2) where PG produces U+03C3, and `İ` becomes `i` + a combining dot in
 * JS but plain `i` in PG. `resolveProject` binds this key as `$1` and compares
 * it to the SQL expression over the STORED value, so such a remote can never
 * equal itself — every resolve would insert another project. Real git remotes
 * are ASCII, so a clear rejection beats a silent duplicate.
 */
export function normalizeGitRemote(remote: string): string {
  let key = btrimSpaces(remote).toLowerCase();
  key = key.replace(/\/+$/, "");
  key = key.replace(/\.git$/, "");
  key = key.replace(/^[A-Za-z][A-Za-z0-9+.-]*:\/\//, "");
  key = key.replace(/^[^/@]*@/, "");
  key = key.replace(/^([^/:]+):[0-9]+(\/.*)$/, "$1$2");
  key = key.replace(/^([^/:]+):(.*)$/, "$1/$2");
  // Anything outside ASCII cannot be lowercased identically by JS and PG, so
  // its key is not comparable and must not be returned (see above).
  if (/[^\x00-\x7F]/.test(key)) {
    throw new ProjectIdentityError("git remote must be ASCII");
  }
  return key;
}

/**
 * Comparable form of a workspace path: absolute, `~` expanded, no trailing
 * slash (root stays `/`).
 *
 * `btrim` + the trailing-slash strip + the root rule mirror
 * `NORMALIZED_WORKSPACE_SQL` exactly, which is what the index composes. The
 * `~` expansion and absolutisation are resolver-only steps: they happen before
 * the value is stored, so a stored path never contains `~` and the SQL sees an
 * already-absolute string.
 *
 * Symlinks are deliberately NOT resolved (no `fs.realpath`): two worktrees
 * symlinked to the same directory stay distinct workspaces, so one cannot be
 * mistaken for the other. A path that does not exist on disk is accepted as-is
 * after normalisation — existence is never checked on this path.
 *
 * `""` returns `""` (matching the SQL for an empty input) so callers can treat
 * an empty key as "no identity" instead of silently resolving to the cwd.
 *
 * RELATIVE PATHS ARE REJECTED. `path.resolve("src")` anchors to the dashboard
 * server's process cwd, and expanding `~` uses the SERVER's home — a CLI
 * sending `src` or `.` would silently key its project to the server's
 * directory, which is never what the caller meant. Only an absolute path or a
 * `~/` path (explicitly the caller's intent to use a home directory) is an
 * identity; `.` and `..` segments are still collapsed lexically, just not
 * anchored.
 */
export function normalizeWorkspacePath(workspacePath: string): string {
  const value = btrimSpaces(workspacePath);
  if (value === "") return "";
  let expanded = value;
  if (value === "~" || value.startsWith("~/")) {
    expanded = value === "~" ? homedir() : path.join(homedir(), value.slice(2));
  } else if (!value.startsWith("/")) {
    throw new ProjectIdentityError(
      "workspacePath must be absolute or start with ~/"
    );
  }
  // Lexical only: collapses `.`/`..` without touching the filesystem, so no
  // symlink is followed (that is the deliberate no-realpath rule above).
  const absolute = path.resolve(expanded);
  return /^\/+$/.test(absolute) ? "/" : absolute.replace(/\/+$/, "");
}
