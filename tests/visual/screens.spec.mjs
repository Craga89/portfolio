// Screenshots of the built site compared with the baselines (the visual-baselines branch), to
// catch unintended visual changes. A commit with "[visual]" in its message accepts the new look.
//   pnpm exec playwright test --project=visual                      compare
//   pnpm exec playwright test --project=visual --update-snapshots   accept the current look
import { test, expect, addStyle } from '../fixtures.mjs';

// Things that change on their own (the clock, the build stamp) or float over content (the chat bar).
const STEADY =
  '[data-clock],[data-built],[data-chat]{visibility:hidden!important} html{scroll-behavior:auto!important}';

/**
 * @typedef {{ name: string, width: number, height: number, scheme: 'dark' | 'light', mobile?: boolean, path?: string, el?: string, full?: boolean }} View
 * @type {View[]}
 */
const VIEWS = [
  { name: 'home-desktop-dark', width: 1440, height: 900, scheme: 'dark' },
  { name: 'home-desktop-light', width: 1440, height: 900, scheme: 'light' },
  { name: 'home-mobile-dark', width: 390, height: 844, scheme: 'dark', mobile: true },
  { name: 'home-mobile-light', width: 390, height: 844, scheme: 'light', mobile: true },
  { name: 'home-fold', width: 616, height: 816, scheme: 'light', mobile: true },
  { name: 'career', width: 1440, height: 900, scheme: 'dark', el: '#career' },
  { name: 'responsibilities', width: 1440, height: 900, scheme: 'dark', el: '#responsibilities' },
  { name: 'case-studies', width: 1440, height: 900, scheme: 'light', el: '#case-studies' },
  { name: 'stack', width: 1440, height: 900, scheme: 'dark', el: '#stack' },
  { name: 'faq', width: 1440, height: 900, scheme: 'light', el: '#faq' },
  { name: 'blog', width: 1440, height: 900, scheme: 'dark', el: '#blog' },
  { name: 'cv', width: 1100, height: 900, scheme: 'light', path: 'cv/', full: true },
  {
    name: 'blog-post',
    width: 1100,
    height: 900,
    scheme: 'light',
    path: 'blog/durandal-and-webpack-part-2-composition/',
  },
  { name: 'blog-index-mobile', width: 390, height: 844, scheme: 'dark', path: 'blog/', mobile: true },
];

for (const v of VIEWS) {
  test.describe(v.name, () => {
    test.use({
      viewport: { width: v.width, height: v.height },
      colorScheme: v.scheme,
      isMobile: !!v.mobile,
      hasTouch: !!v.mobile,
    });

    test(v.name, async ({ page }) => {
      await page.goto(v.path || '/');
      await addStyle(page, STEADY);
      await page.evaluate(() => document.fonts.ready);
      if (v.el) {
        await page.locator(v.el).scrollIntoViewIfNeeded();
        await expect(page.locator(v.el)).toHaveScreenshot(v.name + '.png');
      } else {
        await expect(page).toHaveScreenshot(v.name + '.png', { fullPage: !!v.full });
      }
    });
  });
}
