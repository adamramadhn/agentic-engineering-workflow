import { spawn, type ChildProcess } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  baseConnectionString,
  deriveScratchDbName,
  dropScratchDb,
  loadTestEnv,
  scratchConnectionString,
} from "../../scripts/test-db.mjs";

/**
 * Matrix-suite runtime provisioning (epic 3 story 2) — the vitest counterpart
 * of playwright's webServer boot. Everything is REUSED, never reimplemented:
 *
 *   - the scratch database name/lifecycle rules come from scripts/test-db.mjs
 *     (same `rbac_test_` prefix, so the stale-run reaper stays compatible);
 *   - the boot itself is scripts/e2e-server.mjs — the identical boot path the
 *     e2e harness uses: port pre-check, create-database-before-spawn, readiness
 *     probe, signal forwarding, exit-path drop. One boot path, one set of
 *     failure modes.
 *
 * The boot child is spawned with the env contract the script expects
 * (E2E_SCRATCH_DB_NAME / DATABASE_URL rewritten to the scratch string /
 * E2E_BASE_DATABASE_URL / E2E_PORT=4312). vitest forks its workers only after
 * globalSetup returns, so the MATRIX_* variables published on process.env
 * below reach every spec.
 */

const HOST = "127.0.0.1";
const PORT = 4312;
const READY_TIMEOUT_MS = 180_000;
const POLL_MS = 250;
const EXIT_TIMEOUT_MS = 30_000;

const repoRoot = resolve(dirname(fileURLToPath(new URL(import.meta.url))), "../..");
const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

export default async function setup() {
  loadTestEnv();
  const base = baseConnectionString();
  const scratchName = deriveScratchDbName();
  const scratchUrl = scratchConnectionString(base, scratchName);
  const baseUrl = `http://${HOST}:${PORT}`;

  const bootLog: string[] = [];
  // detached: true — the boot supervisor gets its own process group so the
  // kill-timer fallback below can take down the whole tree (the supervisor
  // spawns `next start` as its own process; killing the supervisor alone
  // would orphan that grandchild on the port).
  const child: ChildProcess = spawn(
    process.execPath,
    [resolve(repoRoot, "scripts", "e2e-server.mjs")],
    {
      cwd: repoRoot,
      env: {
        ...process.env,
        E2E_SCRATCH_DB_NAME: scratchName,
        DATABASE_URL: scratchUrl,
        E2E_BASE_DATABASE_URL: base,
        E2E_PORT: String(PORT),
      },
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
    },
  );

  // The boot script logs to stderr by design; surface every line prefixed with
  // [matrix-boot] so a failed boot is diagnosable from the vitest output, and
  // keep a copy to embed in this setup's own failure messages.
  for (const stream of [child.stdout, child.stderr]) {
    if (!stream) continue;
    let pending = "";
    stream.setEncoding("utf8");
    stream.on("data", (chunk: string) => {
      pending += chunk;
      const lines = pending.split("\n");
      pending = lines.pop() ?? "";
      for (const line of lines) {
        bootLog.push(line);
        console.error(`[matrix-boot] ${line}`);
      }
    });
    stream.on("end", () => {
      if (pending) {
        bootLog.push(pending);
        console.error(`[matrix-boot] ${pending}`);
      }
    });
  }

  // SIGKILL the entire boot process GROUP (supervisor + `next start`). Killing
  // only the supervisor would leave the grandchild serving port 4312 while the
  // safety-net dropScratchDb FORCE-drops the database underneath it.
  const killProcessGroup = (): void => {
    if (child.pid === undefined) return;
    try {
      process.kill(-child.pid, "SIGKILL");
    } catch {
      // ESRCH — the group already emptied, nothing left to kill.
    }
  };

  const stopChild = (): Promise<void> =>
    new Promise((resolveStop) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolveStop();
        return;
      }
      // SIGTERM first — the script forwards it to `next start` and drops the
      // scratch database on its exit path. SIGKILL of the whole group only if
      // it hangs.
      const killTimer = setTimeout(killProcessGroup, EXIT_TIMEOUT_MS);
      child.once("exit", () => {
        clearTimeout(killTimer);
        resolveStop();
      });
      child.kill("SIGTERM");
    });

  // If vitest itself dies without running the returned teardown, still stop the
  // boot child; its own SIGTERM path kills `next start` and drops the DB.
  process.on("exit", () => {
    if (child.exitCode === null) child.kill("SIGTERM");
  });

  // Readiness = the same probe the boot script uses: GET /login answers AND a
  // login POST reaches query() (401 on the unknown email) — proving the whole
  // chain before any spec runs: server up, scratch DB reachable, ensureSchema()
  // ran, roles seeded.
  async function isReady(): Promise<boolean> {
    const page = await fetch(`${baseUrl}/login`, { signal: AbortSignal.timeout(5_000) });
    if (!page.ok) return false;
    const probe = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "matrix-harness@matrix.test",
        password: "matrix-readiness-probe",
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return probe.status === 401;
  }

  const startedAt = Date.now();
  let ready = false;
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(
        `[matrix] boot script exited during startup (code ${child.exitCode}) — boot log:\n` +
          bootLog.map((line) => `  ${line}`).join("\n"),
      );
    }
    try {
      if (await isReady()) {
        ready = true;
        break;
      }
    } catch {
      // not listening yet — keep polling
    }
    await sleep(POLL_MS);
  }
  if (!ready) {
    await stopChild();
    throw new Error(
      `[matrix] app not ready on ${baseUrl} within ${READY_TIMEOUT_MS / 1000}s — boot log:\n` +
        bootLog.map((line) => `  ${line}`).join("\n"),
    );
  }
  console.error(`[matrix] ready on ${baseUrl} against scratch database "${scratchName}"`);

  process.env.MATRIX_BASE_URL = baseUrl;
  process.env.MATRIX_DB_URL = scratchUrl;

  return async function teardown() {
    await stopChild();
    // Safety net: the boot script's exit path drops the scratch database, so
    // this is normally a quiet no-op — but a SIGKILLed child leaves the drop
    // to us. Tolerant either way (dropScratchDb never throws).
    await dropScratchDb({ name: scratchName, base, quiet: true });
  };
}
