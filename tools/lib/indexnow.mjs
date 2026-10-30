// IndexNow: tells Bing, Yandex, Seznam, Naver and Yep which pages changed, so they recrawl them
// soon after a deploy rather than whenever they next visit. Google doesn't take part; it reads the
// sitemap (submitted in Search Console). See https://www.indexnow.org/documentation.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** The site's IndexNow key, served at /<KEY>.txt (public/), which proves the site owns it. */
export const KEY = '619abef34b2d629aeed86e35679eb000';
export const ENDPOINT = 'https://api.indexnow.org/indexnow';

/**
 * The page addresses in a sitemap, so only pages meant to be indexed are submitted.
 * @param {string} xml
 */
export const sitemapUrls = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());

/**
 * A page's HTML without what changes on every deploy, so only real edits count: the sidebar's
 * version link (the commit and build date, stamped as one element), the structured data's
 * dateModified (the build date), and asset file names, which change whenever any page's scripts
 * or styles do. Nothing else is touched, so a changed number or date in the content still counts.
 * @param {string} html
 */
export const normalise = (html) =>
  html
    .replace(/<a class="ver"[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/"dateModified":"[^"]*"/g, '')
    .replace(/\/assets\/[^"'\s)]+/g, '/assets/');

/**
 * The site path (e.g. "blog/x/") of every page under `dir`.
 * @param {string} dir
 * @returns {string[]}
 */
function pagePaths(dir) {
  /** @type {string[]} */
  const out = [];
  const walk = (/** @type {string} */ d) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name === 'index.html') out.push(relative(dir, d).split('\\').join('/'));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out.map((p) => (p ? p + '/' : ''));
}

/**
 * The addresses of pages that are new or changed between two builds of the site, limited to the
 * pages in the new build's sitemap.
 * @param {string} oldDir the site as last deployed (may not exist, on the first deploy)
 * @param {string} newDir the site about to be deployed
 * @param {string} site the site's origin, e.g. https://craigthompson.dev
 * @returns {string[]}
 */
export function changedUrls(oldDir, newDir, site) {
  const listed = new Set(
    readdirSync(newDir)
      .filter((f) => /^sitemap-\d+\.xml$/.test(f))
      .flatMap((f) => sitemapUrls(readFileSync(join(newDir, f), 'utf8'))),
  );
  return pagePaths(newDir)
    .filter((p) => {
      const before = join(oldDir, p, 'index.html');
      if (!existsSync(before)) return true;
      return normalise(readFileSync(before, 'utf8')) !== normalise(readFileSync(join(newDir, p, 'index.html'), 'utf8'));
    })
    .map((p) => `${site}/${p}`)
    .filter((u) => listed.has(u));
}

/**
 * Submits addresses to IndexNow (at most 10,000 per request).
 * @param {string[]} urls
 * @param {string} site
 * @param {typeof fetch} [post]
 * @returns {Promise<number>} the HTTP status, or 0 when there was nothing to send
 */
export async function submit(urls, site, post = fetch) {
  if (!urls.length) return 0;
  const host = new URL(site).host;
  const r = await post(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host, key: KEY, keyLocation: `${site}/${KEY}.txt`, urlList: urls.slice(0, 10000) }),
  });
  return r.status;
}
