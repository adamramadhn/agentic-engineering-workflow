const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try { return require('playwright'); } catch {
    for (const entry of fs.readdirSync(path.join(os.homedir(), '.npm/_npx'))) {
      const candidate = path.join(os.homedir(), '.npm/_npx', entry, 'node_modules/playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Install Playwright or set PLAYWRIGHT_MODULE.');
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || 'http://127.0.0.1:3011';
(async () => {
  const server = process.env.APP_URL ? null : spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', '3011'], { stdio: ['ignore', 'pipe', 'pipe'] });
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const passed = [];
  const out = '/tmp/home-charts-check';
  fs.mkdirSync(out, { recursive: true });
  try {
    if (server) await new Promise((resolve, reject) => {
      server.stdout.on('data', data => { if (data.toString().includes('Ready')) resolve(); });
      server.stderr.on('data', data => process.stderr.write(data));
      server.on('exit', code => reject(new Error(`Server exited ${code}`)));
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.chartFonts = [];
      const fillText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (...args) {
        window.chartFonts.push(this.font);
        return fillText.apply(this, args);
      };
    });
    await page.goto(base);
    const analytics = page.getByRole('region', { name: 'Task analytics', exact: true });
    await analytics.locator('canvas').nth(3).waitFor();
    assert.equal(await analytics.getByRole('region').count(), 4);
    const typography = await analytics.locator('[data-slot="card-title"]').evaluateAll(nodes => nodes.map(node => ({ size: getComputedStyle(node).fontSize, family: getComputedStyle(node).fontFamily })));
    assert.ok(typography.every(style => style.size === '13px' && /geist/i.test(style.family)));
    assert.ok(await page.evaluate(() => window.chartFonts.some(font => /geist/i.test(font))));
    passed.push('All four chart titles use compact 13px Geist and canvas labels render with Geist');
    const cards = page.locator('article').filter({ has: page.getByRole('button', { name: /About (Kick-off|In-Production|Completed|Overtime)/ }) });
    assert.equal(await cards.count(), 4);
    for (const [name, count] of [['Kick-off', 15], ['In-Production', 10], ['Completed', 8], ['Overtime', 5]]) {
      const card = page.getByRole('article', { name, exact: true });
      assert.match(await card.innerText(), new RegExp(`${count}\\s*Tasks`));
    }
    const boxes = await cards.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().top));
    assert.equal(new Set(boxes).size, 1, 'All four summary cards share the top row');
    assert.ok((await analytics.boundingBox()).y > boxes[0]);
    assert.equal(await page.getByRole('table').count(), 1, 'Task overview remains present');
    passed.push('Four original summary cards and task overview are retained; charts appear below cards');
    const sheet = page.getByRole('region', { name: 'Task workspace', exact: true });
    const taskTable = sheet.getByRole('table', { name: 'Tasks', exact: true });
    assert.equal(await taskTable.locator('tbody tr').count(), 10);
    await sheet.getByRole('checkbox', { name: 'Select TSK-101', exact: true }).check();
    assert.equal(await sheet.getByRole('checkbox', { name: 'Select all tasks on this page' }).getAttribute('aria-checked'), 'mixed');
    await sheet.getByRole('checkbox', { name: 'Select all tasks on this page' }).check();
    assert.equal(await taskTable.locator('tbody tr[data-state="selected"]').count(), 10);
    await sheet.getByRole('button', { name: 'Clear selection' }).click();
    await sheet.getByRole('button', { name: 'Next task page' }).click();
    await sheet.getByRole('checkbox', { name: 'Select TSK-111', exact: true }).waitFor();
    await sheet.getByRole('button', { name: 'Previous task page' }).click();
    await sheet.getByRole('textbox', { name: 'Search tasks' }).fill('TSK-101');
    assert.equal(await taskTable.locator('tbody tr').count(), 1);
    await sheet.getByRole('button', { name: 'Define project scope', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    await page.keyboard.press('Escape');
    await sheet.getByRole('button', { name: 'Clear task search' }).click();
    await sheet.getByRole('tab', { name: 'Completed', exact: true }).click();
    assert.equal(await taskTable.locator('tbody tr').count(), 8);
    await sheet.getByRole('tab', { name: 'All tasks', exact: true }).click();
    await sheet.getByRole('combobox', { name: 'Filter by priority' }).click();
    await page.getByRole('option', { name: 'High', exact: true }).click();
    assert.ok((await taskTable.locator('tbody tr').allTextContents()).every(text => text.includes('High')));
    await sheet.getByRole('combobox', { name: 'Filter by priority' }).click();
    await page.getByRole('option', { name: 'All priorities', exact: true }).click();
    passed.push('Spreadsheet supports 10-row pages, partial/select-all selection, search, status/priority filters, and task detail dialog');

    const schedule = page.getByRole('region', { name: 'Task schedule', exact: true });
    const projects = page.getByRole('region', { name: 'Tasks by project', exact: true });
    const priorities = page.getByRole('region', { name: 'Task priorities', exact: true });
    const workload = page.getByRole('region', { name: 'Team workload', exact: true });
    for (const [region, total] of [[schedule, 38], [projects, 38], [priorities, 38], [workload, 30]]) {
      const summary = region.locator('summary');
      await summary.focus();
      await page.keyboard.press('Enter');
      await region.getByRole('table').waitFor();
      const counts = await region.locator('tbody tr td:last-child').allTextContents();
      assert.equal(counts.reduce((sum, count) => sum + Number(count), 0), total);
      await summary.press('Enter');
      await region.getByRole('table').waitFor({ state: 'detached' });
    }
    passed.push('Keyboard data tables total 38 tasks in schedule/project/priority and 30 open tasks in workload');

    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => { localStorage.setItem('theme', mode); document.documentElement.classList.toggle('dark', mode === 'dark'); }, mode);
      // Wait for theme observer and entrance animation before inspecting the drawing.
      await page.waitForTimeout(1000);
      await page.locator('main').evaluate(node => { node.scrollTop = 0; });
      await page.screenshot({ path: `${out}/desktop-${mode}.png` });
      await sheet.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${out}/spreadsheet-${mode}.png` });
      await schedule.scrollIntoViewIfNeeded();
      const canvas = schedule.locator('canvas').first();
      const box = await canvas.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await schedule.locator('[data-chart] .min-w-32').waitFor({ state: 'visible' });
      assert.match(await schedule.locator('[data-chart] .min-w-32').innerText(), /Tasks/);
      const bars = await projects.locator('canvas').first().boundingBox();
      await page.mouse.move(bars.x + bars.width * 0.6, bars.y + bars.height * 0.18);
      await projects.locator('[data-chart] .min-w-32').waitFor({ state: 'visible' });
      assert.match(await projects.locator('[data-chart] .min-w-32').innerText(), /Brand identity[\s\S]*10/);
      await page.mouse.move(0, 0);
    }
    passed.push('Light/dark chart rendering, crosshair tooltip, and per-bar tooltip work');

    for (const width of [320, 390, 768, 1024, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `No overflow at ${width}px`);
      for (const canvas of await analytics.locator('canvas').all()) {
        const box = await canvas.boundingBox();
        assert.ok(box.width > 100 && box.height > 150);
      }
      if (width === 390) {
        await schedule.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${out}/mobile-dark.png` });
        await sheet.scrollIntoViewIfNeeded();
        const scrollRegion = sheet.getByRole('region', { name: 'Tasks spreadsheet, scroll horizontally for more columns' });
        await scrollRegion.evaluate(node => { node.scrollLeft = node.scrollWidth; });
        assert.ok(await scrollRegion.evaluate(node => node.scrollLeft > 0));
        await scrollRegion.evaluate(node => { node.scrollLeft = 0; });
        await page.screenshot({ path: `${out}/spreadsheet-mobile.png` });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No overflow at 200% zoom');
    for (const region of [schedule, projects, priorities, workload]) {
      const summary = region.locator('summary');
      await summary.scrollIntoViewIfNeeded();
      await summary.focus();
      await summary.press('Enter');
      await region.getByRole('table').waitFor();
      await summary.press('Enter');
    }
    await page.evaluate(() => { document.documentElement.style.zoom = ''; document.documentElement.dir = 'rtl'; });
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `RTL fits ${width}px`);
    }
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.evaluate(() => {
      document.documentElement.dir = 'ltr';
      document.querySelectorAll('.home-analytics [data-slot="card-title"]').forEach(node => { node.textContent = 'Aufgabenverteilung nach Projektverantwortlichen und Teamzugehörigkeit'; });
      document.querySelectorAll('.home-analytics [data-slot="card-description"]').forEach(node => { node.textContent = 'Übersicht aller zugewiesenen Aufgaben einschließlich ausstehender Überprüfungen und projektübergreifender Zusammenarbeit.'; });
    });
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Long German labels wrap at 320px');
    assert.ok(await analytics.locator('[data-slot="card-header"]').evaluateAll(nodes => nodes.every(node => node.scrollHeight <= node.clientHeight + 1)));
    passed.push('200% zoom, RTL at 320/1440px, and expanded German titles/descriptions fit without clipping');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.reload();
    await page.getByRole('region', { name: 'Task analytics', exact: true }).locator('canvas').nth(1).waitFor();
    passed.push('Charts resize from 320–1920px without page overflow and render with reduced motion');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed, errors, screenshots: out }, null, 2));
  } finally {
    await browser.close();
    if (server) server.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
