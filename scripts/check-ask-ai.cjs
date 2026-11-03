// Run against the local dev service; mirrors the existing browser checks.
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
const output = process.env.SCREENSHOT_DIR || path.join(os.tmpdir(), 'ask-ai-check');
(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const errors = [];
  const results = [];
  try {
    fs.mkdirSync(output, { recursive: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${process.env.APP_URL || 'http://127.0.0.1:3010'}/ask-ai`);
    await page.getByRole('heading', { name: 'What should we work on?' }).waitFor();
    await page.evaluate(() => localStorage.setItem('theme', 'dark'));
    await page.reload();
    await page.getByRole('heading', { name: 'What should we work on?' }).waitFor();
    assert.equal(await page.locator('html').evaluate(el => el.classList.contains('dark')), true);
    const input = page.getByRole('textbox', { name: 'Message Orchestrator' });
    const send = page.getByRole('button', { name: 'Send message', exact: true });
    assert.equal(await send.isDisabled(), true);
    await input.fill('Check system health status');
    await input.press('Enter');
    const assistant = page.getByRole('article', { name: 'Orchestrator response' }).first();
    await assistant.locator('.t-think').waitFor();
    assert.equal(await assistant.locator('.t-matrix i').count(), 16);
    await page.getByText('Checking sample data', { exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(output, 'thinking-dark.png') });
    await assistant.locator('.t-stream-w').first().waitFor({ timeout: 15000 });
    assert.equal(await assistant.getByRole('button', { name: /Worked for/ }).getAttribute('aria-expanded'), 'false');
    const initialWords = await assistant.locator('.t-stream-w').count();
    await page.waitForFunction(n => document.querySelectorAll('.t-stream-w').length > n + 5, initialWords);
    await assistant.getByRole('button', { name: 'Regenerate', exact: true }).waitFor({ timeout: 20000 });
    assert.equal(await page.getByRole('button', { name: 'Stop response' }).count(), 0);
    await assistant.getByRole('button', { name: /Worked for/ }).click();
    await assistant.getByText('Ready', { exact: true }).waitFor();
    await assistant.getByRole('button', { name: 'Data analyst', exact: true }).click();
    await assistant.getByText(/No live agent was run/).waitFor();
    const composer = await page.locator('.ask-ai-composer').boundingBox();
    assert.ok(composer.y + composer.height <= 1000 && composer.y > 600);
    await page.screenshot({ path: path.join(output, 'completed-dark.png') });
    results.push('Send → thinking states + matrix → reasoning → word streaming → completed actions');

    await input.fill('Second message'); await send.click();
    await page.getByRole('button', { name: 'Stop response' }).click();
    await page.getByText('Response stopped. You can send another message.').waitFor();
    assert.equal(await send.isDisabled(), true);
    const usersBefore = await page.locator('.ask-ai-user-message').allTextContents();
    await assistant.getByRole('button', { name: 'Regenerate', exact: true }).click();
    await page.getByRole('button', { name: 'Stop response' }).click();
    assert.deepEqual(await page.locator('.ask-ai-user-message').allTextContents(), usersBefore);
    results.push('Stop cancels a run; regenerating an earlier answer preserves later turns');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await input.fill('Reduced motion test'); await send.click();
    assert.equal(await page.locator('.t-matrix i').first().evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.getByRole('button', { name: 'Stop response' }).waitFor({ state: 'hidden', timeout: 12000 });
    results.push('Reduced motion disables loader/blur/reveal animations and completes output');

    await page.locator('input[type=file]').setInputFiles({ name: 'context.txt', mimeType: 'text/plain', buffer: Buffer.from('Test file context') });
    await page.getByRole('button', { name: 'Remove attachment' }).waitFor();
    await input.fill('Use this context'); await send.click();
    await page.getByRole('button', { name: 'Stop response' }).waitFor({ state: 'hidden', timeout: 12000 });
    await page.getByText(/doesn't analyze uploaded files yet/).waitFor();
    results.push('Text context attachment and honest demo fallback');

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.locator('.ask-ai-composer').boundingBox();
    assert.ok(mobile.x >= 0 && mobile.x + mobile.width <= 390);
    assert.ok(mobile.y + mobile.height < 844);
    assert.equal(await page.locator('.ask-ai').evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await page.screenshot({ path: path.join(output, 'mobile-dark.png') });
    await page.evaluate(() => localStorage.setItem('theme', 'light'));
    await page.reload();
    await page.getByRole('heading', { name: 'What should we work on?' }).waitFor();
    await page.screenshot({ path: path.join(output, 'mobile-light.png') });
    results.push('Mobile dark/light layout, no horizontal overflow, composer stays inside viewport');
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ results, errors, screenshots: output }, null, 2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
