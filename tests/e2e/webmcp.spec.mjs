// WebMCP: the page registers its agent tools (shared/agent-tools.js) with the browser. A stand-in
// for document.modelContext records them, and each one is called as an agent would.
import { readdirSync } from 'node:fs';
import { test, expect } from '../fixtures.mjs';

const POSTS = readdirSync(new URL('../../src/content/blog/', import.meta.url)).filter((f) => f.endsWith('.md')).length;

/** @typedef {{ err: boolean, txt: string, data: any }} Call */

test.describe('WebMCP tools', { tag: '@desktop' }, () => {
  test.beforeEach(async ({ page, services }) => {
    services.ask = { status: 200, json: { answer: 'Stub answer.', sources: ['intro'] } };
    await page.addInitScript(() => {
      const w = /** @type {any} */ (window);
      w.__tools = [];
      w.__aborted = 0;
      Object.defineProperty(document, 'modelContext', {
        configurable: true,
        value: {
          /** @param {any} tool @param {{ signal?: AbortSignal }} [opts] */
          registerTool(tool, opts) {
            w.__tools.push(tool);
            opts?.signal?.addEventListener('abort', () => w.__aborted++);
            return Promise.resolve();
          },
        },
      });
    });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => /** @type {any} */ (window).__tools.length)).toBeGreaterThan(0);
  });

  /**
   * Call one registered tool in the page.
   * @param {import('@playwright/test').Page} page
   * @param {string} name
   * @param {Record<string, unknown>} [input]
   * @returns {Promise<Call>}
   */
  const call = (page, name, input = {}) =>
    page.evaluate(
      async ([toolName, args]) => {
        const tool = /** @type {any} */ (window).__tools.find((/** @type {any} */ t) => t.name === toolName);
        const r = await tool.execute(args, { signal: new AbortController().signal });
        const txt = r?.content?.[0]?.text ?? '';
        let data = null;
        try {
          data = JSON.parse(txt);
        } catch {
          // an error message, not JSON
        }
        return { err: !!r?.isError, txt, data };
      },
      /** @type {const} */ ([name, input]),
    );

  test('nine well-formed tools, unregistered when the page goes away', async ({ page }) => {
    const tools = await page.evaluate(() =>
      /** @type {any} */ (window).__tools.map((/** @type {any} */ t) => ({
        name: t.name,
        description: t.description,
        type: t.inputSchema?.type,
        execute: typeof t.execute,
        readOnly: typeof t.annotations?.readOnlyHint,
      })),
    );
    expect(tools).toHaveLength(9);
    expect(new Set(tools.map((t) => t.name)).size).toBe(9);
    for (const t of tools) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(30);
      expect(t).toMatchObject({ type: 'object', execute: 'function', readOnly: 'boolean' });
    }
    await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    expect(await page.evaluate(() => /** @type {any} */ (window).__aborted)).toBe(9);
  });

  test('get_profile and get_career', async ({ page }) => {
    const profile = (await call(page, 'get_profile')).data;
    expect(profile.name).toBe('Craig Thompson');
    expect(profile.email).toContain('@');
    expect(profile.links.cv_pdf).toMatch(/cv\.pdf$/);
    const career = (await call(page, 'get_career')).data;
    expect(career.work.length).toBeGreaterThanOrEqual(3);
    expect(career.education.length).toBeGreaterThanOrEqual(1);
  });

  test('list_files lists every file page', async ({ page }) => {
    const all = (await call(page, 'list_files')).data.files;
    expect(all).toHaveLength(26 + POSTS);
    for (const f of all) expect(f.url).toMatch(/\/(case-studies|responsibilities|blog)\/[\w-]+\/$/);
    expect((await call(page, 'list_files', { section: 'case-studies' })).data.files).toHaveLength(14);
  });

  test('read_file returns a file and can show it on the page', async ({ page }) => {
    const read = await call(page, 'read_file', { file: 'ai/platform.md', show: true });
    expect(read.err).toBe(false);
    expect(read.data.text.length).toBeGreaterThan(200);
    await expect(page.locator('#case-studies [role="tab"][aria-selected="true"]')).toContainText('platform');
    const missing = await call(page, 'read_file', { file: 'nope.md' });
    expect(missing.err).toBe(true);
    expect(missing.txt).toContain('monorepo.md');
  });

  test('search_site, and its argument checks', async ({ page }) => {
    expect((await call(page, 'search_site', { query: 'AWS cost' })).data.results.length).toBeGreaterThan(0);
    const bad = await call(page, 'search_site', { query: 42 });
    expect(bad.err).toBe(true);
    expect(bad.txt).toContain('string');
  });

  test('ask goes to the ask.sh service', async ({ page, services }) => {
    const ask = (await call(page, 'ask', { question: 'What does Craig do?' })).data;
    expect(ask).toMatchObject({ answer: 'Stub answer.', via: 'ai' });
    expect(services.calls.ask).toHaveLength(1);
  });

  test('get_open_source and get_site_report', async ({ page }) => {
    const oss = (await call(page, 'get_open_source')).data;
    expect(oss.merged_pull_requests).toBeGreaterThan(0);
    expect(oss.by_quarter.length).toBeGreaterThan(0);
    expect((await call(page, 'get_site_report')).data.source).toMatch(/github\.com\/Craga89\/portfolio/);
  });

  test('show_section scrolls to it (a page-only tool)', async ({ page }) => {
    const shown = await call(page, 'show_section', { section: 'faq' });
    expect(shown.err).toBe(false);
    await expect
      .poll(() => page.locator('#faq').evaluate((el) => el.getBoundingClientRect().top / window.innerHeight))
      .toBeLessThan(0.5);
    expect(await page.locator('#faq').evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThan(-50);
  });

  test('page-only arguments are offered on the page', async ({ page }) => {
    const hasShow = await page.evaluate(
      () =>
        !!(
          /** @type {any} */ (window).__tools.find((/** @type {any} */ t) => t.name === 'read_file').inputSchema
            .properties.show
        ),
    );
    expect(hasShow).toBe(true);
  });
});
