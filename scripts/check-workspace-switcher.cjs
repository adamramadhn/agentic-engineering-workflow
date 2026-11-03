const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
function loadPlaywright() {
  try { return require('playwright'); } catch {
    const cache = path.join(os.homedir(), '.npm/_npx');
    for (const entry of fs.readdirSync(cache)) {
      const candidate = path.join(cache, entry, 'node_modules/playwright');
      if (fs.existsSync(candidate)) return require(candidate);
    }
    throw new Error('Install Playwright.');
  }
}
const { chromium } = loadPlaywright();
const base = process.env.APP_URL || 'http://127.0.0.1:3010';
function luminance(rgb) {
  const c = rgb.slice(0, 3).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; });
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
}
function contrast(fg, bg) {
  const colors = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (colors[0] + .05) / (colors[1] + .05);
}
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const measurements = [];
  const shots = '/tmp/workspace-compact-check';
  fs.mkdirSync(shots, { recursive: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/users`);
    const trigger = () => page.getByRole('button', { name: /Switch workspace, current/ }).filter({ visible: true });
    const menu = page.getByRole('menu');
    for (const mode of ['light', 'dark']) {
      await page.evaluate(mode => document.documentElement.classList.toggle('dark', mode === 'dark'), mode);
      await trigger().focus();
      await page.keyboard.press('Enter');
      await menu.waitFor();
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(300);
      const measured = await menu.evaluate(node => {
        const rgb = color => color.match(/[\d.]+/g).map(Number);
        const style = getComputedStyle(node);
        const samples = [node.querySelector('[data-slot="dropdown-menu-label"]'), ...node.querySelectorAll('.workspace-switcher-details > span')].map(el => {
          let parent = el;
          let bg = 'rgba(0, 0, 0, 0)';
          while (parent && bg === 'rgba(0, 0, 0, 0)') { bg = getComputedStyle(parent).backgroundColor; parent = parent.parentElement; }
          return { text: el.textContent, fg: rgb(getComputedStyle(el).color), bg: rgb(bg) };
        });
        const focused = document.activeElement;
        const focusStyle = getComputedStyle(focused);
        return {
          width: node.getBoundingClientRect().width,
          height: node.getBoundingClientRect().height,
          background: style.backgroundColor,
          font: style.fontFamily,
          samples,
          focus: { role: focused.getAttribute('role'), outline: focusStyle.outlineStyle, width: focusStyle.outlineWidth, color: rgb(focusStyle.outlineColor), bg: rgb(focusStyle.backgroundColor) },
        };
      });
      assert.equal(measured.width, 248);
      assert.ok(measured.height < 230, `compact menu height: ${measured.height}`);
      assert.equal(measured.background, mode === 'light' ? 'rgb(255, 255, 255)' : 'rgb(18, 18, 21)');
      assert.match(measured.font, /Geist/);
      for (const sample of measured.samples) {
        sample.ratio = Number(contrast(sample.fg, sample.bg).toFixed(2));
        assert.ok(sample.ratio >= 4.5, `${mode} ${sample.text}: ${sample.ratio}`);
      }
      assert.equal(measured.focus.role, 'menuitemradio');
      assert.equal(measured.focus.outline, 'solid');
      assert.equal(measured.focus.width, '2px');
      assert.ok(contrast(measured.focus.color, measured.focus.bg) >= 3);
      measurements.push({ mode, ...measured });
      await page.screenshot({ path: `${shots}/${mode}.png` });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
      await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label')?.startsWith('Switch workspace'));
    }
    await trigger().focus();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitemradio', { name: 'Acme Production Pro Plan' }).focus();
    await page.keyboard.press('Enter');
    await menu.waitFor({ state: 'hidden' });
    assert.match(await trigger().getAttribute('aria-label'), /Acme Production/);
    await trigger().click();
    assert.equal(await page.getByRole('menuitemradio', { name: 'Acme Production Pro Plan' }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('menuitem', { name: 'Create workspace Demo' }).getAttribute('aria-disabled'), 'true');
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Collapse sidebar (Cmd+B)' }).click();
    await trigger().click();
    await menu.waitFor();
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    await page.setViewportSize({ width: 320, height: 844 });
    await page.getByRole('button', { name: 'Toggle sidebar' }).click();
    for (const direction of ['ltr', 'rtl']) {
      await page.evaluate(direction => document.documentElement.dir = direction, direction);
      await trigger().click();
      const box = await menu.boundingBox();
      assert.ok(box.x >= 0 && box.x + box.width <= 320);
      assert.equal(await menu.evaluate(n => n.scrollWidth > n.clientWidth), false);
      await page.screenshot({ path: `${shots}/mobile-${direction}.png` });
      await page.keyboard.press('Escape');
      await menu.waitFor({ state: 'hidden' });
    }
    await page.evaluate(() => { document.documentElement.dir = 'ltr'; });
    await page.getByRole('button', { name: 'Close menu' }).click();
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => { document.documentElement.style.zoom = '2'; });
    await trigger().click();
    assert.equal(await menu.evaluate(n => n.scrollWidth > n.clientWidth), false);
    await page.keyboard.press('Escape');
    await menu.waitFor({ state: 'hidden' });
    await page.evaluate(() => { document.documentElement.style.zoom = ''; });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await trigger().click();
    assert.equal(await menu.evaluate(n => getComputedStyle(n).animationName), 'none');
    await page.keyboard.press('Escape');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ measurements, passed: ['compact dimensions', 'light/dark semantic surfaces', 'text and focus contrast', 'keyboard selection and focus restoration', 'active workspace', 'unavailable create action', 'collapsed sidebar', '320px LTR/RTL', '200% zoom', 'reduced motion'], errors }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
