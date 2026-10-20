// Between pages: cross-document view transitions (none with reduced motion), valid speculation
// rules, the reading-progress bar; and the CV and 404 pages.
import { test, expect } from '../fixtures.mjs';

/**
 * Open the blog index, follow the first post, and report whether that navigation had a view transition.
 * @param {import('@playwright/test').Page} page
 */
async function followFirstPost(page) {
  await page.addInitScript(() =>
    addEventListener('pagereveal', (e) => sessionStorage.setItem('vt', /** @type {any} */ (e).viewTransition ? 'yes' : 'no')),
  );
  await page.goto('blog/');
  await page.locator('.sp-bl a').first().click();
  await page.waitForURL(/\/blog\/[\w-]+\/$/);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('vt'))).not.toBeNull();
  return page.evaluate(() => sessionStorage.getItem('vt'));
}

/** Whether a cross-document view transition rule applies to the page, given its media queries. */
function viewTransitionsOn() {
  /** @param {CSSRule} rule @returns {boolean} */
  const on = (rule) =>
    rule instanceof CSSMediaRule
      ? matchMedia(rule.conditionText).matches && [...rule.cssRules].some(on)
      : rule.constructor.name === 'CSSViewTransitionRule';
  return [...document.styleSheets].some((sheet) => [...sheet.cssRules].some(on));
}

test.describe('between pages', { tag: '@desktop' }, () => {
  test('a view transition, valid speculation rules, and a reading-progress bar that moves', async ({ page, context }) => {
    const cdp = await context.newCDPSession(page);
    /** @type {string[]} */
    const rules = [];
    await cdp.send('Preload.enable');
    cdp.on('Preload.ruleSetUpdated', (e) => rules.push(e.ruleSet.errorType || 'ok'));

    expect(await followFirstPost(page)).toBe('yes');
    expect(await page.evaluate(viewTransitionsOn)).toBe(true);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((r) => r === 'ok')).toBe(true);

    await page.mouse.wheel(0, 1200);
    const progress = () => page.evaluate(() => new DOMMatrix(getComputedStyle(/** @type {Element} */ (document.querySelector('.sp-prog'))).transform).a);
    await expect.poll(progress).toBeGreaterThan(0.05);
    expect(await progress()).toBeLessThan(1);
  });

  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });
    test('no view transition', async ({ page }) => {
      expect(await followFirstPost(page)).toBe('no');
      expect(await page.evaluate(viewTransitionsOn)).toBe(false);
    });
  });

  test('the language menu is a styled list where the browser supports it', async ({ page }) => {
    await page.goto('/');
    const select = page.locator('.v2-side .v2-lang-s');
    expect(await select.evaluate((x) => getComputedStyle(x).appearance)).toBe('base-select');
    await select.click();
    await expect.poll(() => select.evaluate((x) => x.matches(':open'))).toBe(true);
    await page.keyboard.press('Escape');
  });
});

test('the plain CV renders', async ({ page }) => {
  await page.goto('cv/');
  await expect(page.locator('body')).toContainText(/experience/i);
});

test.describe('a missing page', () => {
  test.use({ expectedErrors: [/status of 404/] });
  test('gets the 404 page', async ({ page }) => {
    const response = await page.goto('this-page-does-not-exist');
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).not.toBeEmpty();
  });
});
