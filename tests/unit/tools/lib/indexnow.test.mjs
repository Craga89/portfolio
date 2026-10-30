// IndexNow: which pages changed between two builds, and the request that reports them.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ENDPOINT, KEY, changedUrls, normalise, sitemapUrls, submit } from '../../../../tools/lib/indexnow.mjs';

const SITE = 'https://example.dev';

/** Writes a site: { 'path/': html }, plus a sitemap listing `listed`. */
function site(/** @type {Record<string, string>} */ pages, /** @type {string[]} */ listed) {
  const dir = mkdtempSync(join(tmpdir(), 'indexnow-'));
  for (const [p, html] of Object.entries(pages)) {
    mkdirSync(join(dir, p), { recursive: true });
    writeFileSync(join(dir, p, 'index.html'), html);
  }
  writeFileSync(
    join(dir, 'sitemap-0.xml'),
    `<urlset>${listed.map((p) => `<url><loc>${SITE}/${p}</loc></url>`).join('')}</urlset>`,
  );
  return dir;
}

describe('indexnow', () => {
  it('reads the addresses in a sitemap', () => {
    assert.deepEqual(
      sitemapUrls('<urlset><url><loc> https://a.dev/ </loc></url><url><loc>https://a.dev/b/</loc></url></urlset>'),
      ['https://a.dev/', 'https://a.dev/b/'],
    );
  });

  it('ignores the commit stamp, asset names and build dates', () => {
    const a =
      '<a href="/commit/0123456789abcdef0123456789abcdef01234567">main@0123456</a> 2026-10-30T10:00:00Z <script src="/assets/app.AbC.js"></script> {"dateModified":"2026-10-30"}';
    const b =
      '<a href="/commit/fedcba9876543210fedcba9876543210fedcba98">main@fedcba9</a> 2026-10-31T09:00:00Z <script src="/assets/app.XyZ.js"></script> {"dateModified":"2026-10-31"}';
    assert.equal(normalise(a), normalise(b));
    assert.notEqual(normalise('<p>one</p>'), normalise('<p>two</p>'));
  });

  it('lists new and changed pages in the sitemap, and nothing else', () => {
    const before = site({ '': '<p>home</p>', 'cv/': '<p>cv</p>', 'gone/': '<p>x</p>' }, ['', 'cv/']);
    const after = site(
      { '': '<p>home</p>', 'cv/': '<p>cv, updated</p>', 'blog/new/': '<p>new</p>', 'og-card/x/': '<p>card</p>' },
      ['', 'cv/', 'blog/new/'],
    );
    assert.deepEqual(changedUrls(before, after, SITE).sort(), [`${SITE}/blog/new/`, `${SITE}/cv/`]);
  });

  it('lists every page on the first deploy', () => {
    const after = site({ '': '<p>home</p>', 'cv/': '<p>cv</p>' }, ['', 'cv/']);
    assert.deepEqual(changedUrls(join(after, 'missing'), after, SITE).sort(), [`${SITE}/`, `${SITE}/cv/`]);
  });

  it('posts the addresses with the key, and sends nothing when nothing changed', async () => {
    /** @type {[string, RequestInit][]} */
    const calls = [];
    const post = /** @type {typeof fetch} */ (
      async (url, init) => {
        calls.push([String(url), /** @type {RequestInit} */ (init)]);
        return new Response(null, { status: 202 });
      }
    );
    assert.equal(await submit([], SITE, post), 0);
    assert.equal(calls.length, 0);
    assert.equal(await submit([`${SITE}/cv/`], SITE, post), 202);
    assert.equal(calls[0][0], ENDPOINT);
    assert.deepEqual(JSON.parse(String(calls[0][1].body)), {
      host: 'example.dev',
      key: KEY,
      keyLocation: `${SITE}/${KEY}.txt`,
      urlList: [`${SITE}/cv/`],
    });
  });
});
