// Writes the component catalogue's examples (src/stories/examples/<Name>.mdx): for each component
// the content files can use (src/components/mdx.ts, and the CV's), its first use in src/content, copied as
// written, so the catalogue shows each component with real content. Also writes a story for each
// (src/stories/<content|figures|cv>/<Name>.stories.ts) where there isn't one yet. Run after content
// or component changes:
//   node tools/stories.mjs
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'src/stories/examples');

/** @param {string} dir @returns {string[]} */
const walk = (dir) =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.mdx') ? [p] : [];
  });

/**
 * The first whole element `<Name …>…</Name>` (or `<Name … />`) in `text`, nesting included, with
 * its indent removed.
 * @param {string} text @param {string} name @returns {string | undefined}
 */
export function firstUse(text, name) {
  const open = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  const m = open.exec(text);
  if (!m) return undefined;
  const start = m.index;
  // The opening tag's end, skipping > inside quotes or braces.
  let i = start + name.length + 1;
  let quote = '';
  let depth = 0;
  for (; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === quote) quote = '';
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) break;
  }
  if (text[i - 1] === '/') return dedent(text, start, i + 1);
  // Find the matching close, counting nested elements of the same name.
  const tag = new RegExp(`<${name}(?=[\\s/>])[^>]*?(/?)>|</${name}>`, 'g');
  tag.lastIndex = i + 1;
  let level = 1;
  for (let t; (t = tag.exec(text));) {
    if (t[0].startsWith('</')) level--;
    else if (t[1] !== '/') level++;
    if (level === 0) return dedent(text, start, t.index + t[0].length);
  }
  return undefined;
}

/** @param {string} text @param {number} start @param {number} end */
function dedent(text, start, end) {
  const lineStart = text.lastIndexOf('\n', start) + 1;
  const indent = text.slice(lineStart, start);
  const block = text.slice(start, end);
  return /^\s*$/.test(indent) ? block.replaceAll(`\n${indent}`, '\n') : block;
}

/** The components the content files can use, by name. */
export const names = () => [
  ...[
    ...readFileSync(join(ROOT, 'src/components/mdx.ts'), 'utf8').matchAll(
      /^import (\w+) from '\.\/(content|figures)\//gm,
    ),
  ].map((m) => ({ name: m[1], dir: m[2] })),
  // The CV's, used in src/content/sections/cv.mdx.
  { name: 'Job', dir: 'cv' },
  { name: 'Meta', dir: 'cv' },
];

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = walk(join(ROOT, 'src/content')).map((p) => ({ p, text: readFileSync(p, 'utf8') }));
  mkdirSync(OUT, { recursive: true });
  /** @type {string[]} */
  const missing = [];
  for (const { name } of names()) {
    const hit = files.map((f) => ({ f, use: firstUse(f.text, name) })).find((h) => h.use);
    if (!hit) {
      missing.push(name);
      continue;
    }
    const from = hit.f.p.slice(ROOT.length);
    writeFileSync(
      join(OUT, `${name}.mdx`),
      `{/* The first use of <${name}> in the site's content: ${from}. Written by tools/stories.mjs. */}\n\n${hit.use}\n`,
    );
  }
  let stories = 0;
  for (const { name, dir } of names()) {
    const story = join(ROOT, 'src/stories', dir, `${name}.stories.ts`);
    if (missing.includes(name) || existsSync(story)) continue;
    mkdirSync(join(ROOT, 'src/stories', dir), { recursive: true });
    writeFileSync(
      story,
      `// <${name}> as first used in the site's content (examples/${name}.mdx, from tools/stories.mjs).\nimport Mdx from '../Mdx.astro';\nimport Example from '../examples/${name}.mdx';\n\nexport default { component: Mdx };\n\nexport const ${name} = { args: { content: Example } };\n`,
    );
    stories++;
  }
  if (stories) console.log(`wrote ${stories} stories`);
  console.log(
    `wrote ${names().length - missing.length} examples${missing.length ? `; not used in content: ${missing.join(', ')}` : ''}`,
  );
}
