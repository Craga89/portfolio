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
  const at = firstUseAt(text, name);
  return at && dedent(text, at.start, at.end);
}

/**
 * The end of the opening tag that starts at `start` (just past its >), skipping > inside quotes or
 * braces.
 * @param {string} text @param {number} start
 */
function tagEnd(text, start) {
  let i = start + 1;
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
  return i + 1;
}

/**
 * Where the first whole element `<Name …>…</Name>` is in `text`.
 * @param {string} text @param {string} name @returns {{ start: number, end: number } | undefined}
 */
function firstUseAt(text, name) {
  const open = new RegExp(`<${name}(?=[\\s/>])`, 'g');
  const m = open.exec(text);
  if (!m) return undefined;
  const start = m.index;
  const i = tagEnd(text, start);
  if (text[i - 2] === '/') return { start, end: i };
  // Find the matching close, counting nested elements of the same name.
  const tag = new RegExp(`<${name}(?=[\\s/>])[^>]*?(/?)>|</${name}>`, 'g');
  tag.lastIndex = i;
  let level = 1;
  for (let t; (t = tag.exec(text));) {
    if (t[0].startsWith('</')) level--;
    else if (t[1] !== '/') level++;
    if (level === 0) return { start, end: t.index + t[0].length };
  }
  return undefined;
}

/**
 * The first use of `<Name>`, as {@link firstUse}, but still inside the components it sits in when
 * it's one of their items (on a line of its own): a <Row> in its <Compare>, say, since a row alone
 * isn't a table. The components around it keep their attributes but nothing else.
 * @param {string} text @param {string} name @returns {string | undefined}
 */
export function inContext(text, name) {
  const at = firstUseAt(text, name);
  if (!at) return undefined;
  const own = dedent(text, at.start, at.end);
  const lineStart = text.lastIndexOf('\n', at.start) + 1;
  if (!/^\s*$/.test(text.slice(lineStart, at.start))) return own;
  // The components still open where it starts, outermost first.
  /** @type {string[]} */
  const open = [];
  const tag = /<(\/?)([A-Z]\w*)(?=[\s/>])/g;
  for (let t; (t = tag.exec(text)) && t.index < at.start;) {
    if (t[1]) {
      open.pop();
      continue;
    }
    const end = tagEnd(text, t.index);
    if (text[end - 2] !== '/') open.push(text.slice(t.index, end));
    tag.lastIndex = end;
  }
  return open.reduceRight((inner, o) => {
    const n = /^<(\w+)/.exec(o)?.[1];
    return `${o}\n${inner.replace(/^/gm, '  ')}\n</${n}>`;
  }, own);
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
    const hit = files.map((f) => ({ f, use: inContext(f.text, name) })).find((h) => h.use);
    if (!hit) {
      missing.push(name);
      continue;
    }
    const from = hit.f.p.slice(ROOT.length);
    writeFileSync(
      join(OUT, `${name}.mdx`),
      `{/* The first use of <${name}> in the site's content, in the components it sits in: ${from}. Written by tools/stories.mjs. */}\n\n${hit.use}\n`,
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
