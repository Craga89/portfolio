// security.txt (RFC 9116): where to report a security problem with the site.
import type { APIRoute } from 'astro';
import { EMAIL, SITE } from '../../site';

export const GET: APIRoute = () => {
  const expires = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 19) + 'Z';
  return new Response(
    `Contact: mailto:${EMAIL}\nExpires: ${expires}\nPreferred-Languages: en\nCanonical: ${SITE}/.well-known/security.txt\n`,
  );
};
