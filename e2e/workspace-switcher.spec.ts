import { expect, test, type Page } from "@playwright/test";
import {
  cleanupE2EFixtures,
  closeDbPool,
  getPool,
  login,
  seedUser,
} from "./helpers";

/**
 * Workspace Switcher completeness and the Worktree sample label
 * (spec-bmad-hardening story 6: D-9 and D-6).
 *
 * The switcher has to say where its list stands instead of rendering an empty
 * chip, and a workspace switch has to reach the Agent Board's existing
 * `role="status"` live region — the toast alone is invisible to a screen
 * reader. The Worktree tab's static sample must never be the default, and when
 * it is chosen the page has to say in visible text that it is sample data.
 *
 * None of it depends on the `prj_default` demo seed: `/api/projects` is either
 * intercepted outright (loading/error/empty) or answered from per-test rows,
 * and the active project is pinned through `localStorage` — the same key
 * `project-context.tsx` reads. Fixture ids carry `test.info().retry` so a
 * Playwright retry in a reused worker gets fresh rows.
 */

const ADMIN_EMAIL = "workspace-switcher-admin@e2e.test";

/** The key `project-context.tsx` persists the active project id under. */
const ACTIVE_PROJECT_KEY = "bmad-monitor.active-project-id";

const TRIGGER_LOADING = "Memuat workspace…";
const TRIGGER_ERROR = "Gagal memuat workspace";
const TRIGGER_EMPTY = "Belum ada workspace";
const MENU_LOADING = "Memuat daftar workspace…";
const MENU_ERROR = "Daftar workspace tidak dapat dimuat.";
const MENU_EMPTY = "Belum ada workspace terdaftar.";
/** The state clause is appended to the visible text (WCAG 2.5.3), so every
 *  accessible-name assertion below pins the pair, not just the clause. */
const labelFor = (visible: string, clause: string) => `${visible} — ${clause}`;

interface ProjectFixture {
  id: string;
  name: string;
  path: string;
}

function projectFixture(retry: number, label: string, index: number): ProjectFixture {
  const stamp = `${Date.now().toString(36)}-${process.pid.toString(36)}-${retry}-${index}`;
  return {
    id: `prj_e2e_switcher_${label}_${stamp}`,
    name: `E2E Switcher ${label} ${retry} ${index}`,
    path: `/tmp/e2e-switcher-${label}-${stamp}`,
  };
}

const seededProjects: ProjectFixture[] = [];

async function seedProjects(projects: ProjectFixture[]): Promise<void> {
  for (const project of projects) {
    await getPool().query(
      `INSERT INTO bmad_projects (id, name, workspace_path)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [project.id, project.name, project.path],
    );
    seededProjects.push(project);
  }
}

/** The shape `GET /api/projects` returns for these rows. */
function projectsPayload(projects: ProjectFixture[]) {
  return projects.map(project => ({
    id: project.id,
    name: project.name,
    gitRemoteUrl: null,
    workspacePath: project.path,
  }));
}

/** Answer `/api/projects` with a fixed payload. */
async function routeProjects(page: Page, projects: ProjectFixture[]): Promise<void> {
  await page.route("**/api/projects", route =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(projectsPayload(projects)),
    }),
  );
}

/** Pin the active project before any app script runs. */
async function pinActiveProject(page: Page, projectId: string): Promise<void> {
  await page.addInitScript(
    ([key, id]) => window.localStorage.setItem(key, id),
    [ACTIVE_PROJECT_KEY, projectId],
  );
}

// Case-insensitive: the state names start with their visible text, so they do
// not all begin with "Ganti".
const switcherTrigger = (page: Page) => page.getByRole("button", { name: /ganti workspace/i });
const switcherMenu = (page: Page) => page.locator('[data-slot="dropdown-menu-content"]');
/** Sonner's toast card, matched by the sentence it shows. */
const toastWith = (page: Page, text: string) =>
  page.locator("[data-sonner-toast]").filter({ hasText: text });
/** The shell's single `sr-only` live region, mounted on every route since the
 *  sidebar can switch workspace from any page. */
const liveRegion = (page: Page) => page.locator('body > p[role="status"]');

test.beforeAll(async () => {
  await seedUser({ name: "Workspace Switcher Admin", email: ADMIN_EMAIL, role: "Admin" });
});

test.afterAll(async () => {
  try {
    if (seededProjects.length > 0) {
      // Children first, then the parent — the same lock order the app uses
      // (see board-states.spec.ts: the inverse order deadlocks against the
      // boot seed's inserts).
      const ids = seededProjects.map(project => project.id);
      await getPool().query(`DELETE FROM bmad_agent_nodes WHERE project_id = ANY($1::text[])`, [ids]);
      await getPool().query(`DELETE FROM bmad_tasks WHERE project_id = ANY($1::text[])`, [ids]);
      await getPool().query(`DELETE FROM bmad_projects WHERE id = ANY($1::text[])`, [ids]);
    }
    await cleanupE2EFixtures({ emails: [ADMIN_EMAIL] });
  } finally {
    await closeDbPool();
  }
});

test("a failed project list is reported by the trigger and by the menu, and the menu still opens", async ({ page }) => {
  await page.route("**/api/projects", route =>
    route.fulfill({ status: 500, contentType: "application/json", body: '{"error":"boom"}' }),
  );
  await login(page, ADMIN_EMAIL);
  await page.goto("/");

  // The trigger states the failure instead of rendering an empty chip, and the
  // accessible name is that visible text plus the state clause.
  await expect(switcherTrigger(page)).toHaveText(TRIGGER_ERROR);
  await expect(switcherTrigger(page)).toHaveAttribute(
    "aria-label",
    labelFor(TRIGGER_ERROR, "ganti workspace; daftar workspace gagal dimuat"),
  );

  // The menu is still usable: it opens and explains the same failure.
  await switcherTrigger(page).click();
  await expect(switcherMenu(page)).toBeVisible();
  await expect(switcherMenu(page)).toContainText(MENU_ERROR);
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  // Recovery is offered here, not only by reloading the page.
  await expect(page.getByRole("menuitem", { name: "Coba lagi" })).toBeEnabled();
});

test("a pending project list shows loading copy and never blocks the menu", async ({ page }) => {
  let release: (() => void) | undefined;
  const held = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/projects", async route => {
    await held;
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await login(page, ADMIN_EMAIL);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(switcherTrigger(page)).toHaveText(TRIGGER_LOADING);
  await expect(switcherTrigger(page)).toHaveAttribute(
    "aria-label",
    labelFor(TRIGGER_LOADING, "ganti workspace; daftar workspace sedang dimuat"),
  );
  await expect(switcherTrigger(page)).toBeEnabled();

  await switcherTrigger(page).click();
  await expect(switcherMenu(page)).toBeVisible();
  await expect(switcherMenu(page)).toContainText(MENU_LOADING);

  // Let the held request finish and show the empty state, so no route is left
  // pending when the test ends.
  release?.();
  await expect(switcherTrigger(page)).toHaveText(TRIGGER_EMPTY);
});

test("an empty project list says so instead of showing an empty trigger", async ({ page }) => {
  await routeProjects(page, []);
  await login(page, ADMIN_EMAIL);
  await page.goto("/");

  await expect(switcherTrigger(page)).toHaveText(TRIGGER_EMPTY);
  await expect(switcherTrigger(page)).toHaveAttribute(
    "aria-label",
    labelFor(TRIGGER_EMPTY, "ganti workspace; belum ada workspace terdaftar"),
  );
  await switcherTrigger(page).click();
  await expect(switcherMenu(page)).toContainText(MENU_EMPTY);
  // "Buat workspace" stays present and disabled — the only affordance left.
  await expect(page.getByRole("menuitem", { name: /Buat workspace/ })).toBeDisabled();
});

test("switching workspace toasts in Indonesian and announces the new name to the shell's live region", async ({ page }, testInfo) => {
  const [first, second] = [1, 2].map(index => projectFixture(testInfo.retry, "switch", index));
  await seedProjects([first, second]);
  await routeProjects(page, [first, second]);
  await pinActiveProject(page, first.id);

  // Collect every board fetch so "a switch actually refetches" and "a no-op
  // re-pick issues no request" are both observable instead of inferred.
  const taskRequests: string[] = [];
  const boardRequests = (uid: string) => `**/api/projects/${uid}/tasks`;
  await page.route(boardRequests(first.id), route => route.continue());
  await page.route(boardRequests(second.id), route => {
    taskRequests.push(second.id);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  await login(page, ADMIN_EMAIL);
  await page.goto("/agent-board");
  await expect(page.getByRole("heading", { name: "Agent Board" })).toBeAttached();
  await expect(switcherTrigger(page)).toHaveText(first.name);
  await expect(switcherTrigger(page)).toHaveAttribute("aria-label", labelFor(first.name, "ganti workspace"));

  // Everything that leaves the page, so the no-op assertion below can count.
  const outgoing: string[] = [];
  page.on("request", request => outgoing.push(request.url()));

  // Re-picking the active workspace is a no-op: no toast, no announcement, and
  // no request — not even a refetch.
  await switcherTrigger(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(first.name) }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await expect(liveRegion(page)).toHaveText("");
  expect(outgoing.filter(url => url.includes("/api/projects/"))).toEqual([]);

  // A real switch says so twice: visible toast, and the live region a screen
  // reader actually hears.
  await switcherTrigger(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(second.name) }).click();
  await expect(toastWith(page, `Beralih ke workspace ${second.name}`)).toBeVisible();
  await expect(liveRegion(page)).toHaveText(`Beralih ke workspace ${second.name}.`);
  await expect(switcherTrigger(page)).toHaveText(second.name);

  // The board is bound to the new workspace: its own tasks endpoint is what it
  // asks for now.
  await expect.poll(() => taskRequests.length, { timeout: 15_000 }).toBeGreaterThan(0);
});

test("a live region mounted in the shell does not replay an old announcement after a remount", async ({ page }, testInfo) => {
  const [first, second] = [1, 2].map(index => projectFixture(testInfo.retry, "remount", index));
  await seedProjects([first, second]);
  await routeProjects(page, [first, second]);
  await pinActiveProject(page, first.id);

  await login(page, ADMIN_EMAIL);
  await page.goto("/agent-board");
  await expect(switcherTrigger(page)).toHaveText(first.name);

  await switcherTrigger(page).click();
  await page.getByRole("menuitemradio", { name: new RegExp(second.name) }).click();
  await expect(liveRegion(page)).toHaveText(`Beralih ke workspace ${second.name}.`);

  // Client-side navigation away and back: the region lives in the shell, so it
  // survives — the board remounting must show nothing rather than replay.
  await page.getByRole("link", { name: "Wiki", exact: true }).first().click();
  await expect(page).toHaveURL(/\/wiki$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "Agent Board" })).toBeAttached();
  // Immediate check: the remount does not replay the sentence, and the board
  // keeps no copy of it either.
  await expect(liveRegion(page)).toHaveText("");
  // ...and it is cleared after the read window, so the next page never
  // inherits it at all.
  await expect(liveRegion(page)).toHaveText("", { timeout: 20_000 });
});

test("the collapsed sidebar carries the state in the accessible name alone", async ({ page }, testInfo) => {
  const [first] = [1].map(index => projectFixture(testInfo.retry, "collapsed", index));
  await seedProjects([first]);
  await routeProjects(page, [first]);
  await pinActiveProject(page, first.id);

  await login(page, ADMIN_EMAIL);
  await page.goto("/");
  await expect(switcherTrigger(page)).toHaveText(first.name);

  // The desktop trigger is icon-only when collapsed, so the name is the only
  // place the active workspace can still be read.
  await page.getByRole("button", { name: "Collapse sidebar (Cmd+B)" }).click();
  const collapsedTrigger = page.locator("aside").getByRole("button", { name: /ganti workspace/ });
  await expect(collapsedTrigger).toHaveText("");
  await expect(collapsedTrigger).toHaveAttribute("aria-label", labelFor(first.name, "ganti workspace"));

  // And it keeps doing so while the list is still loading.
  await page.route("**/api/projects", route => route.abort());
  await page.reload({ waitUntil: "domcontentloaded" });
  const collapsedError = page.locator("aside").getByRole("button", { name: /ganti workspace/ });
  await expect(collapsedError).toHaveAttribute(
    "aria-label",
    labelFor(TRIGGER_ERROR, "ganti workspace; daftar workspace gagal dimuat"),
    { timeout: 15_000 },
  );
});

test("the Worktree tab opens on the database tree, and the sample tree is labelled when chosen", async ({ page }, testInfo) => {
  const project = projectFixture(testInfo.retry, "worktree", 1);
  await seedProjects([project]);
  await routeProjects(page, [project]);
  await pinActiveProject(page, project.id);

  await login(page, ADMIN_EMAIL);
  await page.goto("/agent-board");
  await expect(page.getByRole("heading", { name: "Agent Board" })).toBeAttached();

  // No agent node seeded: the database tree is empty, and the tab must say so
  // rather than fall back to the sample fixture.
  await page.getByRole("tab", { name: "Worktree" }).click();
  await expect(page.getByText(`Belum ada pohon agen di workspace ${project.name}.`, { exact: true })).toBeVisible();
  await expect(page.getByText("Launch the new pricing page by Friday", { exact: true })).toHaveCount(0);

  // The LIVE half is named in Indonesian before anything is opened: only the
  // sample label is asserted later otherwise, and this is the half that could
  // silently regress to English.
  const sourceTrigger = page.getByRole("button", { name: "Sumber pohon Worktree" });
  await expect(sourceTrigger).toContainText("Pohon BMad langsung · database");
  await sourceTrigger.click();
  await expect(page.getByRole("radio", { name: "Pohon BMad langsung · database", exact: true }))
    .toHaveAttribute("aria-checked", "true");

  // Choose the sample: the tree appears, and a visible line says it is sample
  // data — not just an attribute. The tree's container describes itself with
  // that line, so a screen reader reading the tree meets it too.
  await page.getByRole("radio", { name: /Contoh · Halaman harga/ }).click();
  await page.keyboard.press("Escape");

  const sampleNote = page.locator("#worktree-sample-note");
  await expect(sampleNote).toContainText("Data contoh, bukan data database.");
  await expect(page.locator('section[aria-label="Pohon contoh"]')).toHaveAttribute(
    "aria-describedby",
    "worktree-sample-note",
  );
  await expect(page.getByText("Launch the new pricing page by Friday", { exact: true })).toBeVisible();
  // The trigger now names the sample too, so the state is readable after the
  // popover closes.
  await expect(sourceTrigger).toContainText("Contoh · Halaman harga · 3 cabang");
});

test("the sample-data caveat has its own sentence when no workspace is active", async ({ page }) => {
  await routeProjects(page, []);
  await login(page, ADMIN_EMAIL);
  await page.goto("/agent-board");
  await expect(switcherTrigger(page)).toHaveText(TRIGGER_EMPTY);

  await page.getByRole("tab", { name: "Worktree" }).click();
  await page.getByRole("button", { name: "Sumber pohon Worktree" }).click();
  await page.getByRole("radio", { name: /Contoh · Halaman harga/ }).click();
  await page.keyboard.press("Escape");

  // The workspace-name fallback used to read "... tidak berasal dari workspace
  // ini", which parses wrong; with no project it gets a complete sentence.
  const note = page.locator("#worktree-sample-note");
  await expect(note).toContainText("belum ada workspace aktif");
  await expect(note).not.toContainText("tidak berasal dari workspace");
});
