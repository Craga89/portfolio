// Build steps that need the finished site, run in a browser against it: ask.sh's search index
// (and the worker's copy), the social preview images, the PDF CV and the service worker.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve } from '../tools/lib/serve.mjs';
import { homePassages, postPassage } from './passages.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const WORKER = join(ROOT, 'worker');

/** @returns {import('astro').AstroIntegration} */
export function postBuild() {
  return {
    name: 'craigthompson:post-build',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const out = fileURLToPath(dir);
        const { chromium } = await import('playwright');
        const srv = await serve(out);
        const browser = await chromium.launch();
        try {
          await askIndex(browser, srv.url, out, logger);
          await ogImages(browser, srv.url, out, logger);
          await cvPdf(browser, srv.url, out);
        } finally {
          await browser.close();
          srv.close();
        }
        serviceWorker(out);
        logger.info('post-build: done');
      },
    },
  };
}

/**
 * ask.sh's index (site/assets/ask-index.json), and the worker's copies of it and of what its MCP
 * tools serve (worker/knowledge.json, worker/agent-data.json).
 * @param {import('playwright').Browser} browser @param {string} base @param {string} out @param {import('astro').AstroIntegrationLogger} logger
 */
async function askIndex(browser, base, out, logger) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'dark' });
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base, { waitUntil: 'load' });
  if (errors.length) throw new Error('page errors on the home page:\n' + errors.join('\n'));
  const passages = await page.evaluate(homePassages);
  const projects = await page.evaluate(() =>
    [...new Map([...document.querySelectorAll('#oss a[href^="https://github.com/"]')].map((a) => [/** @type {HTMLAnchorElement} */ (a).href.replace(/\/$/, ''), (a.textContent || '').trim()]))].map(([url, name]) => ({ name, url })),
  );
  const posts = readdirSync(join(out, 'blog'), { withFileTypes: true }).filter((d) => d.isDirectory());
  for (const d of posts) {
    await page.goto(`${base}blog/${d.name}/`, { waitUntil: 'domcontentloaded' });
    passages.push(await page.evaluate(postPassage));
  }
  await page.close();

  const index = { generated: new Date().toISOString(), passages };
  writeFileSync(join(out, 'assets', 'ask-index.json'), JSON.stringify(index));
  mkdirSync(WORKER, { recursive: true });
  writeFileSync(join(WORKER, 'knowledge.json'), JSON.stringify(index, null, 1) + '\n');
  // Keep the last open-source snapshot if this build can't read the oss branch.
  const prev = existsSync(join(WORKER, 'agent-data.json')) ? JSON.parse(readFileSync(join(WORKER, 'agent-data.json'), 'utf8')) : null;
  const cv = JSON.parse(readFileSync(join(ROOT, 'src', 'cv.json'), 'utf8'));
  writeFileSync(join(WORKER, 'agent-data.json'), JSON.stringify({ cv, projects, oss: ossSnapshot() ?? prev?.oss ?? null }, null, 1) + '\n');
  logger.info(`ask.sh index: ${passages.length} passages, ${passages.reduce((n, p) => n + p.text.length, 0)} chars`);
}

/** The open-source snapshot from the oss branch, or null without it. */
function ossSnapshot() {
  try {
    return JSON.parse(execFileSync('git', ['show', 'origin/oss:reports/oss.json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  } catch {
    return null;
  }
}

/**
 * Screenshot each card under /og-card/ (see src/lib/og.ts) to its page's og.png, then remove the cards.
 * @param {import('playwright').Browser} browser @param {string} base @param {string} out @param {import('astro').AstroIntegrationLogger} logger
 */
async function ogImages(browser, base, out, logger) {
  const sharp = (await import('sharp')).default;
  const cards = join(out, 'og-card');
  /** @type {string[]} */
  const paths = [];
  const walk = (/** @type {string} */ rel) => {
    for (const d of readdirSync(join(cards, rel), { withFileTypes: true }))
      if (d.isDirectory()) walk(rel + d.name + '/');
      else if (d.name === 'index.html') paths.push(rel);
  };
  walk('');
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const rel of paths) {
    await page.goto(`${base}og-card/${rel}`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const target = rel === 'home/' ? '' : rel;
    mkdirSync(join(out, target), { recursive: true });
    const png = await sharp(await page.screenshot({ type: 'png' })).png({ palette: true, quality: 90, effort: 10 }).toBuffer();
    writeFileSync(join(out, target, 'og.png'), png);
  }
  await page.close();
  rmSync(cards, { recursive: true, force: true });
  logger.info(`social images: ${paths.length}`);
}

/** The plain CV as a PDF, printed with the page's own print styles. @param {import('playwright').Browser} browser @param {string} base @param {string} out */
async function cvPdf(browser, base, out) {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.goto(base + 'cv/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(out, 'cv.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  await page.close();
}

/**
 * The service worker: network first for pages (always fresh online), cache first for hashed and
 * static assets, and the home page, CV and the files every page needs cached on install.
 * @param {string} out
 */
function serviceWorker(out) {
  const home = readFileSync(join(out, 'index.html'), 'utf8');
  // What the home page loads up front: its scripts, styles and fonts.
  const assets = [...new Set([...home.matchAll(/(?:src|href)="\/(assets\/[^"]+\.(?:js|css|woff2))"/g)].map((m) => m[1]))];
  const core = ['./', 'cv/', ...assets, 'favicon.svg'];
  const version = createHash('sha256').update(core.join('|') + home).digest('hex').slice(0, 10);
  writeFileSync(
    join(out, 'sw.js'),
    `// Generated by integrations/post-build.mjs
const CACHE = 'craga-${version}';
const CORE = ${JSON.stringify(core)};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate' || url.pathname.endsWith('/live.json')) {
    // Pages and live CI results: network first so they're never stale online; cached copy offline.
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('./') : Response.error()))));
    return;
  }
  // Assets: cache first, then network (and keep a copy).
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`,
  );
}
