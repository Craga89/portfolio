// Translation: the browser's own page translation (Chrome Translate), and the site's on-device
// translation through the browser's Translator API (a stand-in here: CI has no language models).
// The stand-in returns the English text tagged «xx» (tools/translator-stub.mjs).
import { test, expect, translated } from '../fixtures.mjs';

const ANSWER = {
  status: 200,
  json: { answer: 'He has led engineering teams. See leadership.md.', sources: ['intro'] },
};

/**
 * Ask ask.sh a question and return the newest answer and its note.
 * @param {import('@playwright/test').Page} page
 * @param {string} question
 */
async function ask(page, question) {
  const before = await page.locator('.c-ask-log .c-ask-a').count();
  await page.locator('#c-ask-field').fill(question);
  await page.locator('#c-ask-field').press('Enter');
  await expect(page.locator('.c-ask-log .c-ask-a')).toHaveCount(before + 1);
  return page.locator('.c-ask-log .c-ask-a').last();
}

test(
  'the browser’s page translation survives scrolling, tab switches and the scroll spy',
  { tag: '@desktop' },
  async ({ page }) => {
    await page.goto('/');
    // Chrome Translate swaps each text node for a translated copy wrapped in <font>.
    await page.evaluate(() => {
      document.documentElement.classList.add('translated-ltr');
      const app = /** @type {HTMLElement} */ (document.getElementById('app'));
      const walker = document.createTreeWalker(app, NodeFilter.SHOW_TEXT);
      /** @type {Text[]} */
      const nodes = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode())
        if (/\p{L}{2}/u.test(/** @type {Text} */ (n).data)) nodes.push(/** @type {Text} */ (n));
      for (const n of nodes) {
        const f = document.createElement('font');
        f.textContent = 'GT:' + n.data;
        n.replaceWith(f);
      }
    });
    const fonts = () => page.locator('#app font').count();
    const before = await fonts();
    // Each section renders as it scrolls into view (content-visibility), which mustn't undo the translation.
    for (const id of ['career', 'case-studies', 'faq', 'top']) {
      await page.locator('#' + id).evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
      await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    }
    await page.locator('#case-studies [role="tab"]').nth(2).click();
    await expect(page.locator('#case-studies [role="tab"]').nth(2)).toHaveAttribute('aria-selected', 'true');
    expect(await fonts()).toBeGreaterThanOrEqual(before * 0.95);
    await page.locator('#career').evaluate((el) => el.scrollIntoView({ behavior: 'instant' }));
    await expect(page.locator('.v2-tree a[aria-current="true"]')).toHaveAttribute('href', '#career');
  },
);

test.describe('without the Translator API (Safari, Firefox)', () => {
  test.use({ translator: 'none' });

  test('nothing about translation loads', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#app .c-root')).toBeVisible();
    expect(await page.evaluate(() => 'CRAGA_I18N' in window)).toBe(false);
    await expect(page.locator('.v2-lang-s, .tr-offer')).toHaveCount(0);
  });
});

test.describe('an English browser', () => {
  test.use({ translator: 'stub', locale: 'en-GB' });

  test(
    'gets the language menu, not the offer, and loads no translation code',
    { tag: '@desktop' },
    async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('.v2-side .v2-lang-s')).toHaveCount(1);
      await expect(page.locator('.tr-offer')).toHaveCount(0);
      expect(await page.locator('script[src*="i18n."]').count()).toBe(0);
      expect(await page.evaluate(() => /** @type {any} */ (window).__trCalls)).toBe(0);
    },
  );

  test('a question in German is answered in German, and says it was machine-translated', async ({ page, services }) => {
    services.ask = ANSWER;
    await page.goto('/');
    const answer = await ask(page, 'Welche Erfahrung hat er mit Teams?');
    await expect(answer).toContainText('«de» He has led');
    await expect(page.locator('.c-ask-log .c-ask-meta').last()).toContainText(
      'Machine-translated from English by your browser',
    );
  });
});

test.describe('a German browser', () => {
  test.use({ translator: 'stub', locale: 'de-DE' });

  test.beforeEach(async ({ page, services }) => {
    services.ask = ANSWER;
    await page.goto('/');
    await expect(page.locator('.tr-offer')).toContainText('Diese Seite auf Deutsch lesen?');
    await page.getByRole('button', { name: 'Übersetzen' }).click();
    await translated(page);
  });

  test('the page translates, keeping names, file names and commands', { tag: '@desktop' }, async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('lang', 'de');
    await expect(page).toHaveTitle(/^«de» Craig Michael Thompson/);
    await expect(page.locator('h1')).toHaveText('Craig Michael Thompson');
    await expect(page.locator('.c-cmd').first()).toHaveText(/^\$ cat README\.md/);
    await expect(page.locator('.v2-side .v2-lang-s')).toHaveValue('de');
    const untranslated = await page.evaluate(() =>
      [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('#app p, #app li, #app h2, #app h3'))]
        .filter(
          (e) =>
            e.offsetParent &&
            /\p{L}{3}/u.test(e.textContent || '') &&
            !/^[\w./@-]+$/.test((e.textContent || '').trim()) &&
            !e.closest('[translate="no"]') &&
            !e.querySelector('[translate="no"]') &&
            !/«de»/.test(e.textContent || ''),
        )
        .map((e) => (e.textContent || '').trim().slice(0, 50)),
    );
    expect(untranslated).toEqual([]);
    expect(await page.locator('.c-see').evaluateAll((as) => as.some((a) => /«/.test(a.textContent || '')))).toBe(false);
  });

  test('it says this is machine translation by the browser', { tag: '@desktop' }, async ({ page }) => {
    await expect(page.locator('.tr-bar [role="status"]')).toContainText('Maschinelle Übersetzung durch Ihren Browser');
    await expect(page.locator('.v2-side .v2-lang-mt')).toBeAttached();
    await page.locator('.tr-info').click();
    const about = page.locator('#tr-about');
    await expect(about).toBeVisible();
    await expect(about).toContainText('built-in translation model');
    const [pop, button] = await Promise.all([about.boundingBox(), page.locator('.tr-info').boundingBox()]);
    expect(Math.abs((pop?.y ?? 0) - ((button?.y ?? 0) + (button?.height ?? 0)))).toBeLessThan(24);
    expect(pop?.x).toBeGreaterThanOrEqual(0);
    expect((pop?.x ?? 0) + (pop?.width ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
    await page.keyboard.press('Escape');
    await expect(about).toBeHidden();
  });

  test('an idle translated page doesn’t flicker back to English', async ({ page }) => {
    const changes = await page.evaluate(
      () =>
        new Promise((done) => {
          let n = 0;
          const mo = new MutationObserver((list) => (n += list.length));
          mo.observe(/** @type {Node} */ (document.getElementById('app')), {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
          setTimeout(() => (mo.disconnect(), done(n)), 2000);
        }),
    );
    expect(changes).toBe(0);
  });

  test('when markup is lost in translation, highlighted phrases stay working buttons', async ({ page }) => {
    // The stand-in drops the markup tokens for text mentioning "monorepo".
    const buttons = page
      .locator('#app p')
      .filter({ hasText: /monorepo/i })
      .filter({ has: page.locator('button.v2-x') })
      .first()
      .locator('button.v2-x');
    expect(await buttons.count()).toBeGreaterThanOrEqual(2);
    for (const b of await buttons.all()) {
      await expect(b).toHaveText(/^«de»/);
      await expect(b).toHaveAttribute('data-dc-click');
    }
  });

  test('switching case-study tabs stays translated', { tag: '@desktop' }, async ({ page }) => {
    await page.locator('#case-studies [role="tab"]').nth(4).click();
    await expect(page.locator('#case-studies [role="tabpanel"]:visible h3').first()).toHaveText(/^«de»/);
  });

  test('ask.sh works in German: the question goes in English, the answer comes back', async ({ page }) => {
    const answer = await ask(page, 'Welche Erfahrung hat er mit Teams?');
    await expect(answer).toContainText('«de» He has led engineering teams');
    await expect(answer).toContainText('leadership.md');
  });

  test('"Show original" restores English, and a returning visitor gets German straight away', async ({ page }) => {
    await page.getByRole('button', { name: /Show original/ }).click();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-GB');
    await expect(page.locator('.tr-bar')).toHaveCount(0);
    await expect(page).not.toHaveTitle(/«/);
    expect(await page.locator('#app').textContent()).not.toContain('«');

    await page.evaluate(() => localStorage.setItem('craga-lang', 'de'));
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'de', { timeout: 15_000 });
    await expect(page.locator('.tr-offer')).toHaveCount(0);
  });
});

test.describe('a French browser', () => {
  test.use({ translator: 'stub', locale: 'fr-FR' });

  test('"no thanks" is remembered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Non merci' }).click();
    await page.reload();
    await expect(page.locator('#app .c-root')).toBeVisible();
    await expect(page.locator('.tr-offer')).toHaveCount(0);
  });
});

test.describe('Arabic', () => {
  test.use({ translator: 'stub', locale: 'en-GB' });

  for (const path of ['/', '/cv/']) {
    test(`is right to left, with no sideways scrolling (${path})`, async ({ page }) => {
      await page.goto(path);
      if (path === '/')
        await page.evaluate(() =>
          /** @type {any} */ (window).CRAGA_I18N.load().then((/** @type {any} */ m) => m.setLanguage('ar')),
        );
      else await page.locator('.v-lang').selectOption('ar');
      await translated(page);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await page.evaluate(() => document.documentElement.classList.add('cv-all'));
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
        .toBeLessThanOrEqual(1);
      // The case-study "next" arrow points left.
      const next = page.locator('.c-deck-ctl button[aria-label]:last-child span');
      if (await next.count()) await expect(next).toHaveText('←');
    });
  }
});
