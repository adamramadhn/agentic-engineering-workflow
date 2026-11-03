// Run against the local dev service. Set PLAYWRIGHT_MODULE if Playwright is not installed locally.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try { return require("playwright"); } catch {
    const cache = path.join(os.homedir(), ".npm/_npx");
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, "node_modules/playwright");
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error("Install Playwright or set PLAYWRIGHT_MODULE to its installed directory.");
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || "http://127.0.0.1:3010";
const output = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), "agent-board-check");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const results = [];
  const errors = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    await page.getByRole("link", { name: "Agent Board", exact: true }).last().click();
    await page.getByRole("heading", { name: "Agent Board", exact: true }).waitFor();
    assert.equal(new URL(page.url()).pathname, "/agent-board");
    assert.equal(new URL(page.url()).search, "");
    const column = id => page.locator(`[data-agent-column="${id}"]`);
    const card = id => page.locator(`[data-agent-task="agent-${id}"]`);
    const main = id => card(id).getByRole("button").first();
    const count = async (id, n) => assert.equal(await column(id).locator("[data-agent-task]").count(), n);
    await count("needs-you", 2); await count("running", 2); await count("done", 1);
    const order = await page.locator("nav:visible").first().getByRole("link").allTextContents();
    assert.deepEqual(order.map(label => label.trim()), ["Home", "Ask AI", "Agent Board"]);
    results.push("Initial cards, counts, sidebar position and route");

    const boardTab = page.getByRole("tab", { name: "Board", exact: true });
    const worktreeTab = page.getByRole("tab", { name: "Worktree", exact: true });
    await boardTab.waitFor();
    const pillPos = () => page.locator(".ui-segc__pill").evaluate(el => `${el.style.left}|${el.style.right}`);
    const pillBefore = await pillPos();
    assert.match(pillBefore, /px/);
    assert.equal(await page.locator('.ui-segc').getAttribute('data-variant'), 'tray');
    assert.equal(await page.locator('.ui-segc').getAttribute('data-size'), 'sm');
    await worktreeTab.focus();
    await page.keyboard.press('Home');
    assert.equal(await boardTab.getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await worktreeTab.getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal(await boardTab.getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowRight');
    assert.equal(await worktreeTab.getAttribute('aria-selected'), 'true');
    const boardBox = await boardTab.boundingBox();
    const treeBox = await worktreeTab.boundingBox();
    await page.mouse.move(treeBox.x + treeBox.width / 2, treeBox.y + treeBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(boardBox.x + boardBox.width / 2, boardBox.y + boardBox.height / 2, { steps: 4 });
    assert.equal(await boardTab.getAttribute('aria-selected'), 'true');
    await page.mouse.move(treeBox.x + treeBox.width / 2, treeBox.y + treeBox.height / 2, { steps: 4 });
    await page.mouse.up();
    assert.equal(await worktreeTab.getAttribute('aria-selected'), 'true');
    await page.getByText("Launch the new pricing page by Friday").waitFor();
    assert.equal(await page.locator("[data-tree-node]").count(), 7);
    assert.equal(await page.getByText("Running", { exact: true }).count(), 5);
    assert.equal(await page.getByText("Sonnet 5.5").count(), 3);
    await page.locator('[data-tree-node="run-writer"]').getByText("Needs you", { exact: true }).waitFor();
    await page.locator('[data-tree-node="run-scraper"]').getByText("Done", { exact: true }).waitFor();
    const treeCards = await page.locator('[data-worktree-card]').evaluateAll(cards => cards.map(card => {
      const { x, y, width, height } = card.getBoundingClientRect();
      return { id: card.dataset.worktreeCard, x, y, width, height };
    }));
    assert.ok(treeCards.every(card => Math.abs(card.width - 216) < 1));
    assert.ok(treeCards.every(card => card.height >= 112 && card.height <= 116));
    assert.equal(treeCards[1].y, treeCards[4].y);
    assert.equal(treeCards[4].y, treeCards[5].y);
    assert.equal(treeCards[2].x - treeCards[1].x, 32);
    assert.equal(treeCards[6].x - treeCards[5].x, 32);
    assert.equal(await page.getByRole("tree").count(), 1);
    assert.equal(await card("migrate").isVisible(), false);
    assert.notEqual(await pillPos(), pillBefore);
    const settleTree = () => page.locator(".worktree-tree").evaluate(async tree => {
      await Promise.all(tree.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
    });
    const researcher = page.locator('[data-tree-node="run-researcher"]');
    const researcherFold = researcher.getByRole('button', { name: /sub-agents of Researcher/ });
    assert.equal(await researcherFold.getAttribute("aria-expanded"), "true");
    await researcher.getByText("Compare the pricing").click();
    await settleTree();
    await page.locator('[id="worktree-fold-run-researcher"]').waitFor({ state: "hidden" });
    assert.equal(await page.locator('[id="worktree-fold-run-researcher"] > .t-acc-panel-inner').getAttribute("inert"), "");
    assert.equal(await page.getByText("Read the pricing pages of Linear").evaluate(element => !!element.closest("[inert]")), true);
    assert.equal(await page.getByText("Write the copy for the three plans").isVisible(), true);
    assert.equal(await researcherFold.getAttribute("aria-label"), "Show 2 sub-agents of Researcher");
    await researcher.focus();
    await page.keyboard.press("ArrowRight");
    await page.getByText("Read the pricing pages of Linear").waitFor();
    await page.keyboard.press("ArrowLeft");
    await settleTree();
    await page.locator('[id="worktree-fold-run-researcher"]').waitFor({ state: "hidden" });
    await page.keyboard.press("ArrowRight");
    await page.getByText("Read the pricing pages of Linear").waitFor();
    const rootNode = page.getByRole("treeitem", { level: 1 });
    await rootNode.focus();
    await page.keyboard.press("Enter");
    await settleTree();
    assert.equal(await page.getByText("Compare the pricing").evaluate(element => !!element.closest("[inert]")), true);
    await page.keyboard.press("Space");
    await page.getByText("Read the pricing pages of Linear").waitFor();
    const coderFold = page.getByRole("button", { name: "Fold the sub-agents of Coder", exact: true });
    await coderFold.focus();
    await page.keyboard.press("Enter");
    await settleTree();
    assert.equal(await page.getByText("Write and run the checkout tests").evaluate(element => !!element.closest("[inert]")), true);
    await page.keyboard.press("Space");
    await page.getByText("Write and run the checkout tests").waitFor();
    await worktreeTab.focus();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.locator(".worktree-children").evaluateAll(async elements => {
      await Promise.all(elements.flatMap(element => element.getAnimations()).map(animation => animation.finished.catch(() => {})));
    });
    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "worktree-light.png") });
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await boardTab.click();
    await card("migrate").waitFor();
    results.push("Board/Worktree tabs, run tree render, collapse and arrow keys");

    fs.mkdirSync(output, { recursive: true });
    await page.screenshot({ path: path.join(output, "desktop-light.png") });
    await page.evaluate(() => { localStorage.setItem("theme", "dark"); });
    await page.reload(); await card("migrate").waitFor();
    assert.equal(await page.locator("html").evaluate(el => el.classList.contains("dark")), true);
    await page.screenshot({ path: path.join(output, "desktop-dark.png") });
    await worktreeTab.click();
    await page.getByText("Launch the new pricing page by Friday").waitFor();
    await page.locator(".worktree-children").evaluateAll(async elements => {
      await Promise.all(elements.flatMap(element => element.getAnimations()).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: path.join(output, "worktree-dark.png") });
    await boardTab.click();
    await card("migrate").waitFor();
    results.push("Light and dark initial layouts");

    assert.equal(await main("migrate").getAttribute("aria-expanded"), "true");
    assert.equal(await card("migrate").getAttribute("data-open"), "true");
    await card("migrate").getByText("Read schema and 14 migrations").waitFor();
    await card("migrate").getByRole("button", { name: "Reject", exact: true }).waitFor();
    await card("migrate").getByRole("button", { name: "Approve", exact: true }).waitFor();
    assert.equal(await card("migrate").locator('[id="agent-fold-agent-migrate"]').count(), 1);
    assert.equal(await page.locator('[id^="agent-fold-"]:visible').count(), 1);
    assert.match(
      await page.locator('[id="agent-fold-agent-migrate"]').evaluate(el => getComputedStyle(el).transitionProperty),
      /grid-template-rows/,
    );
    await main("crm").click();
    assert.equal(await main("crm").getAttribute("aria-expanded"), "true");
    assert.equal(await main("migrate").getAttribute("aria-expanded"), "true");
    await card("crm").getByRole("button", { name: "Retry", exact: true }).waitFor();
    assert.equal(await card("crm").getByRole("button", { name: "Reject", exact: true }).count(), 0);
    results.push("Independent expansion keeps other cards open, waiting vs failed actions");

    await main("review").click();
    await card("review").getByText("Read the diff – 412 lines across 9 files").waitFor();
    assert.equal(await card("review").getByRole("button", { name: /Approve|Retry|Reject/ }).count(), 0);
    await main("digest").click();
    await card("digest").getByText("Posted the weekly summary", { exact: true }).waitFor();
    assert.equal(await card("digest").getByRole("button", { name: /Approve|Retry|Reject/ }).count(), 0);
    results.push("Running and done expand read-only");

    await main("migrate").focus(); await page.keyboard.press("Enter");
    assert.equal(await main("migrate").getAttribute("aria-expanded"), "false");
    await page.locator('[id="agent-fold-agent-migrate"]').waitFor({ state: "hidden" });
    assert.equal(
      await page.evaluate(() => document.querySelector('[id="agent-fold-agent-migrate"] .t-acc-panel-inner')?.hasAttribute("inert")),
      true,
    );
    await page.keyboard.press("Enter");
    assert.equal(await main("migrate").getAttribute("aria-expanded"), "true");
    await main("crm").focus(); await page.keyboard.press("Space");
    assert.equal(await main("crm").getAttribute("aria-expanded"), "false");
    results.push("Keyboard Enter and Space toggle one card at a time");

    await card("migrate").getByRole("button", { name: "Approve", exact: true }).click();
    await count("needs-you", 1); await count("running", 3);
    assert.equal(await card("migrate").getAttribute("data-state"), "running");
    await page.locator('[id="agent-fold-agent-migrate"]').waitFor({ state: "hidden" });
    await main("crm").click();
    await card("crm").getByRole("button", { name: "Retry", exact: true }).click();
    await count("needs-you", 0); await count("running", 4);
    await column("needs-you").getByText("No tasks here").waitFor();
    results.push("Approve and retry move task to Running, empty column state");

    await page.reload(); await card("migrate").waitFor(); await count("needs-you", 2);
    await card("migrate").getByRole("button", { name: "Reject", exact: true }).click();
    await count("needs-you", 1);
    assert.equal(await card("migrate").count(), 0);
    results.push("Reject dismisses task");

    await page.getByRole("link", { name: "Home", exact: true }).last().click();
    await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    assert.equal(await page.getByRole("table").count(), 1);
    await page.goBack(); await count("needs-you", 1);
    await page.goForward(); await page.getByRole("heading", { name: "Home", exact: true }).waitFor();
    await page.getByRole("link", { name: "Agent Board", exact: true }).last().click();
    await count("needs-you", 1);
    results.push("Reload, back/forward and Home regression; client navigation preserves board state");

    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Search pages and watched companies...").fill("Agent Board");
    await page.getByRole("option", { name: "Agent Board", exact: true }).click();
    await count("needs-you", 1);
    results.push("Command palette navigation");

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload(); await card("migrate").waitFor(); await count("needs-you", 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, "mobile-dark.png") });
    await main("review").click();
    await card("review").getByText("Read the diff – 412 lines across 9 files").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { localStorage.setItem("theme", "light"); });
    await page.reload(); await card("migrate").waitFor(); await count("needs-you", 2);
    await page.screenshot({ path: path.join(output, "mobile-light.png") });
    await worktreeTab.click();
    await page.getByText("Launch the new pricing page by Friday").waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator(".worktree-children").evaluateAll(async elements => {
      await Promise.all(elements.flatMap(element => element.getAnimations()).map(animation => animation.finished.catch(() => {})));
    });
    await page.screenshot({ path: path.join(output, "worktree-mobile-light.png") });
    results.push("Mobile stacked columns and expansion without overflow");
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: results, pageErrors: errors, screenshots: output }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
