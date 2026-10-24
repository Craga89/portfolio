// The blog posts' front matter (src/content/blog/<slug>.md), for tools that run outside Astro:
// the old-domain redirects send each post's old address to its page here.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BLOG = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'content', 'blog');

/** One post: its slug and the plain string fields of its front matter. @typedef {{ slug: string, title: string, original: string }} Post */

/** @returns {Post[]} */
export function loadPosts() {
  return readdirSync(BLOG)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const head = readFileSync(join(BLOG, f), 'utf8').match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      /** @type {Record<string, string>} */
      const data = {};
      for (const [, k, v] of head.matchAll(/^([\w-]+):\s*(.*)$/gm))
        data[k] = /^".*"$/.test(v.trim()) ? JSON.parse(v.trim()) : v.trim();
      return { slug: f.replace(/\.md$/, ''), title: data.title || f, original: data.original || '' };
    });
}
