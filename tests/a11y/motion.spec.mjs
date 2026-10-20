// Motion and shortcuts:
//   2.3.3 / 2.2.2  with reduced motion nothing loops; otherwise every loop can be paused, and the
//                  auto-playing tour has a pause control;
//   2.1.4          single-key shortcuts can be turned off.
import { test, expect } from './axe.mjs';

/** Looping animations running on the page now. */
const loops = () =>
  document
    .getAnimations()
    .filter((a) => a.playState === 'running' && a.effect?.getTiming().iterations === Infinity)
    .map((a) => {
      const target = /** @type {KeyframeEffect} */ (a.effect).target;
      return (
        (target && String(/** @type {Element} */ (target).className)) ||
        /** @type {CSSAnimation} */ (a).animationName ||
        '?'
      );
    });

test.describe('motion', { tag: '@desktop' }, () => {
  test.describe('with reduced motion', () => {
    test.use({ contextOptions: { reducedMotion: 'reduce' } });
    test('nothing loops or moves on its own', async ({ page }) => {
      await page.goto('/');
      await expect.poll(() => page.evaluate(loops)).toEqual([]);
    });
  });

  test('every looping animation can be paused', async ({ page }) => {
    await page.goto('/');
    const before = await page.evaluate(loops);
    test.skip(!before.length, 'nothing loops');
    await page.locator('.v2-side .v2-motion').click();
    await expect.poll(() => page.evaluate(loops)).toEqual([]);
  });

  test('the auto-playing tour has a pause control', async ({ page }) => {
    await page.goto('/');
    await page.locator('#responsibilities').scrollIntoViewIfNeeded();
    await expect(page.locator('#responsibilities').getByRole('button', { name: /pause/i })).toBeAttached();
  });
});

test('single-key shortcuts can be turned off', { tag: '@desktop' }, async ({ page }) => {
  await page.goto('/');
  const palette = page.locator('#c-pal');
  const blur = () => page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
  await blur();
  await page.keyboard.press('/');
  await expect(palette).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(palette).toBeHidden();
  await blur();
  await page.keyboard.press('?');
  await page.locator('#c-keys input[type="checkbox"]').click();
  await page.keyboard.press('Escape');
  await blur();
  await page.keyboard.press('/');
  await expect(palette).toBeHidden();
});
