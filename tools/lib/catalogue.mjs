// The component catalogue (/storybook, built by Astrobook from src/stories): its pages use inline
// styles and scripts that Astro's per-page CSP hashes can't cover, so their policy allows inline
// code. It's a static, noindexed showcase with no user input or data of its own; everything else in
// the policy is unchanged.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The page with its CSP's script-src and style-src allowing inline code, in place of hashes.
 * @param {string} html
 */
export function relaxCsp(html) {
  return html.replace(/(<meta http-equiv="content-security-policy" content=")([^"]*)(")/i, (_, open, policy, close) => {
    const directives = policy
      .split(';')
      .filter(Boolean)
      .map((d) => {
        const [name, ...values] = d.trim().split(/\s+/);
        if (name !== 'script-src' && name !== 'style-src') return d.trim();
        const kept = values.filter((v) => !/^'sha(256|384|512)-/.test(v) && v !== "'unsafe-inline'");
        return [name, ...kept, "'unsafe-inline'"].join(' ');
      });
    return open + directives.join(';') + close;
  });
}

/**
 * Applies relaxCsp to every page under the catalogue in `out`.
 * @param {string} out the built site @param {string} sub the catalogue's folder
 * @returns {number} the pages changed
 */
export function relaxCatalogue(out, sub = 'storybook') {
  const root = join(out, sub);
  if (!existsSync(root)) return 0;
  let n = 0;
  const walk = (/** @type {string} */ dir) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.name.endsWith('.html')) {
        const html = readFileSync(p, 'utf8');
        const next = relaxCsp(html);
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
