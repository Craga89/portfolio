// Search engines may crawl the site when ALLOW_INDEXING=true. Branch previews (/preview/) stay crawlable on
// purpose: their noindex tag is what keeps them out of results, and a crawler can only read it on a page
// robots.txt lets it fetch. Without ALLOW_INDEXING, search engines stay out entirely.
import type { APIRoute } from 'astro';
import { INDEXING, SITE } from '../site';

export const GET: APIRoute = () =>
  new Response(
    INDEXING ? `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap-index.xml\n` : 'User-agent: *\nDisallow: /\n',
  );
