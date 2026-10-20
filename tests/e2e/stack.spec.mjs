// The stack section: each area folds to one line and opens on tap; a search shows
// every match, folded or not.
import { test, expect } from '../fixtures.mjs';

test('stack areas fold to one line each, open on tap, and a search shows matches', async ({ page, isMobile }) => {
  await page.goto('/');
  const stack = page.locator('#stack');
  const height = await stack.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(1000);
  await expect(stack.locator('.c-sq-hit').filter({ visible: true })).toHaveCount(0);

  const toggle = stack.locator('.c-sq-tog').first();
  await toggle.scrollIntoViewIfNeeded();
  await (isMobile ? toggle.tap() : toggle.click());
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(stack.locator('.c-sq-row .c-sq-hit').first()).toBeVisible();

  await page.locator('.c-sq-in').fill('aws');
  await expect.poll(() => stack.locator('.c-sq-hit').filter({ visible: true }).count()).toBeGreaterThan(3);
});
