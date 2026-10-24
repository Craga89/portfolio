// Search engines stay out until the content is finished (ALLOW_INDEXING=true opens it up).
import type { APIRoute } from 'astro';
import { INDEXING, SITE } from '../site';

export const GET: APIRoute = () =>
  new Response(
    INDEXING ? `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap-index.xml\n` : 'User-agent: *\nDisallow: /\n',
  );
