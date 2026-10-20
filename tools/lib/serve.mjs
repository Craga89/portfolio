// A small static file server for the built site, used by the build (to prerender the page) and
// by the end-to-end tests. Serves index.html for directories and the site's 404 page for anything
// missing, like GitHub Pages.
//   node tools/lib/serve.mjs [dir=site] [port=4173]
import http from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
 * @returns {Promise<http.Server & { url: string }>}
 */
export function serve(dir, port = 0) {
  const root = resolve(dir);
  const server = http.createServer((req, res) => {
    let path;
    try {
      path = decodeURIComponent(new URL(req.url || '/', 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = join(root, path);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html');
    if (!existsSync(file)) {
      const notFound = join(root, '404.html');
      res.writeHead(404, { 'content-type': TYPES['.html'] });
      res.end(existsSync(notFound) ? readFileSync(notFound) : 'Not found');
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(readFileSync(file));
  });
  return new Promise((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      const address = server.address();
      const url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : port}/`;
      done(Object.assign(server, { url }));
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await serve(process.argv[2] || 'site', Number(process.argv[3] || 4173));
  console.log(`serving ${process.argv[2] || 'site'} at ${server.url}`);
}
