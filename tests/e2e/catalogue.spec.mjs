// The component catalogue at /storybook: it lists the stories, renders a component with the site's
// styles, and stays out of search engines and the sitemap.
import { readFileSync } from 'node:fs';
import { test, expect } from '../fixtures.mjs';

test('the catalogue lists the stories and renders them, without errors @desktop', async ({ page }) => {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('/storybook/');
  await expect(page).toHaveTitle(/craigthompson\.dev components/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await page.goto('/storybook/dashboard/sections/career/career/');
  await expect(page.locator('main')).toContainText('Head of Engineering');
  // The site's tokens apply: the section's text isn't the browser's default black.
  const color = await page
    .locator('main h3')
    .first()
    .evaluate((el) => getComputedStyle(el).color);
  expect(color).not.toBe('rgb(0, 0, 0)');

  await page.goto('/storybook/dashboard/figures/pipeline/pipeline/');
  await expect(page.locator('main')).toContainText('sign-in request');
  expect(errors).toEqual([]);
});

test('the catalogue is not in the sitemap @desktop', async () => {
  const sitemap = readFileSync(new URL('../../site/sitemap.xml', import.meta.url), 'utf8');
  expect(sitemap).not.toContain('/storybook/');
});
