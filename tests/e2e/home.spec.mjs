// The home page: its interactive sections, theme, ask.sh, and the page without JavaScript.
import { test, expect } from '../fixtures.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
});

test('case-study tabs switch panels', { tag: '@desktop' }, async ({ page }) => {
  const tabs = page.locator('#case-studies').getByRole('tab');
  expect(await tabs.count()).toBeGreaterThanOrEqual(8);
  await tabs.nth(2).click();
  // Tab switches cross-fade with a view transition, so the new state lands a frame or two later.
  await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
});

test('stack search highlights matches and keeps focus while typing', async ({ page }) => {
  const input = page.locator('#stack input');
  await input.click();
  await input.pressSequentially('aws', { delay: 20 });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('aws');
  await expect(page.locator('#stack mark').first()).toBeVisible();
});

test('responsibilities tour jumps to a segment, and stays there', { tag: '@desktop' }, async ({ page }) => {
  const segs = page.locator('#r-deck').getByRole('tab');
  await expect(segs).toHaveCount(12);
  await segs.nth(4).click();
  await expect(segs.nth(4)).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#rp-aiproc')).toBeVisible();
  // Picking a file stops the tour, so it doesn't move on by itself.
  await expect(page.locator('#r-deck')).not.toHaveAttribute('data-playing');
});

test('the sidebar scrolls to a section and marks it current', { tag: '@desktop' }, async ({ page }) => {
  const link = page.locator('nav[aria-label="Main"] a[href="#faq"]');
  await link.click();
  await expect(link).toHaveAttribute('aria-current', 'true');
  // Scrolled so the section starts near the top of the window.
  await expect
    .poll(() => page.locator('#faq').evaluate((el) => Math.round(el.getBoundingClientRect().top)))
    .toBeGreaterThanOrEqual(0);
  await expect
    .poll(() => page.locator('#faq').evaluate((el) => Math.round(el.getBoundingClientRect().top)))
    .toBeLessThan(200);
});

test('the theme toggles and is remembered', { tag: '@desktop' }, async ({ page }) => {
  const isLight = () => page.evaluate(() => document.documentElement.dataset.theme === 'light');
  const wasLight = await isLight();
  await page.locator('aside [data-theme-toggle]').click();
  await expect.poll(isLight).toBe(!wasLight);
  await page.reload();
  await expect.poll(isLight).toBe(!wasLight);
});

test('ask.sh answers from the site when the AI service is unavailable', async ({ page }) => {
  const field = page.locator('#c-ask-field');
  await field.fill('Has he been through an acquisition?');
  await field.press('Enter');
  await expect(page.locator('#ask [data-ask-log]')).toContainText(/acqui/i);
  await expect(page.locator('#ask [data-ask-log] a').first()).toBeVisible();
  await expect(field).toHaveValue('');
});

test('no sideways scrolling', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('the content is all there', async ({ page }) => {
    const text = await page.locator('main').evaluate((el) => el.textContent || '');
    expect(text).toContain('Craig Michael Thompson');
    expect(text).toContain('hiring.md');
    expect(text).toContain('monorepo');
  });
});

test('the mobile menu has the profile links', { tag: '@mobile' }, async ({ page }) => {
  await page.locator('#v2-menu summary').click();
  const links = page.locator('#v2-menu').getByRole('group', { name: 'Contact and CV' }).getByRole('link');
  await expect(links.first()).toBeVisible();
  await expect(links.filter({ hasText: 'github' })).toBeVisible();
});
