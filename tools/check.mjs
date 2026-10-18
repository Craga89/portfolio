// Smoke test for the built site: screenshots + interaction checks.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site');
const SHOTS = process.argv[2] || join(ROOT, 'shots');
mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };
const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = join(OUT, p);
  if (!existsSync(f)) { res.writeHead(404); res.end(readFileSync(join(OUT, '404.html'))); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch();
const results = [];
const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_TUNNEL|ERR_NAME|ERR_CONNECTION|ERR_FAILED/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(SHOTS, 'desktop-top.png') });

  // case-study tabs
  const tabs = page.locator('#case-studies [role="tab"]');
  const n = await tabs.count();
  ok('case-study tabs present', n >= 8, String(n));
  await tabs.nth(2).click();
  // Tab switches cross-fade with a view transition, so the new state lands a frame or two later.
  await page.waitForFunction(() => document.querySelectorAll('#case-studies [role="tab"]')[2].getAttribute('aria-selected') === 'true', null, { timeout: 3000 }).catch(() => {});
  ok('case-study tab selects', (await tabs.nth(2).getAttribute('aria-selected')) === 'true');

  // stack search
  const input = page.locator('#stack input');
  await input.click();
  await input.type('aws', { delay: 20 });
  await page.waitForTimeout(150);
  ok('search keeps focus while typing', await input.evaluate((el) => document.activeElement === el));
  ok('search value kept', (await input.inputValue()) === 'aws');
  const marks = await page.locator('#stack mark').count();
  ok('search highlights matches', marks > 0, String(marks));
  await page.locator('#stack').screenshot({ path: join(SHOTS, 'stack-search.png') });

  // responsibilities tour
  const segs = page.locator('#responsibilities .c-seg');
  ok('tour segments', (await segs.count()) === 12);
  await segs.nth(4).click();
  await page.waitForTimeout(200);
  ok('tour jumps to segment', (await segs.nth(4).getAttribute('aria-selected')) === 'true');
  const det = page.locator('#rp-aiproc details');
  await det.locator('summary').click();
  await page.waitForTimeout(200);
  ok('details stays open after re-render', await det.evaluate((d) => d.open));
  await page.locator('#responsibilities').screenshot({ path: join(SHOTS, 'tour.png') });

  // sidebar nav scroll + active
  await page.locator('.v2-tree a[href="#faq"]').click();
  await page.waitForTimeout(1200);
  ok('sidebar marks faq active', (await page.locator('.v2-tree a[href="#faq"]').getAttribute('aria-current')) === 'true');
  const faqTop = await page.locator('#faq').evaluate((el) => el.getBoundingClientRect().top);
  ok('faq scrolled into view', faqTop >= 0 && faqTop < 200, String(Math.round(faqTop)));

  // theme toggle
  const wasLight = await page.locator('#app .c-root').evaluate((el) => el.classList.contains('c-light'));
  await page.locator('.v2-side .c-theme').click();
  await page.waitForTimeout(300);
  const nowLight = await page.locator('#app .c-root').evaluate((el) => el.classList.contains('c-light'));
  ok('theme toggles', nowLight !== wasLight, wasLight + ' -> ' + nowLight);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SHOTS, 'desktop-light.png') });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  ok('theme choice remembered', (await page.locator('#app .c-root').evaluate((el) => el.classList.contains('c-light'))) === nowLight);
  // ask.sh (search mode: no endpoint in a local build)
  await page.locator('#c-ask-field').fill('Has he been through an acquisition?');
  await page.locator('#c-ask-field').press('Enter');
  await page.waitForTimeout(800);
  const askLog = await page.locator('#ask .c-ask-log').innerText();
  ok('ask.sh answers from the site', /acqui/i.test(askLog) && (await page.locator('#ask .c-ask-log a').count()) > 0);
  ok('ask.sh clears the field', (await page.locator('#c-ask-field').inputValue()) === '');
  ok('no page errors', errors.length === 0, errors.join(' | '));

  // full page
  await page.evaluate(() => { try { localStorage.removeItem('theme'); } catch (e) {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(SHOTS, 'desktop-full.png'), fullPage: true });

  // no-JS: content present
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const p2 = await nojs.newPage();
  await p2.goto(base + '/');
  // textContent, not innerText: offscreen sections skip rendering (content-visibility) but stay in the page.
  const txt = await p2.locator('#app').evaluate((el) => el.textContent);
  ok('content readable without JavaScript', /Craig Michael Thompson/.test(txt) && /hiring\.md/.test(txt) && /monorepo/.test(txt), txt.length + ' chars');

  // mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await m.goto(base + '/', { waitUntil: 'networkidle' });
  await m.waitForTimeout(500);
  await m.screenshot({ path: join(SHOTS, 'mobile-top.png') });
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('no horizontal scroll on mobile', overflow <= 1, String(overflow));

  // WebMCP: a stand-in modelContext records the tools the page registers, then each one is called.
  const ag = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await ag.addInitScript(() => {
    window.__tools = [];
    window.__aborted = 0;
    Object.defineProperty(document, 'modelContext', { configurable: true, value: { registerTool(t, o) { window.__tools.push(t); if (o && o.signal) o.signal.addEventListener('abort', () => { window.__aborted++; }); return Promise.resolve(); } } });
  });
  // Never send test questions to the real ask.sh service.
  let asked = 0;
  await ag.route(/\/ask(\?|$)/, (r) => { asked++; r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'Stub answer.', sources: ['intro'] }) }); });
  await ag.goto(base + '/', { waitUntil: 'networkidle' });
  await ag.waitForFunction(() => window.__tools.length > 0, null, { timeout: 5000 }).catch(() => {});
  const ar = await ag.evaluate(async () => {
    const T = {}; window.__tools.forEach((t) => { T[t.name] = t; });
    const call = async (n, i) => { const r = await T[n].execute(i || {}, { signal: new AbortController().signal }); const txt = r && r.content && r.content[0] ? r.content[0].text : ''; let data = null; try { data = JSON.parse(txt); } catch (e) {} return { err: !!(r && r.isError), txt, data }; };
    const shape = window.__tools.every((t) => /^[a-z_]+$/.test(t.name) && t.description && t.description.length > 30 && t.inputSchema && t.inputSchema.type === 'object' && typeof t.execute === 'function' && t.annotations && typeof t.annotations.readOnlyHint === 'boolean');
    const out = { names: window.__tools.map((t) => t.name), unique: new Set(window.__tools.map((t) => t.name)).size === window.__tools.length, shape };
    out.profile = await call('get_profile');
    out.career = await call('get_career');
    out.list = await call('list_files');
    out.listCase = await call('list_files', { section: 'case-studies' });
    out.read = await call('read_file', { file: 'ai/platform.md', show: true });
    out.missing = await call('read_file', { file: 'nope.md' });
    out.search = await call('search_site', { query: 'AWS cost' });
    out.ask = await call('ask', { question: 'What does Craig do?' });
    out.oss = await call('get_open_source');
    out.report = await call('get_site_report');
    out.show = await call('show_section', { section: 'faq' });
    await new Promise((r) => setTimeout(r, 1500));
    out.tabAi = !!document.querySelector('#case-studies [role="tab"][aria-selected="true"]') && /platform/.test(document.querySelector('#case-studies [role="tab"][aria-selected="true"]').textContent);
    const faq = document.getElementById('faq').getBoundingClientRect().top;
    out.faqInView = faq > -50 && faq < window.innerHeight / 2;
    window.dispatchEvent(new Event('pagehide'));
    out.aborted = window.__aborted;
    return out;
  });
  const d = (k) => (ar[k] && ar[k].data) || {};
  ok('webmcp registers 9 tools, well-formed', ar.names.length === 9 && ar.unique && ar.shape, ar.names.join(' '));
  ok('webmcp get_profile', d('profile').name === 'Craig Michael Thompson' && /@/.test(d('profile').email || '') && /cv\.pdf$/.test((d('profile').links || {}).cv_pdf || ''));
  ok('webmcp get_career', (d('career').work || []).length >= 3 && (d('career').education || []).length >= 1);
  ok('webmcp list_files', Array.isArray(ar.list.data) && ar.list.data.length === 24 && ar.listCase.data.length === 12 && ar.list.data.every((f) => /\/(case-studies|responsibilities)\/[\w-]+\/$/.test(f.url)), String(ar.list.data && ar.list.data.length));
  ok('webmcp read_file (and show)', !ar.read.err && d('read').text.length > 200 && ar.tabAi && ar.missing.err && /monorepo\.md/.test(ar.missing.txt));
  ok('webmcp search_site', (d('search').results || []).length > 0);
  ok('webmcp ask (stubbed service)', d('ask').answer === 'Stub answer.' && d('ask').via === 'ai' && asked === 1, JSON.stringify(d('ask')).slice(0, 120));
  ok('webmcp get_open_source', d('oss').merged_pull_requests > 0 && (d('oss').by_quarter || []).length > 0);
  ok('webmcp get_site_report', /github\.com\/Craga89\/portfolio/.test(d('report').source || ''));
  ok('webmcp show_section', !ar.show.err && ar.faqInView);
  ok('webmcp tools unregister on pagehide', ar.aborted === 9, String(ar.aborted));
  await ag.close();

  // CV + 404
  const cv = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  await cv.goto(base + '/cv/', { waitUntil: 'networkidle' });
  await cv.screenshot({ path: join(SHOTS, 'cv.png') });
  ok('cv renders', /experience/i.test(await cv.locator('body').innerText()));
  await cv.goto(base + '/nope', { waitUntil: 'networkidle' });
  await cv.screenshot({ path: join(SHOTS, '404.png') });
} finally {
  await browser.close();
  srv.close();
}
console.log(results.join('\n'));
