// The old-domain redirects (redirects/old-domains.json, plus one rule for each recovered blog
// post) and how they match, following Cloudflare Bulk Redirects: a rule matches its exact URL, or
// with subpath matching everything under it; with include-subdomains also any subdomain. When
// several match, the most specific wins: the exact host, then an exact path, then the longest path.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPosts } from './posts.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONF = JSON.parse(readFileSync(join(ROOT, 'redirects', 'old-domains.json'), 'utf8'));

/** A rule's source as [host, path]. @param {string} src */
const split = (src) => {
  const i = src.indexOf('/');
  return i < 0 ? [src.toLowerCase(), '/'] : [src.slice(0, i).toLowerCase(), src.slice(i) || '/'];
};
// Each recovered blog post redirects from its old address to its new page.
const postRules = loadPosts()
  .filter((b) => b.original)
  .map((b) => {
    const u = new URL(b.original);
    return {
      source: u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, ''),
      target: CONF.home + 'blog/' + b.slug + '/',
      subdomains: !u.hostname.startsWith('blog.'),
      subpath: true,
      suffix: false,
      why: 'blog post: ' + b.title,
    };
  });
/**
 * @typedef {{ source: string, target: string, subdomains?: boolean, subpath?: boolean, suffix?: boolean, query?: boolean, why: string }} Rule
 */
/** @type {(Rule & { i: number, host: string, path: string })[]} */
export const RULES = /** @type {Rule[]} */ (postRules).concat(CONF.rules).map((r, i) => {
  const [host, path] = split(r.source);
  return Object.assign({ i, host, path }, r);
});

/**
 * The rule a URL hits, and where it goes; null if none.
 * @param {string} input
 */
export function match(input) {
  const u = new URL(input);
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  const path = u.pathname || '/';
  let best = null;
  for (const r of RULES) {
    const hostExact = host === r.host;
    if (!hostExact && !(r.subdomains && host.endsWith('.' + r.host))) continue;
    const exact = path === r.path;
    const under = r.subpath && (r.path === '/' || path.startsWith(r.path.endsWith('/') ? r.path : r.path + '/'));
    if (!exact && !under) continue;
    const score = [hostExact ? 1 : 0, exact ? 1 : 0, r.path.length];
    if (!best || cmp(score, best.score) > 0) best = { r, score };
  }
  if (!best) return null;
  const r = best.r;
  let target = r.target;
  if (r.subpath && r.suffix && path !== r.path) {
    let rest = path.slice(r.path.endsWith('/') ? r.path.length - 1 : r.path.length);
    if (target.endsWith('/') && rest.startsWith('/')) rest = rest.slice(1);
    target += rest;
  }
  if (r.query && u.search) target += u.search;
  return { rule: r, target };
}
/** @param {number[]} a @param {number[]} b */
function cmp(a, b) {
  for (let k = 0; k < a.length; k++) if (a[k] !== b[k]) return a[k] - b[k];
  return 0;
}

// Strings the Wayback Machine's crawler picked out of old scripts ("/projects/qtip/'+s.id+'"), not pages.
/** @param {string} url */
export const junk = (url) => {
  try {
    const u = new URL(url);
    // A plain query (?p=12&x=a) is fine; anything else odd in the path or query isn't a page.
    const query = /^\?[\w.-]+=[\w.%-]*(&[\w.-]+=[\w.%-]*)*$/.test(u.search) ? '' : u.search;
    return /['"(){}<>;+,[\]|\\^`=]|\s|https?:|\.bak$|\/\.[a-z]/i.test(decodeURIComponent(u.pathname + query));
  } catch {
    return true; // not a URL
  }
};
