// Cloudflare's _headers file (cloudflare/_headers), read the way Workers static assets apply it, so
// the local server (tools/lib/serve.mjs) sends the same headers as the live site: a block per
// path pattern, its headers indented under it. Patterns are paths with one * splat (any
// characters) or :placeholders (anything but /). Patterns with a host are skipped (they only
// match deployed hosts), and so is `! Name`, which removes a header.

/**
 * @typedef {{ test: RegExp, headers: [string, string][] }} Rule
 */

/**
 * @param {string} text
 * @returns {Rule[]}
 */
export function parseHeaders(text) {
  /** @type {Rule[]} */
  const rules = [];
  /** @type {Rule | null} */
  let rule = null;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!/^\s/.test(line)) {
      const path = line.trim();
      rule = path.startsWith('/') ? { test: pattern(path), headers: [] } : null;
      if (rule) rules.push(rule);
      continue;
    }
    const m = /^\s+([^!:\s][^:]*):\s*(.*)$/.exec(line);
    if (rule && m) rule.headers.push([m[1].trim().toLowerCase(), m[2].trim()]);
  }
  return rules;
}

/** @param {string} path */
function pattern(path) {
  const re = path
    .split(/(\*|:[A-Za-z]\w*)/)
    .map((part, i) => (i % 2 ? (part === '*' ? '.*' : '[^/]+') : part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${re}$`);
}

/**
 * The headers for a request path: every matching rule's, in order, with a header set twice joined
 * by commas (as Cloudflare does).
 * @param {Rule[]} rules @param {string} path
 * @returns {Record<string, string>}
 */
export function headersFor(rules, path) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const r of rules) {
    if (!r.test.test(path)) continue;
    for (const [k, v] of r.headers) out[k] = out[k] ? `${out[k]}, ${v}` : v;
  }
  return out;
}
