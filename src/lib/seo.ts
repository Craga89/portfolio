// Search and social descriptions, and structured data, for the file pages and posts.
import { SITE, NAME, EMAIL, GITHUB, LINKEDIN, HOME_TITLE, OG_DESC } from '../site';

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
export function articleLd({
  headline,
  name,
  description,
  path,
}: {
  headline: string;
  name: string;
  description: string;
  path: string;
}) {
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

/** schema.org ProfilePage for the home page: who Craig is, for search engines and AI agents. */
export async function homeLd() {
  const { getImage } = await import('astro:assets');
  const portrait = (await import('../assets/portrait.webp')).default;
  const image = await getImage({ src: portrait, width: 352, format: 'webp' });
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': SITE + '/',
    url: SITE + '/',
    name: HOME_TITLE,
    dateModified: new Date().toISOString().slice(0, 10),
    inLanguage: 'en-GB',
    mainEntity: {
      '@type': 'Person',
      '@id': SITE + '/#person',
      name: NAME,
      jobTitle: 'Head of Engineering',
      worksFor: { '@type': 'Organization', name: 'Hive HR' },
      description: OG_DESC,
      email: 'mailto:' + EMAIL,
      url: SITE + '/',
      image: SITE + image.src,
      address: { '@type': 'PostalAddress', addressLocality: 'Newcastle upon Tyne', addressCountry: 'GB' },
      alumniOf: { '@type': 'CollegeOrUniversity', name: 'Newcastle University' },
      hasCredential: {
        '@type': 'EducationalOccupationalCredential',
        credentialCategory: 'degree',
        name: 'MEng, Electronic & Computer Engineering',
      },
      sameAs: [GITHUB, LINKEDIN],
      knowsAbout: [
        'AI-first engineering',
        'AI-assisted development',
        'Engineering management',
        'Full-stack development',
        'Engineering leadership',
        'Platform engineering',
        'TypeScript',
        'JavaScript',
        'Node.js',
        'React',
        'GraphQL',
        'AWS',
        'Amazon ECS',
        'AWS Fargate',
        'Terraform',
        'CI/CD',
        'Buildkite',
        'GitHub Actions',
        'Monorepos',
        'MongoDB',
        'DevOps',
        'Security',
        'GDPR',
        'ISO 27001',
        'Amazon Bedrock',
        'Mastra',
        'Claude Code',
        'Google Cloud',
      ],
      knowsLanguage: 'en-GB',
    },
  };
}
