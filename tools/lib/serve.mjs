// A small static file server for the built site, used by the build (to prerender the page) and
// by the end-to-end tests. Serves index.html for directories and the site's 404 page for anything
// missing, and, from the command line, the live site's response headers (cloudflare/_headers).
//   node tools/lib/serve.mjs [dir=site] [port=4173]
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { headersFor, parseHeaders } from './headers.mjs';

/** @type {Record<string, string>} */
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

/**
 * Serve `dir` on 127.0.0.1.
 * @param {string} dir
 * @param {number} [port] 0 picks a free port
 * @param {string} [base] the path the site is mounted under, such as /preview/x/
 * @param {string} [headers] the text of a _headers file whose rules to apply
 * @returns {Promise<http.Server & { url: string }>}
 */
export function serve(dir, port = 0, base = '/', headers = '') {
  const root = resolve(dir);
  const rules = parseHeaders(headers);
  const prefix = base.replace(/\/?$/, '/');
  const server = http.createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    const inside = (path + '/').startsWith(prefix);
    let file = join(root, inside ? path.slice(prefix.length) : '');
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!inside || !existsSync(file)) {
      const notFound = join(root, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found');
      return;
    }
    const extra = headersFor(rules, '/' + path.slice(prefix.length));
    // _headers is written for a site at /: under a base path, the rules file is under it too.
    if (extra['speculation-rules'])
      extra['speculation-rules'] = extra['speculation-rules'].replaceAll('"/', `"${prefix}`);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', ...extra });
    res.end(readFileSync(file));
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}${prefix}`;
      done(Object.assign(server, { url }));
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const file = fileURLToPath(new URL('../../cloudflare/_headers', import.meta.url));
  const headers = existsSync(file) ? readFileSync(file, 'utf8') : '';
  const server = await serve(process.argv[2] || 'site', Number(process.argv[3] || 4173), process.argv[4], headers);
  console.log(`serving ${process.argv[2] || 'site'} at ${server.url}`);
}
