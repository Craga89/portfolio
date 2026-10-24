// The stack section: each area folds to one line and opens on tap; a search shows
// every match, folded or not.
import { test, expect } from '../fixtures.mjs';

test('stack areas fold to one line each, open on tap, and a search shows matches', async ({ page, isMobile }) => {
  await page.goto('/');
  const stack = page.locator('#stack');
  const height = await stack.evaluate((el) => el.getBoundingClientRect().height);
  expect(height).toBeLessThan(1000);
  const tools = stack.locator('details.row li');
  await expect(tools.filter({ visible: true })).toHaveCount(0);

  const area = stack.locator('details.row').first();
  const summary = area.locator('summary');
  await summary.scrollIntoViewIfNeeded();
  await (isMobile ? summary.tap() : summary.click());
  await expect(area).toHaveJSProperty('open', true);
  await expect(area.locator('li').first()).toBeVisible();

  await stack.locator('[data-stack-q]').fill('aws');
  await expect.poll(() => tools.filter({ visible: true }).count()).toBeGreaterThan(3);
  await expect(stack.locator('mark').first()).toBeVisible();
});
