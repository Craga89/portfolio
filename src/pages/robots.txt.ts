// Search engines may crawl the site when ALLOW_INDEXING=true, except the branch previews under /preview/,
// which also carry a noindex tag. Without it, they stay out entirely.
import type { APIRoute } from 'astro';
import { INDEXING, SITE } from '../site';

export const GET: APIRoute = () =>
  new Response(
    INDEXING
      ? `User-agent: *\nAllow: /\nDisallow: /preview/\nSitemap: ${SITE}/sitemap-index.xml\n`
      : 'User-agent: *\nDisallow: /\n',
  );
