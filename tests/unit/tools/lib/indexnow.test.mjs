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

  it('ignores the version link, the build date and asset names', () => {
    const page = (/** @type {string} */ sha, /** @type {string} */ day, /** @type {string} */ asset) =>
      `<a class="ver" href="/commit/${sha}" title="Built from commit ${sha.slice(0, 7)}, ${day} Oct 2026" data-built="2026-10-${day}T10:00:00Z" data-x><span>main@${sha.slice(0, 7)}</span> · <span>just now</span></a>` +
      `<script type="application/ld+json">{"dateModified":"2026-10-${day}"}</script><script src="/assets/app.${asset}.js"></script><p>Content</p>`;
    assert.equal(
      normalise(page('0123456789abcdef0123456789abcdef01234567', '30', 'AbC')),
      normalise(page('fedcba9876543210fedcba9876543210fedcba98', '31', 'XyZ')),
    );
  });

  it('still sees edits to numbers and dates in the content', () => {
    assert.notEqual(normalise('<p>1000000 emails</p>'), normalise('<p>2000000 emails</p>'));
    assert.notEqual(normalise('<p>Since 2008-04-01</p>'), normalise('<p>Since 2009-04-01</p>'));
    assert.notEqual(normalise('<p>deadbeef1</p>'), normalise('<p>deadbeef2</p>'));
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
