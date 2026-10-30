// One flat sitemap.xml instead of @astrojs/sitemap's sitemap-index.xml and sitemap-N.xml. The site has
// far fewer than the 50,000 addresses a sitemap may hold, and some search engines (Bing, on its first
// pass) count an index's child sitemap as a single page instead of reading it.
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Merges the child sitemaps' entries into one urlset.
 * @param {string[]} children each child sitemap's XML
 * @returns {string}
 */
export function mergeSitemaps(children) {
  if (!children.length) throw new Error('no child sitemaps to merge');
  const open = /^[\s\S]*?<urlset\b[^>]*>/.exec(children[0])?.[0];
  if (!open) throw new Error('not a sitemap: no <urlset>');
  const urls = children.flatMap((xml) => xml.match(/<url>[\s\S]*?<\/url>/g) ?? []);
  return `${open}${urls.join('')}</urlset>`;
}

/**
 * Replaces the sitemap index in `out` and its children with one sitemap.xml.
 * @param {string} out the built site
 * @returns {number} the number of addresses in sitemap.xml
 */
export function flattenSitemap(out) {
  const index = join(out, 'sitemap-index.xml');
  if (!existsSync(index)) throw new Error('no sitemap-index.xml to flatten');
  const files = [...readFileSync(index, 'utf8').matchAll(/<loc>[^<]*\/(sitemap-\d+\.xml)<\/loc>/g)].map((m) => m[1]);
  const xml = mergeSitemaps(files.map((f) => readFileSync(join(out, f), 'utf8')));
  writeFileSync(join(out, 'sitemap.xml'), xml);
  for (const path of [index, ...files.map((f) => join(out, f))]) rmSync(path);
  return (xml.match(/<url>/g) ?? []).length;
}
