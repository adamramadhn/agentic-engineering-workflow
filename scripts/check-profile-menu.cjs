const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function loadPlaywright() {
  try { return require('playwright'); } catch {
    for (const entry of fs.readdirSync(path.join(os.homedir(), '.npm/_npx'))) {
      const candidate = path.join(os.homedir(), '.npm/_npx', entry, 'node_modules/playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Install Playwright.');
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || 'http://127.0.0.1:3010';
function contrast(fg, bg) {
  const luminance = rgb => rgb.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
  const [a, b] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (a + .05) / (b + .05);
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const measurements = [];
  const shots = '/tmp/profile-compact-check';
  fs.mkdirSync(shots, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/users`);
    const trigger = () => page.getByRole('button', { name: 'Open profile menu, Onyx, hello@onyx.id', exact: true }).filter({ visible: true });
    const menu = page.getByRole('menu', { name: 'Profile', exact: true });
    const sample = async locator => locator.evaluate(node => {
      const rgb = color => { const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      let parent = node;
      let bg = 'rgba(0, 0, 0, 0)';
      while (parent && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
      const style = getComputedStyle(node);
      return { text: node.textContent, fg: rgb(style.color), bg: rgb(bg), font: style.fontFamily, outline: style.outlineStyle, outlineWidth: style.outlineWidth, outlineColor: rgb(style.outlineColor) };
    });
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
      await page.mouse.move(700, 400);
      await trigger().focus();
      const triggerFocus = await sample(trigger());
      assert.equal(triggerFocus.outline, 'solid');
      assert.equal(triggerFocus.outlineWidth, '2px');
      assert.ok(contrast(triggerFocus.outlineColor, triggerFocus.bg) >= 3);
      const triggerEmail = await sample(trigger().locator('.profile-menu-email'));
      assert.ok(contrast(triggerEmail.fg, triggerEmail.bg) >= 4.5, `${mode} trigger email`);
      await page.keyboard.press('Enter');
      await menu.waitFor();
      const geometry = await menu.evaluate(node => { const s = getComputedStyle(node); return { width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height, background: s.backgroundColor, shadow: s.boxShadow, animation: s.animationName }; });
      assert.equal(geometry.width, 248);
      assert.ok(geometry.height < 150);
      assert.equal(geometry.background, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(18, 18, 21)');
      assert.equal(geometry.shadow, 'none');
      assert.equal(geometry.animation, 'none');
      const email = await sample(menu.locator('.profile-menu-email'));
      email.contrast = Number(contrast(email.fg, email.bg).toFixed(2));
      assert.ok(email.contrast >= 4.5);
      assert.match(email.font, /Geist/);
      await page.keyboard.press('Home');
      const command = menu.getByRole('menuitem', { name: /Open command palette/ });
      await command.focus();
      const item = await sample(command);
      assert.equal(item.outline, 'solid');
      assert.equal(item.outlineWidth, '2px');
      assert.ok(contrast(item.outlineColor, item.bg) >= 3);
      assert.ok(contrast(item.fg, item.bg) >= 4.5);
      assert.equal(await menu.getByRole('menuitem', { name: 'Sign out Demo' }).getAttribute('aria-disabled'), 'true');
      await page.screenshot({ path: `${shots}/${mode}.png` });
      measurements.push({ mode, geometry, emailContrast: email.contrast, itemContrast: Number(contrast(item.fg, item.bg).toFixed(2)) });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Open profile menu'));
    }
    await trigger().focus();
    await page.keyboard.press('Space');
    await menu.waitFor();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await page.getByPlaceholder('Search pages and watched companies...').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Collapse sidebar (Cmd+B)' }).click();
    await trigger().focus();
    await page.keyboard.press('Enter');
    await menu.waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(direction => document.documentElement.dir = direction, direction);
      await trigger().click();
      await menu.waitFor();
      const box = await menu.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 320, JSON.stringify(box));
      assert.ok(box.y >= 0 && box.y + box.height <= 844);
      assert.equal(await menu.evaluate(n => n.scrollWidth > n.clientWidth), false);
      await menu.locator('.profile-menu-email').evaluate(n => n.textContent = 'long.account.name+production@example-enterprise.com');
      assert.equal(await menu.evaluate(n => n.scrollWidth > n.clientWidth), false);
      await page.screenshot({ path: `${shots}/mobile-${direction}.png` });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
    }
    await trigger().click();
    await menu.getByRole('menuitem', { name: /Open command palette/ }).click();
    await page.getByPlaceholder('Search pages and watched companies...').waitFor();
    await page.keyboard.press('Escape');
    // Browser zoom halves the available CSS viewport; unlike CSS zoom it also updates overlay coordinates.
    await page.setViewportSize({ width: 720, height: 500 });
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; document.documentElement.style.fontSize = '200%'; });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await trigger().click();
    await menu.waitFor();
    await page.waitForTimeout(300);
    assert.equal(await menu.evaluate(n => n.scrollWidth > n.clientWidth), false);
    await page.screenshot({ path: `${shots}/zoom.png` });
    const zoomBox = await menu.boundingBox();
    assert.ok(zoomBox.x >= 0 && zoomBox.x + zoomBox.width <= 720 && zoomBox.y >= 0 && zoomBox.y + zoomBox.height <= 500, JSON.stringify(zoomBox));
    await page.keyboard.press('Escape');
    await page.evaluate(() => { document.documentElement.style.fontSize = ''; });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger().click();
    assert.equal(await menu.evaluate(n => getComputedStyle(n).animationName), 'none');
    await page.keyboard.press('Escape');
    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    try {
      const mobile = await touch.newPage();
      await mobile.goto(`${base}/users`);
      await mobile.getByRole('button', { name: 'Toggle sidebar' }).click();
      await mobile.getByRole('button', { name: 'Open profile menu, Onyx, hello@onyx.id' }).filter({ visible: true }).click();
      const touchItem = mobile.getByRole('menuitem', { name: /Open command palette/ });
      assert.ok((await touchItem.boundingBox()).height >= 44);
      await mobile.screenshot({ path: `${shots}/touch.png` });
    } finally { await touch.close(); }
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ measurements, passed: ['compact semantic light/dark surface', 'rendered text/focus contrast', 'keyboard open/escape/focus restoration', 'command palette keyboard and mobile pointer', 'disabled demo sign-out', 'collapsed sidebar', '320px LTR/RTL and long email', '200% text resize and half-size viewport reflow', 'reduced motion', '44px touch row'], errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
