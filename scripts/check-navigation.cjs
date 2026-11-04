const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function loadPlaywright() {
  if (process.env.PLAYWRIGHT_MODULE) return require(process.env.PLAYWRIGHT_MODULE);
  try { return require('playwright'); } catch {
    const cache = path.join(os.homedir(), '.npm/_npx');
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'node_modules/playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Install Playwright or set PLAYWRIGHT_MODULE.');
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || 'http://127.0.0.1:3010';
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const passed = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.getByRole('heading', { name: 'Home', exact: true }).waitFor();
    const nav = page.locator('aside nav:not([aria-label="Admin"])');
    assert.deepEqual(await nav.getByRole('link').allTextContents(), ['Home', 'Ask AI', 'Agent Board', 'Wiki']);
    for (const [name, target] of [['Ask AI', '/ask-ai'], ['Agent Board', '/agent-board'], ['Home', '/']]) {
      await nav.getByRole('link', { name, exact: true }).click();
      await page.waitForURL(url => url.pathname === target && !url.search);
      await page.reload();
      assert.equal(await nav.getByRole('link', { name, exact: true }).getAttribute('aria-current'), 'page');
    }
    await page.locator('aside').getByRole('navigation', { name: 'Admin', exact: true }).getByRole('link', { name: 'Users', exact: true }).click();
    await page.waitForURL('**/users');
    await page.reload();
    await page.getByRole('heading', { name: 'Users', exact: true, level: 1 }).waitFor();
    assert.equal(await page.locator('aside').getByRole('link', { name: 'Users', exact: true }).getAttribute('aria-current'), 'page');
    const usersTable = page.getByRole('table', { name: 'Users', exact: true });
    assert.equal(await usersTable.locator('tbody tr').count(), 10);
    await page.getByRole('checkbox', { name: 'Select Alex Morgan', exact: true }).check();
    assert.equal(await page.getByRole('checkbox', { name: 'Select all users on this page' }).getAttribute('aria-checked'), 'mixed');
    await page.getByRole('checkbox', { name: 'Select all users on this page' }).check();
    assert.equal(await usersTable.locator('tbody tr[data-state="selected"]').count(), 10);
    await page.getByRole('button', { name: 'Clear selection' }).click();
    await page.getByRole('button', { name: 'Next user page' }).click();
    assert.equal(await usersTable.locator('tbody tr').count(), 2);
    await page.getByRole('textbox', { name: 'Search users' }).fill('alex');
    assert.equal(await usersTable.locator('tbody tr').count(), 1);
    await page.getByRole('button', { name: 'Alex Morgan', exact: true }).click();
    await page.getByRole('dialog').waitFor(); await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Clear user search' }).click();
    const roleTrigger = page.getByRole('button', { name: 'Filter by role', exact: true });
    const roleButtonBox = await roleTrigger.boundingBox();
    const searchBox = await page.locator('.users-controls [data-slot="input-group"]').boundingBox();
    assert.ok(roleButtonBox.height >= 34 && roleButtonBox.width >= 80);
    assert.ok(Math.abs(roleButtonBox.height - searchBox.height) < 1, 'Role button must align with search input height');
    await roleTrigger.click();
    const filterMenu = page.locator('.ui-fmc');
    await filterMenu.getByRole('checkbox', { name: 'Admin', exact: true }).click();
    assert.equal(await usersTable.locator('tbody tr').count(), 2);
    await filterMenu.getByRole('checkbox', { name: 'Editor', exact: true }).click();
    assert.equal(await usersTable.locator('tbody tr').count(), 6);
    await filterMenu.getByRole('button', { name: 'Remove Admin', exact: true }).click();
    assert.equal(await usersTable.locator('tbody tr').count(), 4);
    await filterMenu.getByRole('button', { name: 'Clear all', exact: true }).click();
    assert.equal(await usersTable.locator('tbody tr').count(), 10);
    const groupHead = filterMenu.getByRole('button', { expanded: true });
    await groupHead.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await filterMenu.getByRole('checkbox').count(), 0);
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Space');
    assert.equal(await filterMenu.getByRole('checkbox', { name: 'Admin', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await usersTable.locator('tbody tr').count(), 2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Filter by role');
    await roleTrigger.click();
    await filterMenu.getByRole('button', { name: 'Clear all', exact: true }).click();
    await page.keyboard.press('Escape');
    await page.getByRole('textbox', { name: 'Search users' }).fill('no-such-user');
    await page.getByText('No matching users', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Reset filters' }).click();
    for (const [view, count] of [['Active', 8], ['Invited', 2], ['Inactive', 2], ['All users', 10]]) {
      await page.getByRole('tab', { name: view, exact: true }).click();
      assert.equal(await usersTable.locator('tbody tr').count(), count);
    }
    const sheetStyle = await usersTable.evaluate(table => ({ font: getComputedStyle(table).fontFamily, rowHeight: table.querySelector('tbody tr').getBoundingClientRect().height }));
    assert.match(sheetStyle.font, /Geist/);
    assert.ok(sheetStyle.rowHeight >= 44 && sheetStyle.rowHeight <= 46);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.setViewportSize({ width: 1440, height: 1000 });
    const shots = '/tmp/admin-users-check'; fs.mkdirSync(shots, { recursive: true });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
      const tableSurface = await page.locator('.users-sheet').evaluate(node => {
        const sample = document.createElement('span');
        sample.style.backgroundColor = 'var(--card)';
        node.append(sample);
        const expected = getComputedStyle(sample).backgroundColor;
        sample.remove();
        return { actual: getComputedStyle(node).backgroundColor, expected };
      });
      assert.equal(tableSurface.actual, tableSurface.expected, 'Users table must retain the application card color');
      await page.screenshot({ path: `${shots}/users-${mode}.png` });
      await roleTrigger.click();
      const wrapperStyle = await page.locator('.users-role-popover').evaluate(node => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, shadow: style.boxShadow, padding: style.padding, ring: node.classList.contains('ring-1') };
      });
      assert.deepEqual(wrapperStyle, { background: 'rgba(0, 0, 0, 0)', shadow: 'none', padding: '0px', ring: false }, 'Only FilterMenu should draw a card, not the popover wrapper');
      const filterBorder = await filterMenu.evaluate(node => {
        const style = getComputedStyle(node);
        return { width: style.borderTopWidth, style: style.borderTopStyle, color: style.borderTopColor, surface: style.backgroundColor };
      });
      assert.equal(filterBorder.width, '1px');
      assert.equal(filterBorder.style, 'solid');
      assert.notEqual(filterBorder.color, filterBorder.surface);
      await filterMenu.getByRole('checkbox', { name: 'Admin', exact: true }).click();
      await filterMenu.getByRole('checkbox', { name: 'Editor', exact: true }).click();
      await page.waitForTimeout(450);
      await page.screenshot({ path: `${shots}/role-filter-${mode}.png` });
      await filterMenu.getByRole('button', { name: 'Clear all', exact: true }).click();
      await page.keyboard.press('Escape');
    }
    await page.setViewportSize({ width: 320, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const userScroll = page.getByRole('region', { name: 'Users spreadsheet, scroll horizontally for more columns' });
    await userScroll.evaluate(node => { node.scrollLeft = node.scrollWidth; });
    assert.ok(await userScroll.evaluate(node => node.scrollLeft > 0));
    await userScroll.evaluate(node => { node.scrollLeft = 0; });
    await roleTrigger.click();
    await page.waitForTimeout(400);
    const popupBox = await page.locator('.users-role-popover').boundingBox();
    assert.ok(popupBox.x >= 0 && popupBox.x + popupBox.width <= 320);
    await page.screenshot({ path: `${shots}/role-filter-mobile.png` });
    await page.keyboard.press('Escape');
    await page.screenshot({ path: `${shots}/users-mobile.png` });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await page.getByRole('navigation', { name: 'Admin', exact: true }).filter({ visible: true }).getByRole('link', { name: 'Users', exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await nav.getByRole('link', { name: 'Home', exact: true }).click();
    await page.getByRole('heading', { name: 'Home', exact: true }).waitFor();
    assert.equal(await page.getByRole('heading', { name: 'Deadlines', exact: true }).count(), 0);
    assert.equal(await page.getByRole('heading', { name: 'Activity', exact: true }).count(), 0);
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Search pages and watched companies...').fill('Users');
    await page.getByRole('option', { name: 'Users', exact: true }).click();
    await page.waitForURL('**/users');
    passed.push('Admin Users: direct route, active link, table selection/search/role/pagination/details, mobile scroll and command palette; Home Deadlines/Activity removed');
    await nav.getByRole('link', { name: 'Ask AI', exact: true }).click();
    await page.waitForURL('**/ask-ai');
    await nav.getByRole('link', { name: 'Agent Board', exact: true }).click();
    await page.waitForURL('**/agent-board');
    await page.goBack(); await page.getByRole('heading', { name: 'What should we work on?' }).waitFor();
    assert.equal(new URL(page.url()).pathname, '/ask-ai');
    await page.goForward(); await page.getByRole('heading', { name: 'Agent Board', exact: true }).waitFor();
    passed.push('Sidebar has only Home, Ask AI, Agent Board; path links, direct refresh, back/forward work');

    await page.locator('aside').getByRole('link', { name: 'Show all', exact: true }).click();
    await page.waitForURL('**/watching');
    await page.getByRole('heading', { name: 'Watching', exact: true }).waitFor();
    assert.equal(await page.locator('main section[id]:visible').count(), 4);
    await page.locator('aside').getByRole('link', { name: 'Canguard', exact: true }).click();
    await page.waitForURL('**/watching#canguard');
    assert.equal(await page.locator('#canguard').isVisible(), true);
    await page.keyboard.press('Control+k');
    await page.getByPlaceholder('Search pages and watched companies...').fill('Ask AI');
    await page.getByRole('option', { name: 'Ask AI', exact: true }).click();
    await page.waitForURL('**/ask-ai');
    passed.push('Watching Show all/company anchors and command palette use real paths');

    for (const removed of ['/login', '/register', '/forgot-password', '/components', '/components/button', '/404', '/500', '/maintenance', '/states/agent-board', '/states/worktree', '/metrics', '/customers', '/reports', '/alerts', '/connect', '/settings']) {
      const response = await page.request.get(`${base}${removed}`);
      assert.equal(response.status(), 404, `${removed} must be removed`);
    }
    passed.push('All removed page paths return 404');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    const mobileNav = page.locator('nav:visible').filter({ has: page.getByRole('link', { name: 'Home', exact: true }) });
    assert.deepEqual(await mobileNav.getByRole('link').allTextContents(), ['Home', 'Ask AI', 'Agent Board', 'Wiki']);
    await mobileNav.getByRole('link', { name: 'Agent Board', exact: true }).click();
    await page.waitForURL('**/agent-board');
    await page.getByRole('heading', { name: 'Agent Board', exact: true }).waitFor();
    assert.equal(new URL(page.url()).search, '');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    passed.push('Mobile drawer keeps the same reduced navigation and uses clean paths');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed, errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
