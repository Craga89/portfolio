// Shared Playwright fixtures for the end-to-end, accessibility and screenshot tests.
//
// Every test gets a page that:
//   - never reaches the network beyond the site under test: the ask.sh service (/ask, /speak)
//     answers from `services`, which a test can change, and everything else gets an empty 204;
//   - fails the test on any uncaught error or console error (bar `expectedErrors`);
//   - optionally has a stand-in for the browser's Translator API (`translator: 'stub'`), or none
//     at all (`translator: 'none'`), since CI browsers have no on-device language models.
import { test as base, expect } from '@playwright/test';
import { translatorStub } from '../tools/translator-stub.mjs';

/**
 * @typedef {{ status: number, contentType?: string, json?: unknown, body?: string | Buffer }} Reply
 * @typedef {{ ask: Reply, speak: Reply, calls: { ask: string[], speak: string[] } }} Services
 * @typedef {'native' | 'stub' | 'none'} TranslatorMode
 */

/** ask.sh is unavailable unless a test says otherwise, so the page answers from its own search. */
const UNAVAILABLE = { status: 503, json: { error: 'unavailable' } };

/** @param {Reply} r */
const fulfilment = (r) => ({
  status: r.status,
  contentType: r.contentType || 'application/json',
  headers: { 'access-control-allow-origin': '*' },
  body: r.body ?? JSON.stringify(r.json ?? {}),
});

/**
 * @type {import('@playwright/test').TestType<
 *   import('@playwright/test').PlaywrightTestArgs & import('@playwright/test').PlaywrightTestOptions & { services: Services, translator: TranslatorMode, expectedErrors: RegExp[] },
 *   import('@playwright/test').PlaywrightWorkerArgs & import('@playwright/test').PlaywrightWorkerOptions
 * >}
 */
export const test = base.extend({
  translator: ['native', { option: true }],
  expectedErrors: [[], { option: true }],

  services: async ({}, use) => {
    await use({ ask: UNAVAILABLE, speak: UNAVAILABLE, calls: { ask: [], speak: [] } });
  },

  context: async ({ context, services, translator, baseURL }, use) => {
    const site = new URL(baseURL || 'http://127.0.0.1/').host;
    await context.route(
      (url) => url.host !== site,
      (route) => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/ask')) {
          services.calls.ask.push(route.request().postData() || '');
          return route.fulfill(fulfilment(services.ask));
        }
        if (url.pathname.endsWith('/speak')) {
          services.calls.speak.push(route.request().postData() || '');
          return route.fulfill(fulfilment(services.speak));
        }
        return route.fulfill({ status: 204 });
      },
    );
    if (translator === 'stub') await context.addInitScript(translatorStub);
    if (translator === 'none') {
      await context.addInitScript(() => {
        // Safari and Firefox have no Translator API.
        Reflect.deleteProperty(self, 'Translator');
        Reflect.deleteProperty(self, 'LanguageDetector');
      });
    }
    await use(context);
  },

  page: async ({ page, baseURL, expectedErrors }, use) => {
    const site = new URL(baseURL || 'http://127.0.0.1/').host;
    /** @type {string[]} */
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() !== 'error') return;
      // The browser logs every failed response; the service stand-ins fail on purpose.
      if (m.text().startsWith('Failed to load resource') && new URL(m.location().url || baseURL || '').host !== site)
        return;
      errors.push('console: ' + m.text());
    });
    await use(page);
    expect(
      errors.filter((e) => !expectedErrors.some((re) => re.test(e))),
      'errors on the page',
    ).toEqual([]);
  },
});

export { expect };

/**
 * Add a stylesheet to the page. A constructed one, since the site's Content-Security-Policy
 * (rightly) refuses inline <style> elements.
 * @param {import('@playwright/test').Page} page
 * @param {string} css
 */
export const addStyle = (page, css) =>
  page.evaluate((text) => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(text);
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  }, css);

/**
 * Turn off animations, transitions and smooth scrolling, so states can be checked straight away.
 * @param {import('@playwright/test').Page} page
 */
export const settle = (page) =>
  addStyle(
    page,
    'html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}',
  );

/**
 * The translation bar says the page is translated.
 * @param {import('@playwright/test').Page} page
 */
export const translated = (page) =>
  expect(page.locator('.tr-bar')).toHaveAttribute('data-kind', 'done', { timeout: 60_000 });
