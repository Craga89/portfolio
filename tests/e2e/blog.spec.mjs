// The blog: the home page's list, "show all", the index and every post page.
import { readdirSync } from 'node:fs';
import { test, expect } from '../fixtures.mjs';

const POSTS = readdirSync(new URL('../../src/content/blog/', import.meta.url))
  .filter((f) => f.endsWith('.md'))
  .map((f) => f.replace(/\.md$/, ''));

test('the home page lists eight posts, and "show all" shows the rest', async ({ page, isMobile }) => {
  await page.goto('/');
  const items = page.getByRole('list', { name: 'Blog posts, newest first' }).getByRole('listitem');
  await expect(items).toHaveCount(8);
  if (!isMobile) await expect(page.locator('nav[aria-label="Main"] a[href="#blog"]')).toHaveCount(1);
  await page.locator('#blog [data-blog-more]').click();
  await expect(items).toHaveCount(POSTS.length);
});

for (const path of ['blog/', ...POSTS.map((slug) => `blog/${slug}/`)]) {
  test(`${path} loads, with no sideways scrolling or broken images`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).not.toBeEmpty();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
    const images = page.locator('.post img');
    for (const img of await images.all()) {
      await img.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          img.evaluate(
            (i) => /** @type {HTMLImageElement} */ (i).complete && /** @type {HTMLImageElement} */ (i).naturalWidth > 0,
          ),
        )
        .toBe(true);
    }
  });
}
