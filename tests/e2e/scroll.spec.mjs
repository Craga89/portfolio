// Scroll-driven touches: the sidebar's lines that fill as each section passes, and on phones the
// header taking over the name as the intro scrolls away. Both follow scroll timelines, so they're
// checked by their computed styles at a scroll position.
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

test('on a phone the header shows the name once the intro has scrolled away @mobile', async ({ page }) => {
  await page.goto('/');
  const opacity = (sel) => page.locator(`.mbar ${sel}`).evaluate((el) => Number(getComputedStyle(el).opacity));
  expect(await opacity('.dom')).toBe(1);
  expect(await opacity('.name')).toBe(0);

  const bottom = await page.locator('.intro h1').evaluate((el) => el.getBoundingClientRect().bottom + window.scrollY);
  await scrollTo(page, bottom + 100);
  await expect.poll(() => opacity('.name')).toBe(1);
  await expect.poll(() => opacity('.dom')).toBe(0);
  // The link's name is still the site's, not read out twice.
  await expect(page.locator('.mbar .brand')).toHaveAccessibleName('craigthompson.dev');
});
