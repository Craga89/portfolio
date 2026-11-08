// The component catalogue (/storybook, built by Astrobook from src/stories). Astro's per-page CSP
// hashes the site's own inline code, but not Astrobook's, so after the build each catalogue page's
// policy gets:
// - script-src: the hashes of that page's own inline scripts, added to the ones it has. Scripts
//   stay hash-only, as on the rest of the site, so injected markup still can't run script.
// - style-src: 'unsafe-inline', in place of its hashes, for the style attributes Astrobook's UI
//   sets (hashes can't cover attributes, and a browser ignores 'unsafe-inline' next to a hash).
// Everything else in the policy, and every page outside the catalogue, is unchanged.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const CSP = /(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i;

/**
 * The CSP hash of each inline script on the page, as a browser computes it (over the script's text
 * exactly as written).
 * @param {string} html
 * @returns {string[]}
 */
export function inlineScriptHashes(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => !/\bsrc\s*=/i.test(attrs) && body.length > 0)
    .map(([, , body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
}

/**
 * The page with its CSP's script-src also allowing its own inline scripts by hash, and its
 * style-src allowing inline styles.
 * @param {string} html
 */
export function catalogueCsp(html) {
  const scripts = inlineScriptHashes(html);
  return html.replace(CSP, (_, open, policy, close) => {
    const directives = policy
      .split(';')
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.trim().split(/\s+/);
        if (name === 'script-src') return [name, ...new Set([...values, ...scripts])].join(' ');
        if (name === 'style-src')
          return [
            name,
            ...values.filter((v) => !/^'sha(256|384|512)-/.test(v) && v !== "'unsafe-inline'"),
            "'unsafe-inline'",
          ].join(' ');
        return d.trim();
      });
    return open + directives.join(';') + close;
  });
}

/**
 * Applies catalogueCsp to every page under the catalogue in `out`.
 * @param {string} out the built site @param {string} sub the catalogue's folder
 * @returns {number} the pages changed
 */
export function secureCatalogue(out, sub = 'storybook') {
  const root = join(out, sub);
  if (!existsSync(root)) return 0;
  let n = 0;
  const walk = (/** @type {string} */ dir) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name.endsWith('.html')) {
        const html = readFileSync(p, 'utf8');
        const next = catalogueCsp(html);
        if (next !== html) {
          writeFileSync(p, next);
          n++;
        }
      }
    }
  };
  walk(root);
  return n;
}
