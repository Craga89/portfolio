// The blog's posts, newest first, with what the lists and pages show about each.
import { getCollection, type CollectionEntry } from 'astro:content';

export type Post = CollectionEntry<'blog'> & { slug: string; minutes: number; summary: string };

/** A post's markdown as plain text, for word counts and summaries. */
const plain = (md: string) =>
  md
    .replace(/^(```|~~~~)[\s\S]*?^\1/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_`>]/g, '')
    .replace(/\\([\\`*_[\]])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

export async function posts(): Promise<Post[]> {
  const all = await getCollection('blog');
  return all
    .map((p) => {
      const text = plain(p.body ?? '');
      const first = text.match(/^(.{60,240}?[.!?])(\s|$)/);
      const words = text.split(/\s+/).filter(Boolean).length;
      return {
        ...p,
        slug: p.id,
        minutes: Math.max(1, Math.round(words / 220)),
        summary: p.data.summary || (first ? first[1] : text.slice(0, 200).replace(/\s\S*$/, '') + '…'),
      };
    })
    .sort((a, b) => +b.data.date - +a.data.date || a.slug.localeCompare(b.slug));
}
