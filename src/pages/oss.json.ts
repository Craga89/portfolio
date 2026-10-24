// The open-source counts this build was made with (the oss branch's snapshot), for the page's
// agent tools when live.json has none.
import type { APIRoute } from 'astro';
import { ossSnapshot } from '../lib/oss';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(ossSnapshot() ?? {}), { headers: { 'content-type': 'application/json' } });
