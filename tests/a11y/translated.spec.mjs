// axe on translated pages (on-device translation, with the stand-in translator): German, and
// Arabic for right-to-left.
import { test, expect, renderAll, settle, translated } from './axe.mjs';

const CASES = /** @type {const} */ ([
  { locale: 'de-DE', colorScheme: 'dark' },
  { locale: 'ar', colorScheme: 'light' },
]);

for (const { locale, colorScheme } of CASES) {
  test.describe(`translated (${locale}, ${colorScheme})`, () => {
    test.use({ translator: 'stub', locale, colorScheme });

    test('the offer, the translated home page, its banner and two case studies', async ({ page, axe }) => {
      await page.goto('/');
      await settle(page);
      await expect(page.locator('.tr-offer')).toBeVisible();
      await axe('translation offer', '.tr-offer');
      await page.locator('.tr-offer .tr-go').click();
      await translated(page);
      await renderAll(page);
      await axe('home translated');
      await axe('translation banner', '.tr-bar');
      const tabs = page.locator('#case-studies [role="tab"]');
      for (const i of [3, 12]) {
        if (i >= (await tabs.count())) continue;
        await tabs.nth(i).click();
        await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
        await page.locator('#case-studies [role="tablist"]').evaluate((t) => t.scrollIntoView({ block: 'nearest' }));
        await axe(`case study tab ${i + 1} translated`, '#case-studies');
      }
    });

    test('the plain CV, translated', async ({ page, axe }) => {
      await page.goto('cv/');
      await settle(page);
      await page.locator('.tr-offer .tr-go').click();
      await translated(page);
      await axe('plain CV translated');
    });
  });
}
