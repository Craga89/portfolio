// Scroll-driven touches: the sidebar's lines that fill as each section passes, and the section
// headings typing themselves out. Both follow scroll timelines, so they're checked by their
// computed styles at a scroll position.
import { test, expect } from '../fixtures.mjs';

/** @param {import('@playwright/test').Page} page @param {number} top */
const scrollTo = (page, top) => page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), top);

test("the explorer's lines fill as their sections pass @desktop", async ({ page }) => {
  await page.goto('/');
  const fill = (id) =>
    page.locator(`.tree a[data-spy="${id}"] .fill`).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);
  await expect.poll(() => fill('stack')).toBe(0);

  const top = await page.locator('#stack').evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollTo(page, top);
  await expect.poll(() => fill('stack')).toBeGreaterThan(0.2);
  await expect.poll(() => fill('stack')).toBeLessThan(1);
  await expect.poll(() => fill('career')).toBe(1);
  await expect.poll(() => fill('contact')).toBe(0);
});

test('section headings type out over the scroll, a character at a time @desktop', async ({ page }) => {
  await page.goto('/');
  const h = page.locator('#stack .c-cmd');
  const text = (await h.textContent())?.trim() ?? '';
  expect(await h.evaluate((el) => el.style.getPropertyValue('--steps'))).toBe(String(text.length));

  // With the heading a little way up from the bottom of the screen, it's part-typed.
  const { top, vh } = await h.evaluate((el) => ({
    top: el.getBoundingClientRect().top + window.scrollY,
    vh: innerHeight,
  }));
  await scrollTo(page, top - vh * 0.85);
  const clip = await h.evaluate((el) => getComputedStyle(el).clipPath);
  expect(clip).not.toBe('none');
  expect(clip).not.toMatch(/inset\(0(px)?\)$/);
});
