// Speculation rules: load these pages ahead of a click (on hover or touch). Sent to every page by
// the Speculation-Rules response header (cloudflare/_headers) rather than written into each page,
// where Google read the URL patterns (/blog/*) as addresses and crawled them, getting 404s.
import type { APIRoute } from 'astro';
import { url } from '../lib/url';

export const RULES = {
  prerender: [
    {
      source: 'document',
      where: {
        or: ['/', '/cv/', '/blog/*', '/case-studies/*', '/responsibilities/*'].map((p) => ({ href_matches: url(p) })),
      },
      eagerness: 'moderate',
    },
  ],
};

export const GET: APIRoute = () =>
  new Response(JSON.stringify(RULES) + '\n', { headers: { 'content-type': 'application/speculationrules+json' } });
