// The home-screen icon: the favicon at 180px.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FAVICON = join(process.cwd(), 'public', 'favicon.svg');

export const GET: APIRoute = async () => {
  const png = await sharp(readFileSync(FAVICON)).resize(180, 180).flatten({ background: '#16271F' }).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { 'content-type': 'image/png' } });
};
