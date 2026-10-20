// Smoke test for the built site: screenshots + interaction checks.
import { chromium } from 'playwright';
import http from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import { translatorStub } from './translator-stub.mjs';
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
  // The switch cross-fades with a view transition, so wait for it to land.
  await page.waitForFunction(() => document.querySelectorAll('#responsibilities .c-seg')[4].getAttribute('aria-selected') === 'true', null, { timeout: 3000 }).catch(() => {});
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
    out.badArgs = await call('search_site', { query: 42 });
    out.noShowOnMcp = !!T.read_file.inputSchema.properties.show;
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
  const lf = (x) => (x && x.data && x.data.files) || [];
  ok('webmcp list_files', lf(ar.list).length === 26 + (await page.evaluate(() => (window.CRAGA_POSTS || []).length)) && lf(ar.listCase).length === 14 && lf(ar.list).every((f) => /\/(case-studies|responsibilities|blog)\/[\w-]+\/$/.test(f.url)), String(lf(ar.list).length));
  ok('webmcp read_file (and show)', !ar.read.err && d('read').text.length > 200 && ar.tabAi && ar.missing.err && /monorepo\.md/.test(ar.missing.txt));
  ok('webmcp search_site', (d('search').results || []).length > 0 && ar.badArgs.err && /string/.test(ar.badArgs.txt));
  ok('webmcp page-only arguments present (show)', ar.noShowOnMcp);
  ok('webmcp ask (stubbed service)', d('ask').answer === 'Stub answer.' && d('ask').via === 'ai' && asked === 1, JSON.stringify(d('ask')).slice(0, 120));
  ok('webmcp get_open_source', d('oss').merged_pull_requests > 0 && (d('oss').by_quarter || []).length > 0);
  ok('webmcp get_site_report', /github\.com\/Craga89\/portfolio/.test(d('report').source || ''));
  ok('webmcp show_section', !ar.show.err && ar.faqInView);
  ok('webmcp tools unregister on pagehide', ar.aborted === 9, String(ar.aborted));
  await ag.close();

  // Read-aloud: the natural voice plays faster with its pitch kept; over the day's AI budget the
  // browser's own voice takes over; ask.sh says why it's using search.
  {
    const wav = (() => { const n = 4000, b = Buffer.alloc(44 + n * 2); b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(8000, 24); b.writeUInt32LE(16000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40); return b; })();
    for (const over of [false, true]) {
      const vc = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      await vc.addInitScript(() => {
        window.__spoken = [];
        const S = window.speechSynthesis;
        if (S) { S.speak = (u) => { window.__spoken.push({ rate: u.rate, lang: u.lang }); setTimeout(() => { if (u.onstart) u.onstart(); if (u.onend) u.onend(); }, 50); }; S.cancel = () => {}; }
      });
      await vc.route(/\/ask(\?|$)/, (r) => r.fulfill(over ? { status: 503, contentType: 'application/json', body: '{"error":"budget"}' } : { status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'He has led engineering teams for twelve years.', sources: ['intro'] }) }));
      await vc.route(/\/speak(\?|$)/, (r) => r.fulfill(over ? { status: 503, contentType: 'application/json', body: '{"error":"budget"}' } : { status: 200, contentType: 'audio/wav', body: wav }));
      const vp = await vc.newPage();
      await vp.goto(base + '/#ask', { waitUntil: 'networkidle' });
      await vp.fill('#c-ask-field', 'How long has he led teams?');
      await vp.press('#c-ask-field', 'Enter');
      await vp.waitForSelector('.c-ask-log .c-say', { timeout: 10000 });
      if (over) {
        const note = await vp.locator('.c-ask-log').innerText();
        ok("read-aloud: over the AI budget, ask.sh says why it's using search", /today's free AI allowance/.test(note));
      }
      await vp.locator('.c-ask-log .c-say').first().click();
      await vp.waitForTimeout(1200);
      const v = await vp.evaluate(() => ({ spoken: window.__spoken, rate: window.CRAGA_APP && window.CRAGA_APP.c._audio ? window.CRAGA_APP.c._audio.playbackRate : null, pitch: window.CRAGA_APP && window.CRAGA_APP.c._audio ? window.CRAGA_APP.c._audio.preservesPitch : null, idle: !document.querySelector('.c-say[data-on="true"]') }));
      if (over) ok('read-aloud: over budget, the browser voice reads it, a little faster', v.spoken.length === 1 && v.spoken[0].rate > 1, JSON.stringify(v.spoken));
      else ok('read-aloud: natural voice at 1.15×, pitch kept, button resets', v.rate === 1.15 && v.pitch === true && !v.spoken.length && v.idle, JSON.stringify(v));
      await vc.close();
    }
  }

  // The browser's own page translation (Chrome Translate swaps each text node for a translated
  // copy wrapped in <font>) has to survive scrolling, tab switches and the page's own updates.
  {
    const gp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await gp.goto(base + '/', { waitUntil: 'networkidle' });
    await gp.waitForTimeout(300);
    await gp.evaluate(() => {
      document.documentElement.classList.add('translated-ltr');
      const tw = document.createTreeWalker(document.getElementById('app'), NodeFilter.SHOW_TEXT);
      const nodes = [];
      for (let n = tw.nextNode(); n; n = tw.nextNode()) if (/\p{L}{2}/u.test(n.data)) nodes.push(n);
      for (const n of nodes) { const f = document.createElement('font'); f.textContent = 'GT:' + n.data; n.replaceWith(f); }
    });
    const fonts = () => gp.evaluate(() => document.querySelectorAll('#app font').length);
    const before = await fonts();
    for (const id of ['career', 'case-studies', 'faq', 'top']) { await gp.evaluate((x) => document.getElementById(x).scrollIntoView(), id); await gp.waitForTimeout(450); }
    await gp.locator('#case-studies [role="tab"]').nth(2).click();
    await gp.waitForTimeout(500);
    const after = await fonts();
    const spy = await gp.evaluate(() => { document.getElementById('career').scrollIntoView(); return new Promise((r) => setTimeout(() => r(document.querySelector('.v2-tree a[aria-current="true"]').getAttribute('href')), 700)); });
    ok('browser page translation survives scrolling and tab switches', after >= before * 0.95 && spy === '#career', `${before} → ${after}, spy ${spy}`);
    await gp.close();
  }

  // On-device translation, with a stand-in for the browser's Translator API.
  const done = (pg) => pg.waitForFunction(() => document.querySelector('.tr-bar') && document.querySelector('.tr-bar').dataset.kind === 'done', null, { timeout: 60000 });
  {
    // Safari and Firefox have no Translator API (Playwright's Chromium does, with no language models).
    const plainCtx = await browser.newContext();
    await plainCtx.addInitScript(() => { delete self.Translator; delete self.LanguageDetector; });
    const plain = await plainCtx.newPage();
    await plain.goto(base + '/', { waitUntil: 'networkidle' });
    ok('translate: nothing loads without the API', (await plain.evaluate(() => !window.CRAGA_I18N && !document.querySelector('.v2-lang-s, .tr-offer'))));
    await plainCtx.close();
    const en = await browser.newContext({ locale: 'en-GB' });
    await en.addInitScript(translatorStub);
    const ep = await en.newPage();
    await ep.goto(base + '/', { waitUntil: 'networkidle' });
    await ep.waitForTimeout(300);
    ok('translate: English browsers get the menu, not the offer', (await ep.locator('.tr-offer').count()) === 0 && (await ep.locator('.v2-side .v2-lang-s').count()) === 1 && (await ep.evaluate(() => !document.querySelector('script[src*="i18n."]') && window.__trCalls === 0)));
    // A question in German on the English page: the answer comes back in German, and says it was machine-translated.
    await ep.route(/\/ask(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'He has led engineering teams. See leadership.md.', sources: ['intro'] }) }));
    await ep.fill('#c-ask-field', 'Welche Erfahrung hat er mit Teams?');
    await ep.press('#c-ask-field', 'Enter');
    await ep.waitForFunction(() => /«de»/.test((document.querySelector('.c-ask-log .c-ask-a:last-of-type') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
    const am = await ep.evaluate(() => [...document.querySelectorAll('.c-ask-log .c-ask-a')].pop().textContent + ' | ' + [...document.querySelectorAll('.c-ask-log .c-ask-meta')].pop().textContent);
    ok('translate: an answer translated back says so', /«de» He has led/.test(am) && /Machine-translated from English by your browser/.test(am), am.slice(0, 160));
    await en.close();

    const de = await browser.newContext({ locale: 'de-DE', viewport: { width: 1280, height: 900 } });
    await de.addInitScript(translatorStub);
    await de.route(/\/ask(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ answer: 'He has led engineering teams. See leadership.md.', sources: ['intro'] }) }));
    const tp = await de.newPage();
    const terr = []; tp.on('pageerror', (e) => terr.push(e.message));
    await tp.goto(base + '/', { waitUntil: 'networkidle' });
    await tp.waitForTimeout(300);
    ok('translate: offered in the visitor\'s language', /Diese Seite auf Deutsch lesen\?/.test(await tp.locator('.tr-offer').innerText().catch(() => '')));
    await tp.getByRole('button', { name: 'Übersetzen' }).click();
    await done(tp);
    const t1 = await tp.evaluate(() => {
      const app = document.getElementById('app');
      const text = [...app.querySelectorAll('p, li, h2, h3')].filter((e) => e.offsetParent && /\p{L}{3}/u.test(e.textContent) && !/^[\w./@-]+$/.test(e.textContent.trim()) && !e.closest('[translate="no"]') && !e.querySelector('[translate="no"]'));
      return {
        lang: document.documentElement.lang,
        untranslated: text.filter((e) => !/«de»/.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 50)),
        kept: document.querySelector('h1').textContent === 'Craig Michael Thompson' && [...document.querySelectorAll('.c-see')].every((a) => !/«/.test(a.textContent)) && /^\$ cat README\.md/.test(document.querySelector('.c-cmd').textContent),
        title: /^«de» Craig Michael Thompson/.test(document.title),
        menu: document.querySelector('.v2-side .v2-lang-s').value,
      };
    });
    ok('translate: the page translates, names and files kept', t1.lang === 'de' && !t1.untranslated.length && t1.kept && t1.title && t1.menu === 'de', JSON.stringify(t1.untranslated.slice(0, 3)));
    // It's clear this is machine translation by the browser, not a person's.
    const disc = await tp.evaluate(() => ({ bar: document.querySelector('.tr-bar [role="status"]').textContent, side: !!document.querySelector('.v2-side .v2-lang-mt') }));
    await tp.locator('.tr-info').click();
    await tp.waitForTimeout(150);
    const pop = await tp.evaluate(() => { const p = document.getElementById('tr-about'); const r = p.getBoundingClientRect(); const b = document.querySelector('.tr-info').getBoundingClientRect(); return { open: p.matches(':popover-open'), text: p.textContent, near: Math.abs(r.top - b.bottom) < 24, inView: r.left >= 0 && r.right <= innerWidth }; });
    await tp.keyboard.press('Escape');
    ok('translate: says it is machine translation by the browser', /Maschinelle Übersetzung durch Ihren Browser/.test(disc.bar) && disc.side && pop.open && /built-in translation model/.test(pop.text) && pop.near && pop.inView, JSON.stringify({ disc, pop: Object.assign({}, pop, { text: pop.text.slice(0, 40) }) }));
    const idle = await tp.evaluate(() => new Promise((res) => { let n = 0; const mo = new MutationObserver((l) => { n += l.length; }); mo.observe(document.getElementById('app'), { subtree: true, childList: true, characterData: true, attributes: true }); setTimeout(() => { mo.disconnect(); res(n); }, 2000); }));
    ok('translate: no flicker back to English (idle page unchanged)', idle === 0, String(idle));
    // The stand-in drops the markup tokens for text mentioning "monorepo": the intro paragraph's
    // highlighted phrases must survive as working buttons, each translated on its own.
    const fb = await tp.evaluate(() => { const p = [...document.querySelectorAll('#app p')].find((x) => /monorepo/i.test(x.textContent) && x.querySelector('button.v2-x')); if (!p) return null; const bs = [...p.querySelectorAll('button.v2-x')]; return { n: bs.length, all: bs.every((x) => /^«de»/.test(x.textContent) && x.hasAttribute('data-dc-click')) }; });
    ok('translate: lost tokens fall back, markup kept', fb && fb.n >= 2 && fb.all, JSON.stringify(fb));
    await tp.locator('#case-studies [role="tab"]').nth(4).click();
    await tp.waitForTimeout(600);
    const tab = await tp.locator('#case-studies [role="tabpanel"]:visible h3').first().innerText();
    ok('translate: switching tabs stays translated', /^«de»/.test(tab), tab.slice(0, 50));
    await tp.fill('#c-ask-field', 'Welche Erfahrung hat er mit Teams?');
    await tp.press('#c-ask-field', 'Enter');
    await tp.waitForTimeout(1500);
    const ans = await tp.locator('.c-ask-log .c-ask-a').last().innerText();
    ok('translate: ask.sh in German (question to English, answer back)', /«de» He has led engineering teams/.test(ans) && /leadership\.md/.test(ans), ans.slice(0, 80));
    await tp.getByRole('button', { name: /Show original/ }).click();
    await tp.waitForTimeout(400);
    ok('translate: "Show original" restores English', await tp.evaluate(() => document.documentElement.lang === 'en-GB' && !/«/.test(document.getElementById('app').textContent) && !document.querySelector('.tr-bar') && !/«/.test(document.title)));
    // A returning visitor who chose German gets it straight away.
    await tp.evaluate(() => { localStorage.setItem('craga-lang', 'de'); });
    await tp.reload({ waitUntil: 'networkidle' });
    await tp.waitForFunction(() => document.documentElement.lang === 'de', null, { timeout: 15000 }).catch(() => {});
    ok('translate: a returning visitor gets their language without asking', await tp.evaluate(() => document.documentElement.lang === 'de' && !document.querySelector('.tr-offer')));
    ok('translate: no page errors', !terr.length, terr.join(' | '));
    await de.close();

    const no = await browser.newContext({ locale: 'fr-FR' });
    await no.addInitScript(translatorStub);
    const np = await no.newPage();
    await np.goto(base + '/', { waitUntil: 'networkidle' });
    await np.waitForTimeout(300);
    await np.getByRole('button', { name: 'Non merci' }).click();
    await np.reload({ waitUntil: 'networkidle' });
    await np.waitForTimeout(300);
    ok('translate: "no thanks" is remembered', (await np.locator('.tr-offer').count()) === 0);
    await no.close();

    for (const [w, path] of [[1280, ''], [390, ''], [390, 'cv/']]) {
      const ar = await browser.newContext({ locale: 'en-GB', viewport: { width: w, height: 844 }, isMobile: w < 600, hasTouch: w < 600 });
      await ar.addInitScript(translatorStub);
      const ap = await ar.newPage();
      await ap.goto(base + '/' + path, { waitUntil: 'networkidle' });
      await ap.waitForTimeout(300);
      if (path) await ap.selectOption('.v-lang', 'ar'); else await ap.evaluate(() => window.CRAGA_I18N.load().then((m) => m.setLanguage('ar')));
      await done(ap);
      await ap.evaluate(() => document.documentElement.classList.add('cv-all'));
      await ap.waitForTimeout(300);
      const r = await ap.evaluate(() => { const nx = document.querySelector('.c-deck-ctl button[aria-label]:last-child span'); return { dir: document.documentElement.dir, over: document.documentElement.scrollWidth - innerWidth, flipped: !nx || nx.textContent === '←' }; });
      ok(`translate: Arabic is right-to-left, no sideways scroll (${path || 'home'} ${w}px)`, r.dir === 'rtl' && r.over <= 1 && r.flipped, JSON.stringify(r));
      await ar.close();
    }
  }

  // The blog: the home page's list, "show all", every post page and the index.
  {
    const bp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const berr = []; bp.on('pageerror', (e) => berr.push(e.message));
    await bp.goto(base + '/', { waitUntil: 'networkidle' });
    const total = await bp.evaluate(() => (window.CRAGA_POSTS || []).length);
    const first = await bp.locator('#blog .c-bl-i').count();
    const side = await bp.locator('.v2-side a[href="#blog"]').count();
    await bp.locator('#blog .c-bl-b', { hasText: 'show all' }).click();
    await bp.waitForTimeout(300);
    const all = await bp.locator('#blog .c-bl-i').count();
    const hrefs = await bp.$$eval('#blog .c-bl-a', (as) => as.map((a) => a.getAttribute('href')));
    ok('blog: the home page lists the posts, and "show all" shows the rest', total > 8 && first === 8 && all === total && side === 1, `${first} → ${all} of ${total}`);
    const bad = [];
    for (const [w, h] of [[1280, 900], [390, 844]]) {
      await bp.setViewportSize({ width: w, height: h });
      for (const href of w === 1280 ? hrefs.concat(['blog/']) : hrefs.slice(0, 3)) {
        const r = await bp.goto(base + '/' + href, { waitUntil: 'load' });
        const info = await bp.evaluate(() => ({ h1: (document.querySelector('.sp-post h1, h1') || {}).textContent || '', over: document.documentElement.scrollWidth - innerWidth, imgs: [...document.querySelectorAll('.sp-post-b img')].filter((i) => !i.complete || !i.naturalWidth).length }));
        if (!r || r.status() !== 200 || !info.h1.trim() || info.over > 0 || info.imgs) bad.push(`${href} @${w}: ${r && r.status()} over ${info.over} broken images ${info.imgs}`);
      }
    }
    ok('blog: every post page and the index load, with no sideways scroll or broken images', !bad.length && !berr.length, bad.concat(berr).slice(0, 4).join(' | '));
    await bp.close();
  }
  // Between pages: cross-document view transitions (not with reduced motion), valid speculation
  // rules, the reading-progress bar, and the styled language menu.
  {
    const vtOf = async (reduce) => {
      const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: reduce ? 'reduce' : 'no-preference' });
      await c.addInitScript(() => addEventListener('pagereveal', (e) => { try { sessionStorage.setItem('vt', e.viewTransition ? 'yes' : 'no'); } catch (x) {} }));
      const q = await c.newPage();
      const cdp = await c.newCDPSession(q);
      const rules = [];
      await cdp.send('Preload.enable');
      cdp.on('Preload.ruleSetUpdated', (e) => rules.push(e.ruleSet.errorType || 'ok'));
      await q.goto(base + '/blog/', { waitUntil: 'networkidle' });
      await q.locator('.sp-bl a').first().click();
      await q.waitForURL(/\/blog\/[\w-]+\/$/);
      await q.waitForTimeout(500);
      const vt = await q.evaluate(() => sessionStorage.getItem('vt'));
      let prog = null;
      if (!reduce) { await q.mouse.wheel(0, 1200); await q.waitForTimeout(500); prog = await q.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.sp-prog')).transform).a); }
      await c.close();
      return { vt, rules, prog };
    };
    const on = await vtOf(false), off = await vtOf(true);
    ok('pages: a view transition between pages, none with reduced motion; speculation rules valid; reading progress moves', on.vt === 'yes' && off.vt === 'no' && on.rules.length && on.rules.every((r) => r === 'ok') && on.prog > 0.05 && on.prog < 1, JSON.stringify({ on, off }));
    const sp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await sp.goto(base + '/', { waitUntil: 'networkidle' });
    const sel = sp.locator('.v2-side .v2-lang-s');
    const ap = await sel.evaluate((x) => getComputedStyle(x).appearance);
    await sel.click(); await sp.waitForTimeout(200);
    const open = await sel.evaluate((x) => x.matches(':open'));
    await sp.keyboard.press('Escape');
    ok('language menu: a styled list where supported', ap === 'base-select' && open, ap + ' ' + open);
    await sp.close();
  }
  // The stack on phones: one line per area, opening on tap; a search shows every match.
  {
    const st = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await st.goto(base + '/', { waitUntil: 'networkidle' });
    const h = () => st.evaluate(() => Math.round(document.getElementById('stack').getBoundingClientRect().height));
    const closed = await h();
    const hidden = await st.evaluate(() => [...document.querySelectorAll('#stack .c-sq-hit')].filter((x) => x.offsetParent).length);
    await st.locator('#stack .c-sq-tog').first().scrollIntoViewIfNeeded();
    await st.waitForTimeout(400);
    await st.locator('#stack .c-sq-tog').first().tap();
    await st.waitForFunction(() => document.querySelector('#stack .c-sq-tog').getAttribute('aria-expanded') === 'true', null, { timeout: 3000 }).catch(() => {});
    const open = await st.evaluate(() => ({ exp: document.querySelector('#stack .c-sq-tog').getAttribute('aria-expanded'), shown: document.querySelector('#stack .c-sq-row .c-sq-hit').offsetParent !== null }));
    await st.fill('.c-sq-in', 'aws');
    await st.waitForTimeout(200);
    const found = await st.evaluate(() => [...document.querySelectorAll('#stack .c-sq-hit')].filter((x) => x.offsetParent).length);
    ok('stack: areas fold to one line each, open on tap, and a search shows matches', closed < 1000 && hidden === 0 && open.exp === 'true' && open.shown && found > 3, JSON.stringify({ closed, hidden, open, found }));
    await st.close();
  }
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
