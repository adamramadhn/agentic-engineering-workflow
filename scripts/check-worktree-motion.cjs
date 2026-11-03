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
    throw new Error("Install Playwright or set PLAYWRIGHT_MODULE.");
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || "http://127.0.0.1:3010";
const output = path.join(os.tmpdir(), "worktree-motion-check");

(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  const passed = [];
  page.on("pageerror", error => errors.push(error.message));
  const root = page.locator('[data-tree-node="run-orchestrator"]');
  const researchPanel = page.locator('#worktree-fold-run-researcher');
  const rootPanel = page.locator('#worktree-fold-run-orchestrator');
  const researchButton = page.getByRole('button', { name: /sub-agents of Researcher/ });
  const settle = () => page.locator('.worktree-tree').evaluate(async tree => {
    await Promise.all(tree.getAnimations({ subtree: true }).filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {})));
  });
  const geometry = () => page.locator('[data-worktree-card]').evaluateAll(cards => cards.map(card => {
    const { x, y, width, height, right, bottom } = card.getBoundingClientRect();
    return { id: card.dataset.worktreeCard, x, y, width, height, right, bottom };
  }));
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  const noTextOverlap = async () => assert.deepEqual(await page.locator('.worktree-card').evaluateAll(cards => cards.flatMap(card => {
    const name = card.querySelector('.worktree-name').getBoundingClientRect();
    const badge = card.querySelector('.worktree-status').getBoundingClientRect();
    const task = card.querySelector('.worktree-task').getBoundingClientRect();
    return name.left < badge.right && name.right > badge.left && name.top < badge.bottom && name.bottom > badge.top || task.top < Math.max(name.bottom, badge.bottom) - 1 ? [card.dataset.worktreeCard] : [];
  })), []);
  try {
    fs.mkdirSync(output, { recursive: true });
    await page.goto(`${base}/agent-board`);
    await page.getByRole('tab', { name: 'Worktree', exact: true }).click();
    await root.waitFor();
    assert.equal(await page.locator('[data-tree-node]').count(), 7);
    assert.equal(await rootPanel.evaluate(el => el.getAnimations().length), 0, 'No accordion animation on mount');
    assert.equal(await researchPanel.evaluate(el => getComputedStyle(el).transitionDuration), '0.25s');
    passed.push('Complete tree renders without mount animation; transitions.dev 250ms tokens');
    const unclippedCards = async () => {
      const clipped = await page.locator('[data-worktree-card]').evaluateAll(cards => cards.flatMap(card => {
        const rect = card.getBoundingClientRect();
        const failures = [];
        for (let parent = card.parentElement; parent; parent = parent.parentElement) {
          if (!parent.classList.contains('t-acc-panel-inner')) continue;
          const clip = parent.getBoundingClientRect();
          if (clip.bottom - rect.bottom < 3 || rect.left - clip.left < 3 || clip.right - rect.right < 3) failures.push(card.dataset.worktreeCard);
        }
        return failures;
      }));
      assert.deepEqual(clipped, [], 'Every card must have clearance for its shadow inside every accordion clip');
    };
    await unclippedCards();
    passed.push('Bottom/side hairline and shadow clearance inside every ancestor accordion');

    // Play the real transitions at 10% speed, inspect halfway, then reverse them.
    await page.locator('.worktree-canvas').evaluate(el => {
      el.style.setProperty('--acc-expand', '2500ms');
      el.style.setProperty('--acc-collapse', '2500ms');
      el.style.setProperty('--acc-chevron', '2500ms');
    });
    const expandedHeight = await researchPanel.evaluate(el => el.getBoundingClientRect().height);
    await researchButton.click();
    assert.equal(await researchPanel.locator('> .t-acc-panel-inner').getAttribute('inert'), '');
    await researchPanel.evaluate(async el => {
      await new Promise(resolve => requestAnimationFrame(resolve));
      for (const animation of el.getAnimations()) { animation.pause(); animation.currentTime = 1250; }
    });
    const midHeight = await researchPanel.evaluate(el => el.getBoundingClientRect().height);
    assert.ok(midHeight > 0 && midHeight < expandedHeight, `${midHeight} must be between 0 and ${expandedHeight}`);
    await page.screenshot({ path: path.join(output, 'accordion-mid-collapse.png') });
    await researchButton.click();
    await settle();
    assert.ok(Math.abs(await researchPanel.evaluate(el => el.getBoundingClientRect().height) - expandedHeight) < 1);
    await researchButton.click();
    await settle();
    assert.equal(await researchPanel.evaluate(el => el.getBoundingClientRect().height), 0);
    assert.equal(await rootPanel.getAttribute('aria-hidden'), 'false');
    await root.focus(); await page.keyboard.press('Enter'); await settle();
    assert.equal(await rootPanel.evaluate(el => el.getBoundingClientRect().height), 0);
    await page.keyboard.press('Space'); await settle();
    assert.equal(await researchPanel.evaluate(el => el.getBoundingClientRect().height), 0, 'Parent reopening must preserve closed child');
    await researchButton.click(); await settle();
    passed.push('10% speed: intermediate height, reversible transition, zero-height closed panel and independent nested state');
    await page.locator('.worktree-canvas').evaluate(el => el.removeAttribute('style'));

    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await noOverflow();
      await noTextOverlap();
      await unclippedCards();
      const ltr = await geometry();
      await page.locator('html').evaluate(el => el.dir = 'rtl');
      const rtl = await geometry();
      await noOverflow();
      await noTextOverlap();
      assert.equal(ltr.length, rtl.length);
      for (let i = 0; i < ltr.length; i++) assert.ok(Math.abs(ltr[i].width - rtl[i].width) < 1);
      const rtlChild = rtl.find(c => c.id === 'run-scraper');
      const rtlParent = rtl.find(c => c.id === 'run-researcher');
      assert.equal(Math.round(rtlParent.right - rtlChild.right), 32);
      await page.screenshot({ path: path.join(output, `rtl-${width}.png`), fullPage: true });
      await page.locator('html').evaluate(el => el.dir = 'ltr');
    }
    passed.push('320/390/768/1024/1440/1920px: no overflow or label collisions, RTL branch mirror');

    await page.setViewportSize({ width: 720, height: 500 });
    await page.evaluate(() => document.documentElement.style.fontSize = '32px');
    await noOverflow(); await noTextOverlap();
    await page.screenshot({ path: path.join(output, '200-percent-text.png'), fullPage: true });
    await page.evaluate(() => document.documentElement.style.removeProperty('font-size'));
    passed.push('200% text at effective 720px viewport without overlap');

    await page.goto(`${base}/agent-board`);
    await page.getByRole('tab', { name: 'Worktree', exact: true }).click();
    await root.waitFor();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await researchButton.click(); await settle();
    assert.equal(await researchPanel.evaluate(el => getComputedStyle(el).transitionProperty), 'none');
    assert.equal(await researchPanel.locator('> .t-acc-panel-inner').evaluate(el => getComputedStyle(el).filter), 'none');
    await researchButton.click(); await settle();
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('html').evaluate(el => el.classList.add('dark'));
    await noTextOverlap();
    await page.screenshot({ path: path.join(output, 'dark.png'), fullPage: true });
    passed.push('Reduced motion: no height or blur animation; dark theme checked');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed, errors, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
