// Social preview cards (1200×630): one for the home page and one per file page and blog page.
// Each renders as a page under /og-card/; the post-build step screenshots it to <path>og.png and
// removes the card pages.
import { caseStudies, responsibilities, slugOf } from './files';
import { posts } from './posts';

export interface OgCard {
  /** Where the image goes: '' for the home page, otherwise the page's path ('blog/', 'case-studies/auth/'). */
  path: string;
  /** The command line at the top. */
  cmd: string;
  kicker?: string;
  title: string;
  /** The home card has the portrait and a different footer. */
  home?: boolean;
}

const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export async function ogCards(): Promise<OgCard[]> {
  const blog = await posts();
  const years = blog.map((p) => p.data.date.getUTCFullYear());
  return [
    { path: '', cmd: 'cat README.md', kicker: '# intro', title: 'Craig Michael Thompson', home: true },
    ...(await caseStudies()).map(({ data }) => ({ path: `case-studies/${slugOf(data.file)}/`, cmd: `cat case-studies/${data.file}`, kicker: '// ' + data.kicker, title: data.title })),
    ...(await responsibilities()).map(({ data }) => ({ path: `responsibilities/${slugOf(data.file)}/`, cmd: `cat responsibilities/${data.file}`, kicker: '// ' + data.kicker, title: data.title })),
    { path: 'blog/', cmd: 'ls -t blog/', kicker: `${blog.length} posts · ${Math.min(...years)}–${Math.max(...years)}`, title: 'Blog' },
    ...blog.map((p) => ({ path: `blog/${p.slug}/`, cmd: `cat blog/${p.slug}.md`, kicker: [longDate(p.data.date), ...p.data.tags.slice(0, 3)].join(' · '), title: p.data.title })),
  ];
}
