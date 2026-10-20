// Downloads the Google Fonts the site uses as woff2 files into src/fonts/, keeping the
// latin and latin-ext subsets, and writes src/fonts/fonts.css with matching @font-face rules.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src', 'fonts');
const CSS = 'https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800;900&family=Public+Sans:wght@400;500;700&family=Red+Hat+Mono:wght@400;500;700&family=Inter:wght@400;500;600;700&display=swap';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36';

mkdirSync(OUT, { recursive: true });
const css = await (await fetch(CSS, { headers: { 'user-agent': UA } })).text();
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g)].filter((m) => m[1] === 'latin' || m[1] === 'latin-ext');
if (!blocks.length) throw new Error('no font-face blocks found:\n' + css.slice(0, 500));
/** The first group of `re` in `s`; throws if Google's CSS has changed shape. */
const must = (/** @type {string} */ s, /** @type {RegExp} */ re) => {
  const m = s.match(re);
  if (!m) throw new Error(`${re} not found in:\n${s}`);
  return m[1];
};
const files = new Map();
let out = '';
for (const [, subset, body] of blocks) {
  const fam = must(body, /font-family:\s*'([^']+)'/);
  const weight = must(body, /font-weight:\s*([\d ]+)/).trim();
  const url = must(body, /url\(([^)]+)\)/);
  let name = files.get(url);
  if (!name) {
    name = `${fam.toLowerCase().replace(/\s+/g, '-')}-${subset}-${weight.replace(' ', '-')}.woff2`;
    const buf = Buffer.from(await (await fetch(url, { headers: { 'user-agent': UA } })).arrayBuffer());
    writeFileSync(join(OUT, name), buf);
    files.set(url, name);
    console.log(name, buf.length);
  }
  out += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${weight};font-display:swap;src:url(FONTDIR/${name}) format('woff2');unicode-range:${must(body, /unicode-range:\s*([^;]+)/).trim()}}\n`;
}
writeFileSync(join(OUT, 'fonts.css'), out);
console.log('wrote', files.size, 'files');
