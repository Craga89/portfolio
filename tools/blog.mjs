// The blog: Markdown posts in src/blog/<slug>.md with front matter (title, date, tags, original,
// archived), images in src/blog/img/. The build renders each post to /blog/<slug>/ and lists them
// on the home page and at /blog/.
//
//   node tools/blog.mjs sync   copy the post list into the design file (Component.POSTS), so the
//                              home page's blog section shows on the design canvas too
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const BLOG = join(ROOT, 'src', 'blog');

function frontMatter(src) {
  const m = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return [{}, src];
  const data = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    if (/^\[.*\]$/.test(v))
      v = v
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => (/^".*"$/.test(s) ? JSON.parse(s) : s));
    else if (/^".*"$/.test(v)) v = JSON.parse(v);
    data[kv[1]] = v;
  }
  return [data, src.slice(m[0].length)];
}

const plain = (md) =>
  md
    .replace(/^(```|~~~~)[\s\S]*?^\1/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\\([\\`*_[\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

// Every post, newest first: { slug, title, date, tags, original, archived, md, text, summary, minutes }.
export function loadPosts() {
  if (!existsSync(BLOG)) return [];
  return readdirSync(BLOG)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const [data, md] = frontMatter(readFileSync(join(BLOG, f), 'utf8'));
      const text = plain(md);
      const first = text.match(/^(.{60,240}?[.!?])(\s|$)/);
      const summary = data.summary || (first ? first[1] : text.slice(0, 200).replace(/\s\S*$/, '') + '…');
      const words = text.split(/\s+/).filter(Boolean).length;
      return {
        slug: f.replace(/\.md$/, ''),
        title: data.title || f,
        date: String(data.date || ''),
        tags: data.tags || [],
        original: data.original || '',
        archived: data.archived || '',
        md,
        text,
        summary,
        minutes: Math.max(1, Math.round(words / 220)),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
}

// What the home page needs about each post.
export const listing = (posts) =>
  posts.map(({ slug, title, date, tags, minutes }) => ({ slug, title, date, tags, minutes }));

const DESIGN = join(ROOT, 'src', 'ThemeTyne.dc.html');
const LINE = /^ {2}static POSTS = .*;$/m;
export function designListing() {
  const m = readFileSync(DESIGN, 'utf8').match(LINE);
  return m ? JSON.parse(m[0].replace(/^ {2}static POSTS = /, '').replace(/;$/, '')) : null;
}
export function sync() {
  const src = readFileSync(DESIGN, 'utf8');
  const line = '  static POSTS = ' + JSON.stringify(listing(loadPosts())) + ';';
  if (!LINE.test(src)) throw new Error('no "static POSTS = …;" line in ' + DESIGN);
  writeFileSync(DESIGN, src.replace(LINE, line));
  return listing(loadPosts()).length;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === 'sync') console.log('design file now lists', sync(), 'posts');
  else console.log('usage: node tools/blog.mjs sync');
}
