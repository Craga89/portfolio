// Screenshot comparison for the built site: catches unintended visual changes.
//   node tools/visual.mjs --out shots            take screenshots
//   node tools/visual.mjs --out shots --baseline baselines --diff diffs
//       compare against baselines; exits 1 if any differ by more than 0.1% of pixels
// Needs playwright, pixelmatch and pngjs (installed by the CI workflow).
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const OUT = arg('--out') || 'shots';
const BASE = arg('--baseline');
const DIFF = arg('--diff') || 'diffs';
mkdirSync(OUT, { recursive: true });

const SITE = join(ROOT, 'site');
const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = join(SITE, p); if (!existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); r.end(readFileSync(f)); });
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}/`;

// Things that change on their own (clock, build stamp) or float over content (chat bar) are hidden.
const STEADY = '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important} html{scroll-behavior:auto!important} .v2-time,.v2-ver,.c-chat{visibility:hidden!important}';
const VIEWS = [
  { name: 'home-desktop-dark', w: 1440, h: 900, scheme: 'dark' },
  { name: 'home-desktop-light', w: 1440, h: 900, scheme: 'light' },
  { name: 'home-mobile-dark', w: 390, h: 844, scheme: 'dark', mobile: true },
  { name: 'home-mobile-light', w: 390, h: 844, scheme: 'light', mobile: true },
  { name: 'home-fold', w: 616, h: 816, scheme: 'light', mobile: true },
  { name: 'career', w: 1440, h: 900, scheme: 'dark', el: '#career' },
  { name: 'responsibilities', w: 1440, h: 900, scheme: 'dark', el: '#responsibilities' },
  { name: 'case-studies', w: 1440, h: 900, scheme: 'light', el: '#case-studies' },
  { name: 'stack', w: 1440, h: 900, scheme: 'dark', el: '#stack' },
  { name: 'faq', w: 1440, h: 900, scheme: 'light', el: '#faq' },
  { name: 'cv', w: 1100, h: 900, scheme: 'light', path: 'cv/', full: true },
];

const browser = await chromium.launch();
for (const v of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: v.scheme, reducedMotion: 'reduce', isMobile: !!v.mobile, hasTouch: !!v.mobile, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(base + (v.path || ''), { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: STEADY });
  await page.evaluate(() => { document.documentElement.classList.add('cv-all'); return document.fonts.ready; });
  await page.waitForTimeout(300);
  const file = join(OUT, v.name + '.png');
  if (v.el) { await page.locator(v.el).scrollIntoViewIfNeeded(); await page.waitForTimeout(150); await page.locator(v.el).screenshot({ path: file }); }
  else await page.screenshot({ path: file, fullPage: !!v.full });
  await ctx.close();
}
await browser.close();
srv.close();
console.log(`took ${VIEWS.length} screenshots in ${OUT}`);

if (BASE) {
  const pixelmatch = (await import('pixelmatch')).default;
  const { PNG } = (await import('pngjs')).default || (await import('pngjs'));
  mkdirSync(DIFF, { recursive: true });
  const rows = [];
  let failed = 0;
  for (const v of VIEWS) {
    const bf = join(BASE, v.name + '.png');
    if (!existsSync(bf)) { rows.push([v.name, 'new (no baseline)', '']); continue; }
    const a = PNG.sync.read(readFileSync(bf));
    const b = PNG.sync.read(readFileSync(join(OUT, v.name + '.png')));
    if (a.width !== b.width || a.height !== b.height) { failed++; rows.push([v.name, `size changed ${a.width}×${a.height} → ${b.width}×${b.height}`, '❌']); continue; }
    const d = new PNG({ width: a.width, height: a.height });
    const n = pixelmatch(a.data, b.data, d.data, a.width, a.height, { threshold: 0.12 });
    const pct = (n / (a.width * a.height)) * 100;
    const bad = pct > 0.1;
    if (bad) { failed++; writeFileSync(join(DIFF, v.name + '.png'), PNG.sync.write(d)); }
    rows.push([v.name, `${pct.toFixed(3)}% of pixels differ`, bad ? '❌' : '✅']);
  }
  const md = `## Screenshot comparison: ${VIEWS.length - failed}/${VIEWS.length} match\n\n| view | result | |\n|---|---|---|\n${rows.map((r) => `| ${r.join(' | ')} |`).join('\n')}\n\n${failed ? 'Diff images are attached to this run. If the change is intended, push a commit with `[visual]` in its message to accept the new look.\n' : ''}`;
  console.log(md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  process.exit(failed ? 1 : 0);
}
