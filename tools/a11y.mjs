// WCAG 2.2 AA checks for craigthompson.dev.
//
//   node tools/a11y.mjs                      test the local build in site/
//   node tools/a11y.mjs --url https://craigthompson.dev/
//   node tools/a11y.mjs --out report.json    also write the full results as JSON
//
// 1. axe-core (vendored in tools/vendor/) with every WCAG 2.0/2.1/2.2 A and AA rule, run
//    on each page state that shows different content: both themes, desktop and mobile,
//    every responsibilities and case-study tab, the FAQ opened, stack search, ask.sh and
//    the chat with an answer, the plain CV and the 404 page.
// 2. Checks for criteria automated rule engines can't see:
//    - 2.1.1 / 2.4.3 / 2.4.7 keyboard: Tab through the whole page; every stop must show a
//      visible focus indicator (pixels change when focused).
//    - 2.4.11 Focus Not Obscured (Minimum): no focused element is hidden behind the
//      sticky header or the chat bar.
//    - 1.4.10 Reflow: no horizontal scrolling at 320 CSS px.
//    - 1.4.12 Text Spacing: no clipped text with the WCAG spacing overrides applied.
//    - 2.2.2 / 2.3.3 motion: reduced-motion users get a still page, and the auto-playing
//      tour has a pause control.
// Exits non-zero if anything fails.
import { chromium } from 'playwright';
import { translatorStub } from './translator-stub.mjs';
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const AXE = readFileSync(join(ROOT, 'tools', 'vendor', 'axe.min.js'), 'utf8');
const AXE_VERSION = existsSync(join(ROOT, 'tools', 'vendor', 'axe.version')) ? readFileSync(join(ROOT, 'tools', 'vendor', 'axe.version'), 'utf8').trim() : '?';
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa'];

let base = arg('--url');
let srv = null;
if (!base) {
  const OUT = join(ROOT, 'site');
  const T = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.css': 'text/css' };
  srv = http.createServer((q, r) => {
    let p = decodeURIComponent(q.url.split('?')[0]);
    if (p.endsWith('/')) p += 'index.html';
    let f = join(OUT, p);
    const missing = !existsSync(f);
    if (missing) f = join(OUT, '404.html');
    r.writeHead(missing ? 404 : 200, { 'content-type': T[extname(f)] || 'application/octet-stream' });
    r.end(readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}/`;
}
if (!base.endsWith('/')) base += '/';

const browser = await chromium.launch();
const violations = new Map(); // rule|target -> entry
const failures = []; // custom check failures
const notes = [];
let axeRuns = 0;

const ANSWER = { answer: 'Yes. He led engineering from start-up through to acquisition and represented engineering through due diligence. See acquisition.md, or email craga89@gmail.com.', sources: ['resp-acq', 'faq-13'], model: 'a11y-fixture' };

async function open(path, { width, height = 900, scheme = 'dark', reduced = false, locale, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', isMobile: width < 600, hasTouch: width < 600, ...(locale ? { locale } : {}) });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  // ask.sh answers come from a fixture, so audits never spend the Worker's allowance.
  await page.route(/workers\.dev\/ask/, (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(ANSWER) }));
  await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  return { page, ctx };
}
const settle = (page) => page.addStyleTag({ content: 'html{scroll-behavior:auto!important}*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}' });
const renderAll = (page) => page.evaluate(() => document.documentElement.classList.add('cv-all'));

async function axe(page, label, include) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE });
  const res = await page.evaluate(async ({ tags, include }) => {
    const r = await window.axe.run(include ? { include: [include] } : document, { runOnly: { type: 'tag', values: tags }, resultTypes: ['violations'] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, url: v.helpUrl, tags: v.tags.filter((t) => /^wcag\d/.test(t)), nodes: v.nodes.map((n) => ({ target: n.target.join(' '), html: n.html.slice(0, 220), summary: (n.failureSummary || '').split('\n').slice(0, 3).join(' ') })) }));
  }, { tags: TAGS, include });
  axeRuns++;
  for (const v of res) for (const n of v.nodes) {
    const k = v.id + '|' + n.target;
    const e = violations.get(k) || { rule: v.id, impact: v.impact, help: v.help, url: v.url, wcag: v.tags, target: n.target, html: n.html, summary: n.summary, states: [] };
    if (!e.states.includes(label)) e.states.push(label);
    violations.set(k, e);
  }
}

// ---------- 1. axe across page states ----------
for (const [width, scheme] of [[1440, 'dark'], [1440, 'light'], [390, 'dark'], [390, 'light']]) {
  const tag = `${width}px ${scheme}`;
  const { page, ctx } = await open('', { width, scheme });
  await settle(page);
  await renderAll(page);
  await axe(page, `home ${tag}`);
  // Open every FAQ answer and every "full file" disclosure.
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
  await axe(page, `home, all details open ${tag}`, '#faq');
  // Every responsibilities tab (the tour), with its full file open.
  const segs = page.locator('#responsibilities .c-seg');
  for (let i = 0; i < await segs.count(); i++) {
    await segs.nth(i).click();
    // Switches cross-fade with a view transition, so wait for the new state to land.
    await page.waitForFunction((k) => document.querySelectorAll('#responsibilities .c-seg')[k].getAttribute('aria-selected') === 'true', i, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    await page.evaluate(() => document.querySelectorAll('#responsibilities details').forEach((d) => { d.open = true; }));
    await axe(page, `responsibilities tab ${i + 1} ${tag}`, '#responsibilities');
  }
  // Every case-study tab.
  const tabs = page.locator('#case-studies [role="tab"]');
  for (let i = 0; i < await tabs.count(); i++) {
    await tabs.nth(i).click();
    await page.waitForFunction((k) => document.querySelectorAll('#case-studies [role="tab"]')[k].getAttribute('aria-selected') === 'true', i, { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(60);
    await axe(page, `case study tab ${i + 1} ${tag}`, '#case-studies');
  }
  // A jargon toggletip open.
  const term = page.locator('.c-term').first();
  if (await term.count()) {
    await term.scrollIntoViewIfNeeded();
    await term.click();
    await page.waitForTimeout(150);
    await axe(page, `toggletip open ${tag}`);
    await page.keyboard.press('Escape');
  }
  // The mobile menu, open.
  if (width <= 600) {
    await page.evaluate(() => { scrollTo(0, 0); const m = document.getElementById('v2-menu'); if (m) m.open = true; });
    await page.waitForTimeout(300);
    await axe(page, `mobile menu open ${tag}`, '#c-hdr');
    await page.evaluate(() => { const m = document.getElementById('v2-menu'); if (m) m.open = false; });
  }
  // The command palette (Ctrl+K), unfiltered and filtered, and the keyboard shortcuts dialog.
  if (width > 600) {
    await page.keyboard.press('Control+k');
    await page.waitForTimeout(250);
    await axe(page, `command palette ${tag}`, '#c-pal');
    await page.keyboard.type('budget');
    await page.waitForTimeout(150);
    await axe(page, `command palette filtered ${tag}`, '#c-pal');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('?');
    await page.waitForTimeout(250);
    await axe(page, `keyboard shortcuts ${tag}`, '#c-keys');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
  }
  // Stack search with results, and with none.
  await page.locator('#stack input').fill('aws');
  await axe(page, `stack search ${tag}`, '#stack');
  await page.locator('#stack input').fill('zzzz');
  await axe(page, `stack search, no results ${tag}`, '#stack');
  // ask.sh with an answer.
  await page.locator('#c-ask-field').fill('Has he been through an acquisition?');
  await page.locator('#c-ask-field').press('Enter');
  await page.waitForTimeout(500);
  await axe(page, `ask.sh answered ${tag}`, '#ask');
  // How ask.sh is tested, open.
  await page.evaluate(() => { const d = document.getElementById('c-tests'); if (d) d.open = true; });
  await page.waitForTimeout(100);
  await axe(page, `ask.sh tests open ${tag}`, '#c-tests');
  // The chat window, open with that conversation.
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(150);
  if (await page.locator('.c-chat-bar').isVisible()) {
    await axe(page, `chat bar ${tag}`, '.c-chat');
    await page.locator('.c-chat-bar').click();
    await page.waitForTimeout(200);
    await axe(page, `chat open ${tag}`, '.c-chat');
  }
  await ctx.close();
  const filePages = [];
  for (const dir of ['case-studies', 'responsibilities']) { try { for (const f of readdirSync(join(ROOT, 'site', dir))) filePages.push(`${dir}/${f}/`); } catch (e) {} }
  for (const path of ['cv/', 'this-page-does-not-exist', ...filePages]) {
    const o = await open(path, { width, scheme });
    await settle(o.page);
    await axe(o.page, `${path === 'cv/' ? 'plain CV' : path.endsWith('/') ? path : '404 page'} ${tag}`);
    await o.ctx.close();
  }
}

// ---------- 1b. translated pages (on-device translation, with a stand-in translator) ----------
const trDone = (page) => page.waitForFunction(() => document.querySelector('.tr-bar') && document.querySelector('.tr-bar').dataset.kind === 'done', null, { timeout: 60000 });
for (const [width, scheme, locale] of [[1440, 'dark', 'de-DE'], [390, 'light', 'de-DE'], [1440, 'light', 'ar'], [390, 'dark', 'ar']]) {
  const tag = `${width}px ${scheme} ${locale.slice(0, 2)}`;
  const { page, ctx } = await open('', { width, scheme, locale, init: translatorStub });
  await settle(page);
  await page.waitForSelector('.tr-offer', { timeout: 10000 });
  await axe(page, `translation offer ${tag}`, '.tr-offer');
  await page.locator('.tr-offer .tr-go').click();
  await trDone(page);
  await renderAll(page);
  await page.waitForTimeout(200);
  await axe(page, `home translated ${tag}`);
  await axe(page, `translation banner ${tag}`, '.tr-bar');
  const tabs = page.locator('#case-studies [role="tab"]');
  for (const i of [3, 12]) {
    if (i >= await tabs.count()) continue;
    await tabs.nth(i).click();
    await page.waitForTimeout(150);
    await axe(page, `case study tab ${i + 1} translated ${tag}`, '#case-studies');
  }
  await ctx.close();
  const cv = await open('cv/', { width, scheme, locale, init: translatorStub });
  await settle(cv.page);
  await cv.page.waitForSelector('.tr-offer', { timeout: 10000 });
  await cv.page.locator('.tr-offer .tr-go').click();
  await trDone(cv.page);
  await axe(cv.page, `plain CV translated ${tag}`);
  await cv.ctx.close();
}

// ---------- 2a. keyboard: visible focus, nothing obscured ----------
async function keyboardWalk(width, scheme) {
  const tag = `${width}px ${scheme}`;
  const { page, ctx } = await open('', { width, scheme });
  await settle(page);
  await page.mouse.move(1, 1);
  let first = null;
  const stops = [];
  for (let i = 0; i < 600; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      window.__seen = window.__seen || new WeakSet();
      if (window.__seen.has(el)) return { wrapped: true };
      window.__seen.add(el);
      const r = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim().slice(0, 50);
      const key = el.tagName + '|' + (el.id || '') + '|' + name + '|' + Math.round(r.top + scrollY);
      // 2.4.11: sample points inside the element; obscured if every point hits a different, non-ancestor element.
      const pts = [[0.5, 0.5], [0.15, 0.25], [0.85, 0.25], [0.15, 0.75], [0.85, 0.75]].map(([fx, fy]) => [r.left + r.width * fx, r.top + r.height * fy]);
      let hidden = 0;
      for (const [x, y] of pts) {
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) { hidden++; continue; }
        const hit = document.elementFromPoint(x, y);
        if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) hidden++;
      }
      return { key, tag: el.tagName.toLowerCase(), name, rect: [r.left, r.top, r.width, r.height].map(Math.round), hidden, inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth };
    });
    if (!info) continue;
    if (info.wrapped) break; // back to an element already visited: a full lap
    const stop = { ...info };
    // 2.4.7: compare the focused element (with a margin for outlines/rings) against the same spot unfocused.
    const [x, y, w, h] = info.rect;
    const clip = { x: Math.max(0, x - 6), y: Math.max(0, y - 6), width: Math.min(w + 12, width - Math.max(0, x - 6)), height: Math.min(h + 12, 900 - Math.max(0, y - 6)) };
    if (info.inView && clip.width > 2 && clip.height > 2) {
      const a = await page.screenshot({ clip });
      await page.evaluate(() => { window.__last = document.activeElement; document.activeElement && document.activeElement.blur(); });
      const b = await page.screenshot({ clip });
      stop.focusVisible = !a.equals(b);
      // Put focus back (without a fresh visit) so the next Tab carries on from here.
      await page.evaluate(() => window.__last && window.__last.focus({ preventScroll: true, focusVisible: true }));
    } else {
      stop.focusVisible = null;
    }
    stops.push(stop);
  }
  for (const s of stops) {
    if (!s.inView) failures.push({ check: '2.4.11 Focus Not Obscured', state: tag, what: `${s.tag} "${s.name}" is focused but not on screen` });
    else if (s.hidden === 5) failures.push({ check: '2.4.11 Focus Not Obscured', state: tag, what: `${s.tag} "${s.name}" is hidden behind another element when focused` });
    else if (s.hidden >= 3) notes.push(`${tag}: ${s.tag} "${s.name}" is partly covered when focused (allowed at AA, fails AAA 2.4.12)`);
    if (s.focusVisible === false) failures.push({ check: '2.4.7 Focus Visible', state: tag, what: `${s.tag} "${s.name}" shows no visible focus indicator` });
  }
  notes.push(`${tag}: keyboard reached ${stops.length} focus stops`);
  await ctx.close();
  return stops.length;
}
await keyboardWalk(1440, 'dark');
await keyboardWalk(390, 'light');

// ---------- 2b. reflow at 320px, text spacing ----------
for (const path of ['', 'cv/']) {
  const { page, ctx } = await open(path, { width: 320, height: 640, scheme: 'light' });
  await settle(page);
  await renderAll(page);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over > 1) failures.push({ check: '1.4.10 Reflow', state: `${path || 'home'} 320px`, what: `page scrolls sideways by ${over}px` });
  // WCAG 1.4.12 overrides.
  await page.addStyleTag({ content: '*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}' });
  await page.waitForTimeout(100);
  const clipped = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('#app *, body > *:not(script)').forEach((el) => {
      const cs = getComputedStyle(el);
      if (!el.childNodes.length || cs.display === 'none' || cs.visibility === 'hidden') return;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())) return;
      const clipX = /hidden|clip/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis';
      const clipY = /hidden|clip/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 2;
      // 1px visually-hidden text (screen-reader only) is clipped on purpose.
      if ((clipX || clipY) && el.clientWidth > 1 && el.clientHeight > 1) out.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ')[0] : '') + ' "' + el.textContent.trim().slice(0, 40) + '"');
    });
    return out.slice(0, 10);
  });
  for (const c of clipped) failures.push({ check: '1.4.12 Text Spacing', state: `${path || 'home'} 320px`, what: `text clipped: ${c}` });
  const over2 = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  if (over2 > 1) failures.push({ check: '1.4.12 Text Spacing', state: `${path || 'home'} 320px`, what: `page scrolls sideways by ${over2}px with text spacing applied` });
  await ctx.close();
}

// ---------- 2c. motion ----------
{
  // Reduced motion: nothing loops or auto-advances.
  const r = await open('', { width: 1440, reduced: true });
  await r.page.waitForTimeout(400);
  const running = await r.page.evaluate(() => (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).map((a) => (a.effect.target && a.effect.target.className) || a.animationName).slice(0, 5));
  if (running.length) failures.push({ check: '2.3.3 / 2.2.2 motion', state: 'prefers-reduced-motion', what: `looping animations still run: ${running.join(', ')}` });
  await r.ctx.close();
  // Motion allowed: every looping animation (clock colon, status dots, glow) can be paused (2.2.2).
  {
    const g = await open('', { width: 1440 });
    await g.page.waitForTimeout(400);
    const loops = () => g.page.evaluate(() => (document.getAnimations ? document.getAnimations() : []).filter((a) => a.playState === 'running' && a.effect && a.effect.getTiming().iterations === Infinity).length);
    const before = await loops();
    if (before) {
      const btn = g.page.locator('.v2-side .v2-motion');
      if (!(await btn.count())) failures.push({ check: '2.2.2 Pause, Stop, Hide', state: 'home', what: `${before} looping animations and no pause control` });
      else {
        await btn.click(); await g.page.waitForTimeout(200);
        const after = await loops();
        if (after) failures.push({ check: '2.2.2 Pause, Stop, Hide', state: 'home', what: `${after} looping animations still run after "pause animations"` });
        notes.push(`pause animations stops ${before} looping animations`);
      }
    }
    await g.ctx.close();
  }
  // Motion allowed: the auto-playing tour must offer a pause control (2.2.2).
  const m = await open('', { width: 1440 });
  await m.page.locator('#responsibilities').scrollIntoViewIfNeeded();
  await m.page.waitForTimeout(600);
  const pause = await m.page.evaluate(() => [...document.querySelectorAll('#responsibilities button')].find((b) => /pause/i.test((b.getAttribute('aria-label') || '') + ' ' + b.textContent)));
  if (!pause) failures.push({ check: '2.2.2 Pause, Stop, Hide', state: 'home', what: 'the auto-playing tour has no pause control' });
  await m.ctx.close();
  // 2.1.4 Character Key Shortcuts: single-key shortcuts must be possible to turn off.
  const k = await open('', { width: 1440 });
  const palOpen = () => k.page.evaluate(() => { const d = document.getElementById('c-pal'); return !!(d && d.open); });
  await k.page.evaluate(() => document.activeElement && document.activeElement.blur());
  await k.page.keyboard.press('/');
  await k.page.waitForTimeout(200);
  if (await palOpen()) {
    await k.page.keyboard.press('Escape');
    await k.page.waitForTimeout(150);
    await k.page.evaluate(() => document.activeElement && document.activeElement.blur());
    await k.page.keyboard.press('?');
    await k.page.waitForTimeout(200);
    const box = k.page.locator('#c-keys input[type="checkbox"]');
    if (!(await box.count())) failures.push({ check: '2.1.4 Character Key Shortcuts', state: 'home', what: 'single-key shortcuts have no off switch' });
    else {
      await box.click();
      await k.page.keyboard.press('Escape');
      await k.page.waitForTimeout(150);
      await k.page.evaluate(() => document.activeElement && document.activeElement.blur());
      await k.page.keyboard.press('/');
      await k.page.waitForTimeout(200);
      if (await palOpen()) failures.push({ check: '2.1.4 Character Key Shortcuts', state: 'home', what: '"/" still opens the palette after single-key shortcuts are turned off' });
      else notes.push('single-key shortcuts (/ and ?) can be turned off');
    }
  }
  await k.ctx.close();
}

await browser.close();
if (srv) srv.close();

// ---------- report ----------
const list = [...violations.values()].sort((a, b) => ['critical', 'serious', 'moderate', 'minor'].indexOf(a.impact) - ['critical', 'serious', 'moderate', 'minor'].indexOf(b.impact));
const report = { url: base, at: new Date().toISOString(), axe: AXE_VERSION, standard: 'WCAG 2.2 AA', axeRuns, violations: list, failures, notes, pass: !list.length && !failures.length };
if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(report, null, 2));
console.log(`WCAG 2.2 AA · ${base} · axe ${AXE_VERSION} · ${axeRuns} axe runs`);
if (!list.length) console.log('axe: no violations');
for (const v of list) console.log(`axe ✗ [${v.impact}] ${v.rule} (${v.wcag.join(',')}): ${v.help}\n    ${v.target}\n    ${v.html}\n    ${v.summary}\n    in: ${v.states.slice(0, 4).join('; ')}${v.states.length > 4 ? ` (+${v.states.length - 4} more)` : ''}`);
if (!failures.length) console.log('keyboard, focus, reflow, text spacing, motion: all pass');
for (const f of failures) console.log(`✗ ${f.check} · ${f.state}: ${f.what}`);
for (const n of notes) console.log(`· ${n}`);
console.log(report.pass ? 'PASS' : 'FAIL');
process.exit(report.pass ? 0 : 1);
