// One flat sitemap.xml from @astrojs/sitemap's index and children.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { flattenSitemap, mergeSitemaps } from '../../../../tools/lib/sitemap.mjs';

const HEAD = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const urlset = (/** @type {string[]} */ urls) =>
  `${HEAD}${urls.map((u) => `<url><loc>${u}</loc></url>`).join('')}</urlset>`;

describe('sitemap', () => {
  it("merges the children's entries under the first one's header", () => {
    const merged = mergeSitemaps([
      urlset(['https://a.dev/']),
      `${HEAD}<url><loc>https://a.dev/b/</loc><lastmod>2015-07-26</lastmod></url></urlset>`,
    ]);
    assert.equal(
      merged,
      `${HEAD}<url><loc>https://a.dev/</loc></url><url><loc>https://a.dev/b/</loc><lastmod>2015-07-26</lastmod></url></urlset>`,
    );
  });

  it('refuses nothing, or something that is not a sitemap', () => {
    assert.throws(() => mergeSitemaps([]), /no child sitemaps/);
    assert.throws(() => mergeSitemaps(['<html></html>']), /no <urlset>/);
  });

  it('replaces the index and its children with sitemap.xml', () => {
    const out = mkdtempSync(join(tmpdir(), 'sitemap-'));
    writeFileSync(
      join(out, 'sitemap-index.xml'),
      '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://a.dev/sitemap-0.xml</loc></sitemap><sitemap><loc>https://a.dev/sitemap-1.xml</loc></sitemap></sitemapindex>',
    );
    writeFileSync(join(out, 'sitemap-0.xml'), urlset(['https://a.dev/', 'https://a.dev/cv/']));
    writeFileSync(join(out, 'sitemap-1.xml'), urlset(['https://a.dev/blog/']));
    assert.equal(flattenSitemap(out), 3);
    assert.equal(
      readFileSync(join(out, 'sitemap.xml'), 'utf8'),
      urlset(['https://a.dev/', 'https://a.dev/cv/', 'https://a.dev/blog/']),
    );
    for (const f of ['sitemap-index.xml', 'sitemap-0.xml', 'sitemap-1.xml'])
      assert.equal(existsSync(join(out, f)), false, f);
  });

  it('fails the build when there is no index to flatten', () => {
    assert.throws(() => flattenSitemap(mkdtempSync(join(tmpdir(), 'sitemap-'))), /no sitemap-index\.xml/);
  });
});
