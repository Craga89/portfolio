// Search and social descriptions, and structured data, for the file pages and posts.
import { SITE, NAME } from '../site';

const MAX = 158;

/** Text without MDX/HTML tags or comments, its whitespace collapsed. */
export const plain = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();

/** A meta description: the first paragraph of `src`, cut at a word near 158 characters. */
export function describe(src: string | undefined, fallback: string): string {
  const first = plain((src ?? '').trim().split(/\n\s*\n/)[0] ?? '');
  if (!first) return fallback;
  return first.length > MAX ? first.slice(0, MAX - 3).replace(/\s\S*$/, '') + '…' : first;
}

export const author = { '@type': 'Person', '@id': SITE + '/#person', name: NAME, url: SITE + '/' };

/** schema.org Article for a file's page. */
export function articleLd({ headline, name, description, path }: { headline: string; name: string; description: string; path: string }) {
  const url = `${SITE}/${path}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    name,
    description,
    url,
    image: url + 'og.png',
    inLanguage: 'en-GB',
    dateModified: new Date().toISOString().slice(0, 10),
    author,
    isPartOf: { '@type': 'WebSite', name: 'craigthompson.dev', url: SITE + '/' },
  };
}
