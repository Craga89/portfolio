// axe across every page state that shows different content, in both themes.
import { test, expect, settle, ANSWER } from './axe.mjs';

for (const colorScheme of /** @type {const} */ (['dark', 'light'])) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test.describe('home page', () => {
      test.beforeEach(async ({ page, services }) => {
        services.ask = ANSWER;
        await page.goto('/');
        await settle(page);
      });

      test('the whole page, then every FAQ answer and file open', async ({ page, axe }) => {
        await axe('home');
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
        await axe('all details open', '#faq');
      });

      test('every responsibilities tab', async ({ page, axe }) => {
        test.setTimeout(180_000);
        const segs = page.locator('#r-deck').getByRole('tab');
        const n = await segs.count();
        for (let i = 0; i < n; i++) {
          await segs.nth(i).click();
          await expect(segs.nth(i)).toHaveAttribute('aria-selected', 'true');
          await axe(`responsibilities tab ${i + 1}`, '#responsibilities');
        }
      });

      test('every case-study tab', async ({ page, axe }) => {
        test.setTimeout(180_000);
        const tabs = page.locator('#case-studies [role="tab"]');
        const n = await tabs.count();
        for (let i = 0; i < n; i++) {
          await tabs.nth(i).click();
          await expect(tabs.nth(i)).toHaveAttribute('aria-selected', 'true');
          // Bring the tabs back into view below the phone header, as a person would see them.
          await page.locator('#case-studies [role="tablist"]').evaluate((t) => t.scrollIntoView({ block: 'nearest' }));
          await axe(`case study tab ${i + 1}`, '#case-studies');
        }
      });

      test('a jargon toggletip, open', async ({ page, axe }) => {
        const term = page.locator('.c-term').first();
        await term.scrollIntoViewIfNeeded();
        await term.click();
        await axe('toggletip open');
        await page.keyboard.press('Escape');
      });

      test('the mobile menu, open', { tag: '@mobile' }, async ({ page, axe }) => {
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('#v2-menu summary').click();
        await expect(page.locator('#v2-menu')).toHaveAttribute('open', '');
        await axe('mobile menu open', '#c-hdr');
      });

      test('the command palette and the keyboard shortcuts', { tag: '@desktop' }, async ({ page, axe }) => {
        await page.keyboard.press('Control+k');
        await expect(page.locator('#c-pal')).toBeVisible();
        await axe('command palette', '#c-pal');
        await page.keyboard.type('budget');
        await axe('command palette filtered', '#c-pal');
        await page.keyboard.press('Escape');
        await expect(page.locator('#c-pal')).toBeHidden();
        await page.evaluate(() => /** @type {HTMLElement | null} */ (document.activeElement)?.blur());
        await page.keyboard.press('?');
        await expect(page.locator('#c-keys')).toBeVisible();
        await axe('keyboard shortcuts', '#c-keys');
        await page.keyboard.press('Escape');
      });

      test('stack search, with results and with none', async ({ page, axe }) => {
        await page.locator('#stack input').fill('aws');
        await axe('stack search', '#stack');
        await page.locator('#stack input').fill('zzzz');
        await axe('stack search, no results', '#stack');
      });

      test('ask.sh with an answer, its tests, and the chat window', async ({ page, axe }) => {
        await page.locator('#c-ask-field').fill('Has he been through an acquisition?');
        await page.locator('#c-ask-field').press('Enter');
        await expect(page.locator('#ask [data-ask-log] .c-ask-a')).toHaveCount(1);
        await axe('ask.sh answered', '#ask');
        await page.evaluate(() => {
          const d = /** @type {HTMLDetailsElement | null} */ (document.getElementById('c-tests'));
          if (d) d.open = true;
        });
        await axe('ask.sh tests open', '#c-tests');
        await page.evaluate(() => scrollTo(0, 0));
        const bar = page.locator('[data-chat-toggle]');
        if (await bar.isVisible()) {
          await axe('chat bar', '[data-chat]');
          await bar.click();
          await axe('chat open', '[data-chat]');
        }
      });
    });

    test.describe('other pages', () => {
      test('the plain CV', async ({ page, axe }) => {
        await page.goto('cv/');
        await settle(page);
        await axe('plain CV');
      });

      test('search and jump on a file page and the CV', async ({ page, axe }) => {
        for (const path of ['case-studies/monorepo/', 'cv/']) {
          await page.goto(path);
          await settle(page);
          await page.locator('[data-palette]').filter({ visible: true }).first().click();
          await expect(page.locator('#c-pal')).toBeVisible();
          await page.locator('#c-pal-field').fill('ai');
          await axe(`search and jump on ${path}`, '#c-pal');
        }
      });

      test.describe('the 404 page', () => {
        test.use({ expectedErrors: [/status of 404/] });
        test('the 404 page', async ({ page, axe }) => {
          await page.goto('this-page-does-not-exist');
          await settle(page);
          await axe('404 page');
        });
      });

      // Every file page in the sitemap, by section.
      for (const section of ['case-studies', 'responsibilities', 'blog']) {
        test(`every ${section} page`, async ({ page, axe, request, baseURL }) => {
          test.setTimeout(240_000);
          const sitemap = await (await request.get('sitemap-0.xml')).text();
          const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
            .map((m) => new URL(m[1]).pathname.replace(/^\//, ''))
            .filter((p) => p.startsWith(section + '/'));
          expect(paths.length).toBeGreaterThan(0);
          for (const path of paths) {
            await page.goto(new URL(path, baseURL).href);
            await settle(page);
            await axe(path);
          }
        });
      }
    });
  });
}
