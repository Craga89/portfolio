// The contact card (vCard 3.0: CRLF line endings, long lines folded at 75 octets), with the portrait.
import type { APIRoute } from 'astro';
import sharp from 'sharp';
import { join } from 'node:path';
import { EMAIL, GITHUB, LINKEDIN, NAME, SITE } from '../site';

const PORTRAIT = join(process.cwd(), 'src', 'assets', 'portrait.webp');

const fold = (line: string) => {
  const out: string[] = [];
  let rest = Buffer.from(line, 'utf8');
  out.push(rest.subarray(0, 75).toString('utf8'));
  rest = rest.subarray(75);
  while (rest.length) {
    out.push(' ' + rest.subarray(0, 74).toString('utf8'));
    rest = rest.subarray(74);
  }
  return out.join('\r\n');
};

export const GET: APIRoute = async () => {
  const photo = (
    await sharp(PORTRAIT).resize(192, 192).flatten({ background: '#FFFFFF' }).jpeg({ quality: 78 }).toBuffer()
  ).toString('base64');
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Thompson;Craig;Michael;;',
    `FN:${NAME}`,
    'TITLE:Head of Engineering',
    `EMAIL;TYPE=INTERNET,PREF:${EMAIL}`,
    `URL:${SITE}/`,
    'ADR;TYPE=HOME:;;;Newcastle upon Tyne;;;United Kingdom',
    `X-SOCIALPROFILE;TYPE=linkedin:${LINKEDIN}`,
    `X-SOCIALPROFILE;TYPE=github:${GITHUB}`,
    'NOTE:Hands-on\\, AI-first Head of Engineering and full-stack engineer. Open to new roles.',
    `PHOTO;ENCODING=b;TYPE=JPEG:${photo}`,
    'END:VCARD',
  ];
  return new Response(lines.map(fold).join('\r\n') + '\r\n', { headers: { 'content-type': 'text/vcard' } });
};
