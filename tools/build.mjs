// Builds the static craigthompson.dev site from the design files in src/ into site/.
//   node tools/build.mjs            build + prerender (needs Playwright + Chromium)
//   node tools/build.mjs --no-prerender
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LANGS as TR_LANGS } from '../shared/langs.js';
import { errorMessage } from '../shared/errors.js';
import { serve } from './lib/serve.mjs';
import { loadPosts, listing as postListing, designListing } from './blog.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');
const DOMAIN = 'craigthompson.dev';
const PRERENDER = !process.argv.includes('--no-prerender');
// Keep search engines out while the content is being finished.
// Set to true (or run with --public) when the site is ready to be found.
const ALLOW_INDEXING = process.argv.includes('--public') || false;
// ask.sh: the Cloudflare Worker URL lives in ask.config.json ("" = search-only).
const ASK = existsSync(join(ROOT, 'ask.config.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'ask.config.json'), 'utf8'))
  : { endpoint: '' };
// The old blog (src/blog/*.md): rendered to /blog/<slug>/ and listed on the home page.
const POSTS = loadPosts();
{
  const d = designListing();
  if (d && JSON.stringify(d) !== JSON.stringify(postListing(POSTS)))
    console.warn("warning: the design file's post list is out of date; run node tools/blog.mjs sync");
}
const ROBOTS_META = ALLOW_INDEXING ? '' : '\n<meta name="robots" content="noindex, nofollow, noarchive">';

const between = (s, a, b, from = 0) => {
  const i = s.indexOf(a, from);
  if (i < 0) throw new Error('missing ' + a);
  const j = s.indexOf(b, i + a.length);
  if (j < 0) throw new Error('missing ' + b);
  return s.slice(i + a.length, j);
};

function splitDesign(file) {
  const s = readFileSync(join(SRC, file), 'utf8');
  const head = between(s, '<head>', '</head>').replace(/\s*<script src="\.\/support\.js"><\/script>/, '');
  const xdc = between(s, '<x-dc>', '</x-dc>');
  const helmet = between(xdc, '<helmet>', '</helmet>');
  const template = xdc.slice(xdc.indexOf('</helmet>') + '</helmet>'.length).trim();
  const m = s.match(/<script type="text\/x-dc" data-dc-script data-props='([^']*)'>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no component script in ' + file);
  return { head, helmet, template, props: m[1], code: m[2] };
}

// Paths are relative so the same build works at craigthompson.dev/ and at craga89.github.io/portfolio/.
// Browser chrome colours per page: [dark, light].
const CHROME = { home: ['#16271F', '#EDF1EE'], cv: ['#111214', '#F4F4F2'] };
const meta = (
  root,
  page = 'home',
) => `<meta name="viewport" content="width=device-width, initial-scale=1">${ROBOTS_META}
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="${CHROME[page][0]}" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="${CHROME[page][1]}" media="(prefers-color-scheme: light)">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">`;

// ---------- shared head pieces ----------
const SITE = 'https://' + DOMAIN;
const HOME_TITLE = 'Craig Michael Thompson · Head of Engineering, hands-on & AI-first';
const CV_DESC =
  'CV of Craig Michael Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK, open to technical leadership roles.';
const HOME_DESC =
  'Craig Michael Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK. 20+ years, from start-up to acquisition.';
const OG_DESC =
  "Hands-on, AI-first Head of Engineering and full-stack engineer. 20+ years' experience in software development and management, from start-up to acquisition.";
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Open Graph and Twitter card tags.
 * @param {{ title: string, desc: string, url: string, type: string, image?: string, imageAlt?: string }} meta
 */
function social({ title, desc, url, type, image, imageAlt }) {
  return [
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="craigthompson.dev">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${image || SITE + '/og.png'}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(imageAlt || 'Craig Michael Thompson, Head of Engineering. craigthompson.dev')}">`,
    type === 'profile'
      ? `<meta property="profile:first_name" content="Craig">\n<meta property="profile:last_name" content="Thompson">`
      : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${image || SITE + '/og.png'}">`,
  ]
    .filter(Boolean)
    .join('\n');
}

// Replace the design file's title/description/social tags with the tuned set, and
// enrich its JSON-LD (portrait, ids, last-modified).
function seoHead(head, { title, desc, url, type, today }) {
  head = head
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(desc)}">`)
    .replace(/\s*<meta (?:property="og:[^"]+"|name="twitter:[^"]+") content="[^"]*">/g, '');
  head = head.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/, (all, json) => {
    try {
      const d = JSON.parse(json);
      const person = d.mainEntity || d;
      if (person['@type'] === 'Person') {
        person['@id'] = SITE + '/#person';
        person.image = SITE + '/assets/img/portrait-352.webp';
        person.url = SITE + '/';
        person.description = OG_DESC;
        person.knowsAbout = [
          ...new Set([
            'AI-first engineering',
            'AI-assisted development',
            'Engineering management',
            'Full-stack development',
            ...(person.knowsAbout || []),
            'Google Cloud',
          ]),
        ];
        person.knowsLanguage = 'en-GB';
      }
      if (d['@type'] === 'ProfilePage') {
        d['@id'] = url;
        d.url = url;
        d.name = title;
        d.dateModified = today;
        d.inLanguage = 'en-GB';
      }
      return `<script type="application/ld+json">${JSON.stringify(d)}</script>`;
    } catch {
      return all;
    }
  });
  return head.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${social({ title, desc, url, type })}`);
}

// Cookie-free visit count: one small beacon as the visitor leaves (page, referring site, device
// class, sections seen, time on page). Skipped for Do Not Track / Global Privacy Control.
// Cloudflare Web Analytics: cookieless page-view counts. Only on the live domains (not local or
// preview builds), not for Do Not Track / Global Privacy Control. It loads on the first interaction, or
// 6s after the page has loaded, so it never competes with the page itself for the network.
const CF_ANALYTICS_TOKEN = '1115308102a141bdb2e944bd0144d4ee';
const cfAnalytics = `<script>(function a(){if(document.prerendering){document.addEventListener('prerenderingchange',a,{once:true});return}try{if(!/(^|\\.)craigthompson\\.dev$/.test(location.hostname)||navigator.globalPrivacyControl||navigator.doNotTrack==='1')return;var go=function(){var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon','{"token":"${CF_ANALYTICS_TOKEN}"}');document.head.appendChild(s)};var done=false,ev=['pointerdown','keydown','wheel','touchstart','scroll'],once=function(){if(done)return;done=true;ev.forEach(function(t){removeEventListener(t,once,true)});go()};ev.forEach(function(t){addEventListener(t,once,{capture:true,passive:true})});var later=function(){setTimeout(once,6000)};if(document.readyState==='complete')later();else addEventListener('load',later,{once:true})}catch(e){}})()</script>`;

const beacon = (endpoint, sections) =>
  !endpoint
    ? ''
    : `(function hit() {
  // A page loaded ahead of a click (speculation rules) only counts once it's actually shown.
  if (document.prerendering) { document.addEventListener('prerenderingchange', hit, { once: true }); return; }
  try {
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || !navigator.sendBeacon) return;
    var url = ${JSON.stringify(new URL(endpoint || 'https://x').origin + '/hit')}, t0 = Date.now(), seen = {}, sent = false;
    ${
      sections
        ? `seen.top = 1;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) seen[e.target.id] = 1; }); }, { threshold: 0.2 });
      document.querySelectorAll('main > section[id]').forEach(function (n) { io.observe(n); });
    }`
        : ''
    }
    var send = function () {
      if (sent) return; sent = true;
      var w = window.innerWidth;
      navigator.sendBeacon(url, new Blob([JSON.stringify({ path: location.pathname, ref: document.referrer, device: w < 601 ? 'mobile' : w < 1025 ? 'tablet' : 'desktop', sections: Object.keys(seen), seconds: (Date.now() - t0) / 1000, lang: window.CRAGA_LANG && window.CRAGA_LANG !== 'en' ? window.CRAGA_LANG : null, offer: window.CRAGA_I18N_OFFER || null })], { type: 'text/plain' }));
    };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
    window.addEventListener('pagehide', send);
  } catch (e) { /* counting a visit must never break the page */ }
})();`;

// ---------- devtools greeting ----------
// A terminal-styled hello for anyone who opens the console, plus ask("…") to query ask.sh from there.
const BANNER =
  ' ██████╗ ██████╗   █████╗  ██╗  ██████╗ \n██╔════╝ ██╔══██╗ ██╔══██╗ ██║ ██╔════╝ \n██║      ██████╔╝ ███████║ ██║ ██║  ███╗\n██║      ██╔══██╗ ██╔══██║ ██║ ██║   ██║\n╚██████╗ ██║  ██║ ██║  ██║ ██║ ╚██████╔╝\n ╚═════╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═════╝ ';
const CONSOLE_HELLO = `
  (function () {
    if (window.__cragaHello) return;
    window.__cragaHello = true;
    var bg = 'background:#16271F;';
    var pad = bg + 'padding:2px 14px;font-family:"Red Hat Mono",ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.5;';
    var S = {
      art: bg + 'color:#8EC3E6;padding:14px 14px 6px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.05;',
      cmd: pad + 'color:#B7D47A;',
      dim: pad + 'color:#99B0A5;',
      head: pad + 'color:#F6F8F4;font-weight:700;font-size:13px;',
      text: pad + 'color:#D9E4DD;',
      key: pad + 'color:#99B0A5;',
      link: pad + 'color:#8EC3E6;',
      end: bg + 'padding:0 14px 12px;color:#99B0A5;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;',
    };
    var parts = [
      ['art', ${JSON.stringify(BANNER)}],
      ['cmd', '\\n$ whoami'],
      ['head', '\\nCraig Michael Thompson'],
      ['text', '\\nHead of Engineering · hands-on, AI-first · Newcastle upon Tyne, UK'],
      ['dim', '\\n● open to new roles'],
      ['cmd', '\\n\\n$ ls ./links'],
      ['key', '\\nemail    '], ['link', 'craga89@gmail.com'],
      ['key', '\\ngithub   '], ['link', 'https://github.com/Craga89'],
      ['key', '\\nlinkedin '], ['link', 'https://www.linkedin.com/in/craigmichaelthompson/'],
      ['key', '\\ncv       '], ['link', '${SITE}/cv/'], ['dim', ' (or /cv.json, JSON Resume)'],
      ['key', '\\nsource   '], ['link', 'https://github.com/Craga89/portfolio'],
      ['cmd', '\\n\\n$ ask("What roles is he looking for?")'],
      ['end', '\\n# ask.sh works from here too: ask() any question about my experience.\\n'],
    ];
    try { console.log(parts.map(function (p) { return '%c' + p[1]; }).join(''), ...parts.map(function (p) { return S[p[0]]; })); } catch (e) { /* a console without %c styling */ }
    // (window.ask is the #ask section element by default, so only skip if a real function is already there.)
    if (typeof window.ask !== 'function') {
      window.ask = function (q) {
        q = String(q || '').trim();
        if (!q) return 'Try: ask("Has he been through an acquisition?")';
        var cfg = window.CRAGA_ASK || {};
        if (!cfg.endpoint) return 'ask.sh is only connected on the live site.';
        fetch(cfg.endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: q }) })
          .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
          .then(function (d) {
            console.log('%c$ ./ask.sh ' + JSON.stringify(q) + '%c\\n' + d.answer + (d.sources && d.sources.length ? '%c\\n# sources: ' + d.sources.join(', ') : '%c'),
              S.cmd + 'padding-top:10px;', S.text + 'padding-bottom:' + (d.sources && d.sources.length ? '2px' : '12px') + ';', S.end);
          })
          .catch(function () { console.log('%cask.sh is busy right now. The ask.sh section on the page can still search the site.', S.end + 'padding-top:12px;'); });
        return 'Asking ask.sh…';
      };
    }
  })();`;

// ---------- fonts (self-hosted, see tools/fetch-fonts.mjs) ----------
// Metric-matched fallbacks: system fonts scaled to the web fonts' widths, so text doesn't
// reflow (and shift the layout) when the web fonts arrive. Ratios measured with Chromium.
const FALLBACKS = `@font-face{font-family:'Big Shoulders Display Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('Helvetica Neue Bold'),local('Roboto Bold');font-weight:100 699;size-adjust:68.4%}
@font-face{font-family:'Big Shoulders Display Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('Helvetica Neue Bold'),local('Roboto Bold');font-weight:700 900;size-adjust:81.2%}
@font-face{font-family:'Public Sans Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Helvetica Neue'),local('Roboto');font-weight:100 599;size-adjust:104.4%}
@font-face{font-family:'Public Sans Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('Helvetica Neue Bold'),local('Roboto Bold');font-weight:600 900;size-adjust:99.6%}
@font-face{font-family:'Inter Fallback';src:local('Arial'),local('ArialMT'),local('Liberation Sans'),local('Helvetica Neue'),local('Roboto');font-weight:100 599;size-adjust:106.7%}
@font-face{font-family:'Inter Fallback';src:local('Arial Bold'),local('Arial-BoldMT'),local('Liberation Sans Bold'),local('Helvetica Neue Bold'),local('Roboto Bold');font-weight:600 900;size-adjust:102.7%}`;

// Collapses fonts.css (one rule per weight) into one rule per variable-font file with a weight range.
function fontFaces(dir, families) {
  const css = readFileSync(join(SRC, 'fonts', 'fonts.css'), 'utf8');
  const groups = new Map();
  for (const m of css.matchAll(
    /@font-face\{font-family:'([^']+)';font-style:normal;font-weight:(\d+);font-display:swap;src:url\(FONTDIR\/([^)]+)\) format\('woff2'\);unicode-range:([^}]+)\}/g,
  )) {
    const [, fam, w, file, range] = m;
    if (families && !families.includes(fam)) continue;
    const k = fam + '|' + file;
    const g = groups.get(k) || { fam, file, range, lo: +w, hi: +w };
    g.lo = Math.min(g.lo, +w);
    g.hi = Math.max(g.hi, +w);
    groups.set(k, g);
  }
  return [...groups.values()]
    .map(
      (g) =>
        `@font-face{font-family:'${g.fam}';font-style:normal;font-weight:${g.lo === g.hi ? g.lo : g.lo + ' ' + g.hi};font-display:swap;src:url(${dir}${g.file}) format('woff2');unicode-range:${g.range}}`,
    )
    .join('\n');
}
// Between pages: a cross-fade (cross-document view transitions; post titles move into place),
// and pages loaded ahead of a click on hover (speculation rules). Both skip themselves where
// unsupported; the transition also when motion is reduced or paused on the site.
const NAV_HEAD = (depth) => `<style>@media (prefers-reduced-motion:no-preference){@view-transition{navigation:auto}}
::view-transition-group(root){animation-duration:.26s}
::view-transition-group(*.post-title){animation-duration:.38s;animation-timing-function:cubic-bezier(.2,.8,.2,1)}
::view-transition-old(*.post-title),::view-transition-new(*.post-title){height:100%;object-fit:none;object-position:left center}</style>
<script>(function(){var off=function(e){try{if(e.viewTransition&&localStorage.getItem('motion')==='off')e.viewTransition.skipTransition()}catch(x){}};addEventListener('pageswap',off);addEventListener('pagereveal',off)})()</script>
<script type="speculationrules">${JSON.stringify({ prerender: [{ source: 'document', where: { or: ['', 'cv/', 'blog/*', 'case-studies/*', 'responsibilities/*'].map((p) => ({ href_matches: depth + p })) }, eagerness: 'moderate' }] })}</script>`;
const preloadFont = (href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`;
// Drop the Google Fonts links and point the font stacks at the metric-matched fallbacks.
const localFonts = (helmet) =>
  helmet
    .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>/g, '')
    .replace(/\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
    .replace(/'Big Shoulders Display',/g, "'Big Shoulders Display','Big Shoulders Display Fallback',")
    .replace(/'Public Sans',/g, "'Public Sans','Public Sans Fallback',")
    .replace(/(font-family:\s*)'?Inter'?,/g, "$1'Inter','Inter Fallback',");

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

// Responsive portrait: AVIF and WebP at 1x/2x for each displayed size.
const PORTRAIT_ALT = 'Illustrated portrait of Craig Michael Thompson smiling at his laptop';
const portraitPicture = () =>
  `<picture><source type="image/avif" srcset="assets/img/portrait-96.avif 96w, assets/img/portrait-192.avif 192w, assets/img/portrait-352.avif 352w" sizes="(max-width: 370px) 68px, (max-width: 600px) 96px, 176px"><img src="assets/img/portrait-192.webp" srcset="assets/img/portrait-96.webp 96w, assets/img/portrait-192.webp 192w, assets/img/portrait-352.webp 352w" sizes="(max-width: 370px) 68px, (max-width: 600px) 96px, 176px" alt="${PORTRAIT_ALT}" width="512" height="512" fetchpriority="high" decoding="async"></picture>`;

// ---------- home page ----------
const HOME = {};
// The open-source counts from the weekly CI job (oss branch), baked in so the heatmap renders
// without JavaScript; the page swaps in live.json's copy when it loads.
// Chrome origin-trial tokens (WebMCP), one per line in src/origin-trials.txt. Each token is tied to
// one origin, read from the token itself. The app bundle adds the one for the origin it's served
// from: tokens registered for third-party matching only count when an external script on that
// origin adds them, never from a <meta> tag in the HTML. Tokens are public.
// On-device translation (src/i18n.js), loaded only when it's needed. The boot snippet runs on
// every page: it decides whether to offer a language (the visitor's browser prefers one before
// English) or to start straight away (they chose one before), and loads the module if so.
// Served as one file: the shared language list is inlined in place of its import.
const I18N_SRC = readFileSync(join(SRC, 'i18n.js'), 'utf8').replace(
  "import { LANGS, RTL } from '../shared/langs.js';",
  () =>
    readFileSync(join(ROOT, 'shared', 'langs.js'), 'utf8')
      .replace(/^\/\/.*\n/gm, '')
      .replace('export const LANGS', 'const LANGS')
      .replace('export const RTL', 'const RTL'),
);
if (/^import /m.test(I18N_SRC)) throw new Error('src/i18n.js has an import the build does not inline');
const I18N_PATH = '/assets/i18n.' + createHash('sha256').update(I18N_SRC).digest('hex').slice(0, 10) + '.js';
const i18nBoot = () => `(function () {
  try {
    if (!('Translator' in self) || window.CRAGA_PRERENDER) return;
    var L = ${JSON.stringify(TR_LANGS)};
    var norm = function (t) { t = String(t || '').toLowerCase(); if (/^zh-(tw|hk|mo)|^zh-hant/.test(t)) return 'zh-Hant'; var b = t.split('-')[0]; b = { nb: 'no', nn: 'no', iw: 'he', 'in': 'id' }[b] || b; return L.indexOf(b) >= 0 ? b : null; };
    var I = window.CRAGA_I18N = { langs: L, load: function () { return I._p || (I._p = import(${JSON.stringify(I18N_PATH)})); } };
    var saved = null, no = null;
    try { saved = localStorage.getItem('craga-lang'); no = localStorage.getItem('craga-lang-no'); } catch (e) { /* storage blocked: no saved choice */ }
    var want = saved && saved !== 'en' ? norm(saved) : null, offer = null;
    if (!saved) {
      var ls = navigator.languages || [navigator.language];
      for (var i = 0; i < ls.length; i++) { var l = String(ls[i]).toLowerCase(); if (/^en(-|$)/.test(l)) break; var n = norm(l); if (n) { offer = n; break; } }
    }
    if (offer && offer === no) offer = null;
    // Static pages' language menus (the CV), filled in only where translation works.
    var menus = document.querySelectorAll('[data-tr-menu]');
    if (menus.length) {
      var cur = want || 'en';
      var name = function (c) { try { var n = new Intl.DisplayNames([c], { type: 'language' }).of(c); return n.charAt(0).toLocaleUpperCase(c) + n.slice(1); } catch (e) { return c; } };
      Array.prototype.forEach.call(menus, function (s) {
        ['en'].concat(L).forEach(function (c) { var o = document.createElement('option'); o.value = c; o.lang = c; o.textContent = c === 'en' ? 'English' : name(c); s.appendChild(o); });
        s.value = cur;
        s.hidden = false;
        s.addEventListener('change', function () { var v = s.value; I.load().then(function (m) { m.setLanguage(v); }); });
      });
      window.addEventListener('craga:lang', function (e) { Array.prototype.forEach.call(menus, function (s) { s.value = e.detail.lang; }); });
    }
    if (want || offer) I.load().then(function (m) { m.boot({ lang: want || offer, saved: !!want }); }).catch(function (e) { console.warn('translation unavailable:', e); });
  } catch (e) { console.warn('translation setup failed:', e); }
})();`;

// shared/agent-tools.js (the agent tools and site search, also used by the worker) as a plain
// script for the page: its exports become window.CragaAgent.
function sharedForPage() {
  const src = readFileSync(join(ROOT, 'shared', 'agent-tools.js'), 'utf8');
  const names = [...src.matchAll(/^export (?:async function|function|const|class) (\w+)/gm)].map((m) => m[1]);
  if (/^export (?!(?:async function|function|const|class) )/m.test(src))
    throw new Error('shared/agent-tools.js: only export function/const/class declarations are supported');
  return `;(function () {\n${src.replace(/^export (?=async function|function|const|class)/gm, '')}\nwindow.CragaAgent = { ${names.join(', ')} };\n})();\n`;
}

const ORIGIN_TRIALS = (() => {
  let lines = [];
  try {
    lines = readFileSync(join(SRC, 'origin-trials.txt'), 'utf8')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  } catch {
    return {};
  }
  const map = {};
  for (const token of lines) {
    try {
      const raw = Buffer.from(token, 'base64');
      const info = JSON.parse(raw.subarray(69).toString('utf8'));
      const origin = new URL(info.origin).origin;
      if (info.expiry * 1000 < Date.now()) {
        console.warn(`origin trial: token for ${origin} (${info.feature}) has expired`);
        continue;
      }
      (map[origin] = map[origin] || []).push(token);
    } catch {
      console.warn('origin trial: skipped a token that could not be read');
    }
  }
  return map;
})();
const OSS_SNAPSHOT = (() => {
  try {
    const d = JSON.parse(
      execFileSync('git', ['show', 'origin/oss:reports/oss.json'], {
        cwd: ROOT,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    );
    return d && Array.isArray(d.timeline) ? d : null;
  } catch {
    return null;
  }
})();
function buildHome(today) {
  const d = splitDesign('ThemeTyne.dc.html');
  let code = d.code;
  // The animated shader canvases are hidden in this theme, so don't load them at all.
  code = code.replace('async syncTabFx() {', 'async syncTabFx() { return;');
  code = code.replace('async mountFx() {', 'async mountFx() { return;');
  // Sections below the fold skip rendering until needed (content-visibility). Before an
  // in-page jump, render them all so the target position is exact.
  const jumps = code.split("const hdr = document.getElementById('c-hdr');\n      const gap").length - 1;
  if (jumps !== 2) throw new Error('expected 2 in-page scroll handlers, found ' + jumps);
  code = code.replaceAll(
    "const hdr = document.getElementById('c-hdr');\n      const gap",
    "document.documentElement.classList.add('cv-all');\n      const hdr = document.getElementById('c-hdr');\n      const gap",
  );
  const template = d.template
    .replace(/href="\/cv\/?"/g, 'href="cv/"')
    .replace(
      /<img src="\.\/portrait\.webp" alt="Illustrated portrait[^"]*" width="512" height="512" loading="eager" decoding="async">/g,
      portraitPicture(),
    )
    .replace(
      /<img src="\.\/portrait\.webp" alt="" width="28" height="28" loading="lazy" decoding="async">/g,
      '<img src="assets/img/portrait-56.webp" alt="" width="28" height="28" loading="lazy" decoding="async">',
    );
  if (/\.\/portrait\.webp/.test(template)) throw new Error('unhandled portrait image in the template');
  const props = d.props.replace('"$preview"', '"$x"');
  // Everything the page needs only once JavaScript runs (runtime, template, component,
  // boot) goes into one deferred, cache-busted file, so the HTML stays small.
  // Origin-trial tokens first, before anything checks for the features they turn on.
  const otPrelude = Object.keys(ORIGIN_TRIALS).length
    ? `(function(){var T=${JSON.stringify(ORIGIN_TRIALS)}[location.origin];if(T)T.forEach(function(t){var m=document.createElement('meta');m.httpEquiv='origin-trial';m.content=t;document.head.appendChild(m);});})();\n`
    : '';
  const app =
    otPrelude +
    sharedForPage() +
    readFileSync(join(ROOT, 'tools', 'dc-runtime.js'), 'utf8') +
    `
;(function () {
  var t = document.createElement('template');
  t.id = 'dc-template';
  t.innerHTML = ${JSON.stringify(template)};
  document.body.appendChild(t);
  var s = document.createElement('script');
  s.type = 'text/x-dc';
  s.id = 'dc-component';
  s.setAttribute('data-props', ${JSON.stringify(props)});
  s.text = ${JSON.stringify(code)};
  document.body.appendChild(s);
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) { /* storage blocked: follow the system theme */ }
  var light = false;
  try { light = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) { /* no matchMedia: dark */ }
  // Offline support and instant repeat visits (https only, so local previews aren't cached).
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  window.CRAGA_ASK = { endpoint: ${JSON.stringify(ASK.endpoint || '')}, index: 'assets/ask-index.json' };
  ${i18nBoot()}
  var app = DCRuntime.mount({ root: '#app', template: '#dc-template', script: '#dc-component', props: { theme: saved || (light ? 'light' : 'dark') } });
  window.CRAGA_APP = app;
  var set = app.c.setState;
  app.c.setState = function (p) {
    if (p && typeof p === 'object' && 'theme' in p) {
      try { localStorage.setItem('theme', p.theme); } catch (e) { /* storage blocked: the choice lasts this visit */ }
      var L = p.theme === 'light', h = document.documentElement;
      h.classList.toggle('t-light', L); h.classList.toggle('t-dark', !L);
      document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) { m.content = L ? '#EDF1EE' : '#16271F'; });
    }
    return set.apply(this, arguments);
  };
})();
${CONSOLE_HELLO}
${beacon(ASK.endpoint, true)}
`;
  const appName = 'assets/app.' + hash(app) + '.js';
  writeOut(appName, app);
  writeOut(I18N_PATH.slice(1), I18N_SRC);
  // Runs before first paint: applies a saved or system light theme to the prerendered (dark) markup.
  const themeNow = `<script>try{var r=document.querySelector('#app .c-root'),t=localStorage.getItem('theme');if(r&&(t?t==='light':matchMedia('(prefers-color-scheme: light)').matches))r.classList.add('c-light');if(r&&localStorage.getItem('motion')==='off')r.classList.add('still')}catch(e){}</script>`;
  // Runs in <head>, before any of the page is painted: the saved (or system) theme goes on <html>
  // straight away, so the canvas and body are the right colour even if the browser paints part of
  // the long prerendered page before reaching the end of it, and the theme class lands on the app
  // root the moment the parser creates it. themeNow (end of body) stays as a fallback.
  const themeHead = `<style>@media screen{html.t-light,html.t-light body{background:#EDF1EE!important;color-scheme:light}html.t-dark,html.t-dark body{background:#16271F!important;color-scheme:dark}}</style>
<script>try{(function(){var d=document.documentElement,t=localStorage.getItem('theme'),L=t?t==='light':matchMedia('(prefers-color-scheme: light)').matches,M=localStorage.getItem('motion')==='off';d.classList.add(L?'t-light':'t-dark');if(t)document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=L?'#EDF1EE':'#16271F'});var o=new MutationObserver(function(){var r=document.querySelector('#app .c-root');if(!r)return;if(L)r.classList.add('c-light');if(M)r.classList.add('still');o.disconnect()});o.observe(d,{childList:true,subtree:true})})()}catch(e){}</script>`;
  const fonts = fontFaces('assets/fonts/', ['Big Shoulders Display', 'Public Sans', 'Red Hat Mono']);
  HOME.css = (localFonts(d.helmet.trim()).match(/<style>([\s\S]*?)<\/style>/) || [])[1] || '';
  try {
    HOME.tips = JSON.parse((code.match(/const TIPS = (\{[\s\S]*?\});\n/) || [])[1] || '{}');
  } catch {
    HOME.tips = {};
  }
  HOME.themeHead = themeHead;
  const head = seoHead(d.head.trim(), { title: HOME_TITLE, desc: HOME_DESC, url: SITE + '/', type: 'profile', today });
  return `<!doctype html>
<html lang="en-GB">
<head>
${head}
${meta('')}
${themeHead}
${preloadFont('assets/fonts/big-shoulders-display-latin-600.woff2')}
${preloadFont('assets/fonts/public-sans-latin-400.woff2')}
${preloadFont('assets/fonts/red-hat-mono-latin-400.woff2')}
${ASK.endpoint ? `<link rel="dns-prefetch" href="${new URL(ASK.endpoint).origin}">\n` : ''}<link rel="alternate" type="application/json" href="cv.json" title="CV (JSON Resume)">
<style>
${fonts}
${FALLBACKS}
.v2-ph picture{display:contents}
.v2-main>section.c-rv{content-visibility:auto;contain-intrinsic-size:auto var(--cis,1000px);overflow-clip-margin:12px}
.cv-all .v2-main>section.c-rv{content-visibility:visible}
@media print{.v2-main>section.c-rv{content-visibility:visible}}
/*CIS*/
</style>
<script>if(location.hash.length>1)document.documentElement.classList.add('cv-all')</script>
${localFonts(d.helmet.trim())}
${POSTS.length ? `<script>window.CRAGA_POSTS=${JSON.stringify(postListing(POSTS))}</script>\n` : ''}${OSS_SNAPSHOT ? `<script>window.CRAGA_OSS=${JSON.stringify({ timeline: OSS_SNAPSHOT.timeline })}</script>\n` : ''}<script>window.CRAGA_BUILD={sha:"__BUILD_SHA__",short:"__BUILD_SHORT__",date:"${today}",at:"__BUILD_AT__"}</script>
${NAV_HEAD('')}
<script src="${appName}" defer></script>
</head>
<body>
<div id="app"><!--PRERENDER--></div>
${themeNow}
${cfAnalytics}
</body>
</html>
`;
}

// ---------- CV page (static; the only interaction is the print button) ----------
function buildCV() {
  const d = splitDesign('CV.dc.html');
  const body = d.template
    .replace(/onClick="\{\{print\}\}"/g, 'onclick="window.print()"')
    .replace(/onClick="\{\{toggleTheme\}\}"/g, 'onclick="cvTheme()"')
    .replace(/\s*hint-placeholder-[a-z]+="[^"]*"/g, '')
    .replace(/href="\/"/g, 'href="../"');
  if (/\{\{/.test(body)) throw new Error('CV still has template holes');
  const today = new Date().toISOString().slice(0, 10);
  // Same saved theme as the portfolio (localStorage "theme", else the system setting), applied in
  // <head> before anything paints. Print styles force light regardless.
  const cvThemeHead = `<script>try{(function(){var d=document.documentElement,t=localStorage.getItem('theme'),D=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;d.classList.add(D?'t-dark':'t-light');if(t)document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=D?'${CHROME.cv[0]}':'${CHROME.cv[1]}'})})()}catch(e){}</script>`;
  const cvThemeTail = `<script>function cvTheme(){var d=document.documentElement,D=!d.classList.contains('t-dark');d.classList.toggle('t-dark',D);d.classList.toggle('t-light',!D);try{localStorage.setItem('theme',D?'dark':'light')}catch(e){}cvThemeLabel();document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.content=D?'${CHROME.cv[0]}':'${CHROME.cv[1]}'})}function cvThemeLabel(){var b=document.querySelector('.v-theme'),l=document.documentElement.classList.contains('t-dark')?'Switch to light theme':'Switch to dark theme';if(b){b.setAttribute('aria-label',l);b.title=l}}cvThemeLabel()</script>`;
  const title = (d.head.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'CV';
  let head = d.head.replace('href="https://craigthompson.dev/cv"', 'href="https://craigthompson.dev/cv/"');
  head = seoHead(head.trim(), {
    title: title.replace(/&amp;/g, '&'),
    desc: CV_DESC,
    url: SITE + '/cv/',
    type: 'website',
    today,
  });
  const inter = existsSync(join(SRC, 'fonts', 'inter-latin-400.woff2'));
  const helmet = inter ? localFonts(d.helmet.trim()) : d.helmet.trim();
  return `<!doctype html>
<html lang="en-GB">
<head>
${head}
${meta('../', 'cv')}\n${cvThemeHead}
<link rel="alternate" type="application/json" href="../cv.json" title="CV (JSON Resume)">
${inter ? preloadFont('../assets/fonts/inter-latin-400.woff2') + '\n<style>\n' + fontFaces('../assets/fonts/', ['Inter']) + '\n' + FALLBACKS + '\n</style>' : ''}
${helmet}
${NAV_HEAD('../')}
</head>
<body>
${body}
${cvThemeTail}
<script>${i18nBoot()}</script>
<script>${paletteBoot()}</script>
${ASK.endpoint ? '<script>' + beacon(ASK.endpoint, false) + '</script>\n' : ''}${cfAnalytics}
</body>
</html>
`;
}

const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#16271F"/><circle cx="16" cy="16" r="7" fill="#8EC3E6"/><circle cx="16" cy="16" r="2.5" fill="#16271F"/></svg>
`;

const NOT_FOUND = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Not found · craigthompson.dev</title>
<meta name="viewport" content="width=device-width, initial-scale=1">${ROBOTS_META}
<style>
@font-face{font-family:'Red Hat Mono';font-weight:400 700;font-display:swap;src:url(/assets/fonts/red-hat-mono-latin-400.woff2) format('woff2')}
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#16271F;color:#E7EEEA;font-family:'Red Hat Mono',ui-monospace,monospace;padding:24px;box-sizing:border-box}
main{max-width:56ch}
h1{font-size:20px;font-weight:400;color:#B7D47A;margin:0 0 12px}
p{margin:0 0 20px;color:#C9D8CF;line-height:1.6}
a{color:#8EC3E6}
@media (prefers-color-scheme: light){body{background:#EDF1EE;color:#1B2A22}h1{color:#43691A}p{color:#30403A}a{color:#1D6590}}
</style>
</head>
<body>
<main>
<h1>$ cat this-page<br>cat: this-page: No such file or directory</h1>
<p>That address doesn't exist on craigthompson.dev. It may have moved when the site was rebuilt.</p>
<p><a href="/" data-path="">Go to the home page</a> · <a href="/cv/" data-path="cv/">Read the CV</a></p>
</main>
<script>
(function () {
  // On a github.io project site the site lives under /<repo>/, not /.
  var base = /.github.io$/.test(location.hostname) ? '/' + location.pathname.split('/')[1] + '/' : '/';
  document.querySelectorAll('[data-path]').forEach(function (a) { a.setAttribute('href', base + a.getAttribute('data-path')); });
})();
</script>
</body>
</html>
`;

function writeOut(rel, content) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// ---------- prerender ----------
// Pull the site's own words out of the rendered page as short passages. ask.sh
// searches these in the browser, and the Worker gives them to the model as its
// only source of facts.
function extractPassages() {
  const clean = (t) =>
    String(t || '')
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?)])/g, '$1')
      .trim();
  const INLINE = new Set(['a', 'b', 'strong', 'em', 'i', 'code', 'mark', 'small', 'abbr', 'sup', 'sub', 'u']);
  const SKIP = new Set(['script', 'style', 'svg', 'canvas', 'input', 'template']);
  // Node text with a space between block-level pieces, so words don't run together.
  const txt = (n) => {
    if (!n) return '';
    if (n.nodeType === 3) return n.data;
    if (
      n.nodeType !== 1 ||
      SKIP.has(n.localName) ||
      (n.classList &&
        (n.classList.contains('c-mcp-live') || n.classList.contains('c-mcp-copy') || n.classList.contains('c-sq-tog')))
    )
      return '';
    let out = '';
    for (const c of n.childNodes) out += txt(c);
    return INLINE.has(n.localName) ? out : ' ' + out + ' ';
  };
  const out = [];
  const add = (id, title, text, href, kind, key) => {
    // Drop the terminal decoration ($ cat file.txt, # comments, → bullets) so passages read as prose.
    text = clean(
      String(text || '')
        .replace(/\$ (?:cat|ls|grep -ri|git log|\.\/[\w.-]+)(?: [^\s#]+)?/g, ' ')
        .replace(/(^|\s)# [a-z][\w ./-]*?(?=\s{2}|\s[A-Z0-9→$]|$)/g, ' ')
        .replace(/\s*→\s*/g, '; ')
        .replace(/^[;\s]+/, ''),
    );
    if (text.length > 1800) text = text.slice(0, 1800).replace(/\s\S*$/, '') + '…';
    if (text) out.push({ id, title: clean(title), text, href, kind: kind || 'link', key: key || '' });
  };
  const q = (sel, root) => (root || document).querySelector(sel);
  const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const intro = q('section[aria-label="Introduction"]');
  if (intro)
    add('intro', 'About Craig', [q('h1', intro), q('.v2-st', intro), q('#about', intro)].map(txt).join(' '), '#top');
  const side = q('.v2-id');
  if (side)
    add(
      'profile',
      'Profile',
      txt(side) + '. Contact: craga89@gmail.com, github.com/Craga89, linkedin.com/in/craigmichaelthompson.',
      '#top',
    );
  qa('#career article.c-job').forEach((a, i) => {
    const h = q('h3', a);
    add('career-' + (i + 1), h ? txt(h) : 'Career', txt(a), '#career');
  });
  const rmap = {
    lead: 'lead',
    hire: 'hire',
    people: 'people',
    proc: 'proc',
    aiproc: 'aiproc',
    prod: 'prod',
    cust: 'cust',
    bud: 'bud',
    acq: 'acq',
    inc: 'inc',
    comp: 'comp',
    it: 'it',
  };
  qa('#responsibilities [role="tabpanel"][id^="rp-"]').forEach((p) => {
    const key = p.id.slice(3);
    const file = p.getAttribute('aria-label') || key;
    const h = q('h3', p);
    const body = [q('.c-rs-s', p), q('.c-rs-pts', p), q('.c-rs-n', p) && q('.c-rs-n', p).parentNode, q('.c-rs-body', p)]
      .filter(Boolean)
      .map(txt)
      .join(' ');
    add('resp-' + key, file + (h ? ': ' + clean(txt(h)) : ''), body, '#responsibilities', 'resp', rmap[key] || key);
  });
  const cmap = {
    'monorepo.md': 'mono',
    'refactor.md': 'refactor',
    'ci-cd.md': 'ci',
    'testing.md': 'test',
    'aws.md': 'aws',
    'security.md': 'sec',
    'auth.md': 'auth',
    'data.md': 'data',
    'cost.md': 'cost',
    'ai/platform.md': 'ai',
    'accessibility.md': 'a11y',
    'i18n.md': 'i18n',
    'webmcp.md': 'mcp',
    'this-site.md': 'site',
  };
  qa('#case-studies [role="tabpanel"]').forEach((p) => {
    const file = p.getAttribute('aria-label') || '';
    const h = q('h3', p);
    add(
      'case-' + (cmap[file] || file),
      file + (h ? ': ' + clean(txt(h)) : ''),
      txt(p),
      '#case-studies',
      'case',
      cmap[file] || '',
    );
  });
  const stack = q('#stack');
  if (stack) {
    const rows = qa('#stack .c-sq-row')
      .map((r) => {
        const kids = Array.from(r.children).filter((k) => !k.classList.contains('c-sq-tog'));
        const items = kids
          .slice(1)
          .flatMap((k) => (k.children.length ? Array.from(k.children) : [k]))
          .map((x) => clean(txt(x)))
          .filter(Boolean);
        return items.length ? clean(txt(kids[0])) + ' ' + items.join(', ') : '';
      })
      .filter(Boolean);
    add('stack', 'Skills and tools (stack)', rows.length ? rows.join('. ') : txt(stack), '#stack');
  }
  ['oss', 'recommendations'].forEach((id) => {
    const n = q('#' + id);
    if (n) add(id, id === 'oss' ? 'Open source' : 'Recommendations', txt(n), '#' + id);
  });
  const aw = q('section[aria-labelledby="c-awards"]');
  if (aw)
    add(
      'recognition',
      'Recognition and education',
      clean(txt(aw))
        .replace(/\$ cat recognition\.txt\s*→?\s*/, 'Recognition: ')
        .replace(/\s*\$ cat education\.txt\s*(# education)?\s*/, '. Education: '),
      '#recommendations',
    );
  qa('#faq details').forEach((d, i) => {
    const sum = q('summary', d);
    // The question is the title; the text is just the answer, so it isn't read back to the visitor.
    const answer = Array.from(d.childNodes)
      .filter((n) => n !== sum)
      .map(txt)
      .join(' ');
    add('faq-' + (i + 1), 'FAQ: ' + (sum ? clean(txt(sum)) : ''), answer, '#faq');
  });
  return out;
}

async function prerender() {
  const { chromium } = await import('playwright');
  const srv = await serve(OUT);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: 'reduce',
      colorScheme: 'dark',
    });
    await page.addInitScript(() => {
      window.CRAGA_PRERENDER = true;
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(srv.url, { waitUntil: 'load' });
    await page.waitForSelector('#app .c-root');
    await page.waitForTimeout(300);
    if (errors.length) throw new Error('page errors during prerender:\n' + errors.join('\n'));
    // The chat bar and mic buttons only work with JavaScript, so leave it out of the static HTML; the runtime adds it.
    // Real section heights at a few widths, so skipped sections reserve the right space.
    const cis = [];
    for (const [w, media] of /** @type {[number, string][]} */ ([
      [390, '(max-width:600px)'],
      [768, '(min-width:601px) and (max-width:900px)'],
      [1280, '(min-width:901px) and (max-width:1400px)'],
      [1680, '(min-width:1401px)'],
    ])) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(150);
      const rules = await page.evaluate(() => {
        document.documentElement.classList.add('cv-all');
        const out = [];
        document.querySelectorAll('.v2-main>section.c-rv').forEach((sec) => {
          const sel = sec.id
            ? '#' + sec.id
            : sec.getAttribute('aria-labelledby')
              ? `section[aria-labelledby="${sec.getAttribute('aria-labelledby')}"]`
              : null;
          if (sel) out.push(`${sel}{--cis:${Math.round(sec.getBoundingClientRect().height)}px}`);
        });
        document.documentElement.classList.remove('cv-all');
        return out.join('');
      });
      cis.push(`@media ${media}{${rules}}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(150);
    const html = await page.$eval('#app', (el) => {
      const c = /** @type {Element} */ (el.cloneNode(true));
      c.querySelectorAll('.c-chat, .c-mic, .v2-time').forEach((n) => n.remove());
      return c.innerHTML;
    });
    const passages = await page.evaluate(extractPassages);
    const panels = await page.evaluate(() =>
      [
        ...document.querySelectorAll(
          '#responsibilities [role="tabpanel"][id^="rp-"], #case-studies .c-cs-panels [role="tabpanel"]',
        ),
      ].map((p) => ({
        kind: p.closest('#responsibilities') ? 'resp' : 'case',
        file: p.getAttribute('aria-label'),
        html: p.outerHTML,
      })),
    );
    // Each blog post, briefly: what it's about and where to read it.
    for (const b of POSTS)
      passages.push({
        id: 'blog-' + b.slug,
        title: `${b.slug}.md: ${b.title} (blog post, ${b.date.slice(0, 4)})`,
        text:
          (
            `A post Craig wrote on his old blog (craigsworks.com) on ${b.date}` +
            (b.tags.length ? `, about ${b.tags.join(', ')}` : '') +
            '. ' +
            b.text
          )
            .slice(0, 1200)
            .replace(/\s\S*$/, '') + '…',
        href: 'blog/' + b.slug + '/',
        kind: 'blog',
        key: b.slug,
      });
    const index = { generated: new Date().toISOString(), passages };
    writeFileSync(join(OUT, 'assets', 'ask-index.json'), JSON.stringify(index));
    mkdirSync(join(ROOT, 'worker'), { recursive: true });
    writeFileSync(join(ROOT, 'worker', 'knowledge.json'), JSON.stringify(index, null, 1) + '\n');
    // The rest of what the worker's MCP tools serve: the CV and the projects the page links to.
    const projects = await page.evaluate(() => window.CragaAgent.linkedProjects(document));
    // Keep the last open-source snapshot if this build can't read the oss branch.
    let prevAgent = null;
    if (existsSync(join(ROOT, 'worker', 'agent-data.json')))
      prevAgent = JSON.parse(readFileSync(join(ROOT, 'worker', 'agent-data.json'), 'utf8'));
    writeFileSync(
      join(ROOT, 'worker', 'agent-data.json'),
      JSON.stringify(
        {
          cv: JSON.parse(readFileSync(join(SRC, 'cv.json'), 'utf8')),
          projects,
          oss: OSS_SNAPSHOT || (prevAgent && prevAgent.oss) || null,
        },
        null,
        1,
      ) + '\n',
    );
    console.log(
      'ask.sh index:',
      passages.length,
      'passages,',
      passages.reduce((n, p) => n + p.text.length, 0),
      'chars',
    );
    const file = join(OUT, 'index.html');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('<!--PRERENDER-->', html).replace('/*CIS*/', cis.join('\n')),
    );
    await buildOgImage(browser);
    await buildFilePages(browser, panels);
    await buildPdf(browser, srv.url);
  } finally {
    await browser.close();
    srv.close();
  }
}

// ---------- images ----------
async function buildImages() {
  const sharp = (await import('sharp')).default;
  const dir = join(OUT, 'assets', 'img');
  mkdirSync(dir, { recursive: true });
  const src = join(SRC, 'portrait.webp');
  for (const w of [96, 192, 352]) {
    await sharp(src)
      .resize(w, w)
      .webp({ quality: 80, effort: 6 })
      .toFile(join(dir, `portrait-${w}.webp`));
    await sharp(src)
      .resize(w, w)
      .avif({ quality: 55, effort: 6 })
      .toFile(join(dir, `portrait-${w}.avif`));
  }
  await sharp(src).resize(56, 56).webp({ quality: 80 }).toFile(join(dir, 'portrait-56.webp'));
  await sharp(Buffer.from(FAVICON))
    .resize(180, 180)
    .flatten({ background: '#16271F' })
    .png()
    .toFile(join(OUT, 'apple-touch-icon.png'));
}

// Social preview card (1200x630), rendered with the site's own fonts and colours.
async function buildOgImage(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const font = (f) => 'data:font/woff2;base64,' + readFileSync(join(SRC, 'fonts', f)).toString('base64');
  const img =
    'data:image/webp;base64,' + readFileSync(join(OUT, 'assets', 'img', 'portrait-352.webp')).toString('base64');
  await page.setContent(`<!doctype html><html><head><style>
@font-face{font-family:BS;src:url(${font('big-shoulders-display-latin-600.woff2')});font-weight:100 900}
@font-face{font-family:PS;src:url(${font('public-sans-latin-400.woff2')});font-weight:100 900}
@font-face{font-family:RH;src:url(${font('red-hat-mono-latin-400.woff2')});font-weight:300 700}
html,body{margin:0;width:1200px;height:630px;background:#16271F;color:#F6F8F4;overflow:hidden}
.c{position:relative;box-sizing:border-box;width:1200px;height:630px;padding:72px 80px;display:flex;flex-direction:column;justify-content:space-between;
 background:radial-gradient(circle at 24px 24px,#47685A 3px,transparent 3.5px),radial-gradient(circle at calc(100% - 24px) 24px,#47685A 3px,transparent 3.5px),radial-gradient(circle at 24px calc(100% - 24px),#47685A 3px,transparent 3.5px),radial-gradient(circle at calc(100% - 24px) calc(100% - 24px),#47685A 3px,transparent 3.5px)}
.cmd{font:500 30px RH;color:#B7D47A}.cmd span{color:#7C9A8B}
.row{display:flex;align-items:center;gap:52px}
.ph{flex:none;width:236px;height:236px;border-radius:8px;overflow:hidden;background:#fff;box-shadow:0 0 0 6px #47685A,0 0 0 8px #335041}
.ph img{width:100%;height:100%;display:block;object-fit:cover}
h1{margin:0;font:900 112px/0.88 BS;letter-spacing:.005em}
.st{margin-top:22px;font:600 38px/1.2 BS;color:#8EC3E6}
.ft{display:flex;justify-content:space-between;align-items:center;font:500 28px RH;color:#A7BFB2}
.ft b{color:#F6F8F4;font-weight:700}.dot{display:inline-block;width:14px;height:14px;border-radius:50%;background:#B7D47A;margin-right:14px;vertical-align:middle}
.arc{position:absolute;left:80px;right:80px;bottom:150px;height:200px;opacity:.12}
</style></head><body><div class="c">
<svg class="arc" viewBox="0 0 1040 200" preserveAspectRatio="none"><path d="M0 200 Q520 -60 1040 200" fill="none" stroke="#E7EEEA" stroke-width="4"/></svg>
<div class="cmd">$ cat README.md <span># intro</span></div>
<div class="row"><div class="ph"><img src="${img}"></div><div><h1>Craig Michael<br>Thompson</h1><div class="st">Head of Engineering · hands-on, AI-first</div></div></div>
<div class="ft"><span><span class="dot"></span>open to new roles · Newcastle upon Tyne, UK</span><b>craigthompson.dev</b></div>
</div></body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(100);
  await page.screenshot({ path: join(OUT, 'og.png'), type: 'png' });
  await page.close();
  const sharp = (await import('sharp')).default;
  const buf = await sharp(join(OUT, 'og.png')).png({ palette: true, quality: 90, effort: 10 }).toBuffer();
  writeFileSync(join(OUT, 'og.png'), buf);
}

// ---------- one page per case study and responsibility ----------
// /case-studies/<file>/ and /responsibilities/<file>/: the same content as the tab on the home page,
// as a static page with its own title, description and social preview, for sharing and search.
const SLUG = (f) => f.replace(/\.md$/, '').replace(/\//g, '-');
const SECTION = {
  case: { dir: 'case-studies', label: 'case-studies/', home: 'case', name: 'Case study' },
  resp: { dir: 'responsibilities', label: 'responsibilities/', home: 'resp', name: 'Responsibility' },
};
const HOME_KEYS = {
  case: {
    'monorepo.md': 'mono',
    'refactor.md': 'refactor',
    'ci-cd.md': 'ci',
    'testing.md': 'test',
    'accessibility.md': 'a11y',
    'i18n.md': 'i18n',
    'aws.md': 'aws',
    'security.md': 'sec',
    'auth.md': 'auth',
    'data.md': 'data',
    'cost.md': 'cost',
    'ai/platform.md': 'ai',
    'webmcp.md': 'mcp',
    'this-site.md': 'site',
  },
  resp: {
    'leadership.md': 'lead',
    'hiring.md': 'hire',
    'people.md': 'people',
    'process.md': 'proc',
    'ai.md': 'aiproc',
    'product.md': 'prod',
    'customers.md': 'cust',
    'budget.md': 'bud',
    'acquisition.md': 'acq',
    'incidents.md': 'inc',
    'compliance.md': 'comp',
    'it.md': 'it',
  },
};
const strip = (h) =>
  h
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?)])/g, '$1')
    .trim();

function cleanPanel(html, kind, where) {
  const terms = new Map();
  const tipFor = (text) => {
    const t = text.toLowerCase();
    for (const [k, [title, def]] of Object.entries(HOME.tips || {}))
      if (title.toLowerCase().includes(t) || t.includes(title.toLowerCase())) return [k, title, def];
    return null;
  };
  const h = html
    .replace(/\s+data-dc-[a-z]+="\d+"/g, '')
    .replace(/<canvas[^>]*><\/canvas>/g, '')
    .replace(/<button type="button" class="c-term"[^>]*>([\s\S]*?)<\/button>/g, (m, text) => {
      const tip = tipFor(strip(text));
      if (tip) terms.set(tip[0], tip);
      return `<span class="c-term-s">${text}</span>`;
    })
    .replace(
      /<a class="c-see" href="#(responsibilities|case-studies)"([^>]*)>([^<]+)<\/a>/g,
      (m, sec, rest, file) => `<a class="c-see" href="../../${sec}/${SLUG(file.trim())}/" translate="no">${file}</a>`,
    )
    .replace(
      /<button type="button" class="c-dd">([\s\S]*?<span style="color: var\(--acc\)"(?: translate="no")?>([\w./-]+\.md) →<\/span>)<\/button>/g,
      (m, inner, file) =>
        where[file]
          ? `<a class="c-dd" href="../../${where[file]}/${SLUG(file)}/">${inner}</a>`
          : `<div class="c-dd">${inner}</div>`,
    )
    .replace(/href="#c-tests"/g, 'href="../../#c-tests"')
    // Whether this browser has WebMCP only means something on the home page, where the tools are.
    .replace(/<p class="c-mcp-live"[\s\S]*?<\/p>/, '')
    .replace(/<button type="button" class="c-mcp-copy"[^>]*>[^<]*<\/button>/, '')
    // Live CI results only load on the home page: point there instead of showing placeholders.
    .replace(
      /<div style="font-size: 13px; color: var\(--mute\); margin-bottom: 10px">Latest results<\/div>\s*<ul class="c-live"[\s\S]*?<\/ul>/,
      '<div style="font-size: 13px; color: var(--mute); margin-bottom: 10px">Latest results</div><p style="margin: 0; color: var(--text3)">The latest Lighthouse, WCAG and ask.sh test results are live on <a href="../../?case=site#case-studies">the home page</a>.</p>',
    )
    .replace(/<details class="c-rs-more"/g, '<details class="c-rs-more" open')
    .replace(/^<div role="tabpanel"(?: id="[^"]*")? aria-label="[^"]*"/, '<div');
  return { html: h, terms: [...terms.values()] };
}

// A page's social preview (1200×630): the command, a kicker line and the title, in the site's style.
async function ogImage(og, dir, cmd, kicker, title) {
  const font = (f) => 'data:font/woff2;base64,' + readFileSync(join(SRC, 'fonts', f)).toString('base64');
  const sharp = (await import('sharp')).default;
  const h3 = title;
  await og.setContent(`<!doctype html><html><head><style>
@font-face{font-family:BS;src:url(${font('big-shoulders-display-latin-600.woff2')});font-weight:100 900}
@font-face{font-family:PS;src:url(${font('public-sans-latin-400.woff2')});font-weight:100 900}
@font-face{font-family:RH;src:url(${font('red-hat-mono-latin-400.woff2')});font-weight:300 700}
html,body{margin:0;width:1200px;height:630px;background:#16271F;color:#F6F8F4;overflow:hidden}
.c{position:relative;box-sizing:border-box;width:1200px;height:630px;padding:68px 80px;display:flex;flex-direction:column;justify-content:space-between;background:radial-gradient(circle at 24px 24px,#47685A 3px,transparent 3.5px),radial-gradient(circle at calc(100% - 24px) 24px,#47685A 3px,transparent 3.5px),radial-gradient(circle at 24px calc(100% - 24px),#47685A 3px,transparent 3.5px),radial-gradient(circle at calc(100% - 24px) calc(100% - 24px),#47685A 3px,transparent 3.5px)}
.cmd{font:500 30px RH;color:#B7D47A}.k{margin-top:14px;font:400 24px RH;color:#8EC3E6}
h1{margin:0;font:900 96px/0.92 BS;letter-spacing:.005em;max-width:1000px}
.ft{display:flex;justify-content:space-between;align-items:center;font:500 26px RH;color:#A7BFB2}.ft b{color:#F6F8F4}
.arc{position:absolute;left:80px;right:80px;bottom:120px;height:220px;opacity:.10}
</style></head><body><div class="c"><svg class="arc" viewBox="0 0 1040 200" preserveAspectRatio="none"><path d="M0 200 Q520 -60 1040 200" fill="none" stroke="#E7EEEA" stroke-width="4"/></svg>
<div><div class="cmd">$ cat ${esc(cmd)}</div>${kicker ? `<div class="k">${esc(kicker)}</div>` : ''}</div>
<h1 style="font-size:${h3.length > 56 ? 60 : h3.length > 34 ? 74 : 96}px">${esc(h3)}</h1>
<div class="ft"><span>Craig Michael Thompson · Head of Engineering</span><b>craigthompson.dev</b></div></div></body></html>`);
  await og.evaluate(() => document.fonts.ready);
  const shot = await og.screenshot({ type: 'png' });
  mkdirSync(join(OUT, dir), { recursive: true });
  writeFileSync(join(OUT, dir, 'og.png'), await sharp(shot).png({ palette: true, quality: 90, effort: 10 }).toBuffer());
}

const pageThemeHead = () =>
  (HOME.themeHead || '').replace("document.querySelector('#app .c-root')", "document.querySelector('.c-root')");

// The shell every file page shares: head, header with theme and motion buttons, scripts.
function pageShell({ title, desc, url, depth, cssName, socialTitle, imageAlt, ld, main }) {
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
${social({ title: socialTitle, desc, url, type: 'article', image: url + 'og.png', imageAlt })}
<script type="application/ld+json">${JSON.stringify(ld)}</script>
${meta(depth)}
${pageThemeHead()}
${preloadFont(depth + 'assets/fonts/big-shoulders-display-latin-600.woff2')}
${preloadFont(depth + 'assets/fonts/public-sans-latin-400.woff2')}
<link rel="stylesheet" href="${depth}${cssName}">
${NAV_HEAD(depth)}
</head>
<body>
<div class="c-root" style="background: var(--bg); color: var(--text); min-height: 100vh; font-size: 16px; line-height: 1.7">
<div class="sp">
<header class="sp-top"><a class="sp-home" href="${depth}"><span class="c-dot" style="width: 9px; height: 9px; border-radius: 50%; background: var(--ok)"></span>craigthompson.dev</a>
<div class="sp-tools"><button type="button" class="sp-b" id="sp-search" aria-haspopup="dialog" aria-keyshortcuts="Control+K Meta+K" title="Search and jump (Ctrl+K)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>search</button><button type="button" class="sp-b" id="sp-theme">theme</button><button type="button" class="sp-b" id="sp-motion" hidden>pause animations</button></div></header>
<main class="sp-main">
${main}</main>
</div>
</div>
<script>(function(){var d=document.documentElement,r=document.querySelector('.c-root'),tb=document.getElementById('sp-theme'),mb=document.getElementById('sp-motion');
function label(){var L=r.classList.contains('c-light');tb.textContent=L?'dark theme':'light theme';tb.setAttribute('aria-label',L?'Switch to dark theme':'Switch to light theme')}
tb.addEventListener('click',function(){var L=!r.classList.contains('c-light');r.classList.toggle('c-light',L);d.classList.toggle('t-light',L);d.classList.toggle('t-dark',!L);try{localStorage.setItem('theme',L?'light':'dark')}catch(e){}label()});label();
var loops=document.querySelector('.c-glow,.c-trav,.c-tick,.c-b1,.c-ping');var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
if(loops&&!reduce){mb.hidden=false;var ml=function(){var off=r.classList.contains('still');mb.textContent=off?'play animations':'pause animations'};mb.addEventListener('click',function(){var off=!r.classList.contains('still');r.classList.toggle('still',off);try{localStorage.setItem('motion',off?'off':'on')}catch(e){}ml()});ml()}})()</script>
<script>${i18nBoot()}</script>
<script>${paletteBoot()}</script>
${ASK.endpoint ? '<script>' + beacon(ASK.endpoint, false) + '</script>' : ''}
${cfAnalytics}
</body>
</html>
`;
}

// The search-and-jump palette for the pages other than the home page (src/palette.js), with its
// list filled in: the home page's sections, every file page and post, and a few actions. It loads
// when someone asks for it (Ctrl/⌘+K, /, or the search button), so pages don't pay for it otherwise.
let PALETTE_PATH = '';
function writePalette(panels) {
  const sections = [
    ['top', 'README.md', 'intro about summary home'],
    ['career', 'career.log', 'experience jobs history work employers'],
    ['responsibilities', 'responsibilities/', 'roles leadership'],
    ['case-studies', 'case-studies/', 'projects work'],
    ['stack', 'stack/', 'skills tools technologies'],
    ['oss', 'open-source/', 'github pull requests contributions'],
    ['blog', 'blog/', 'posts writing articles'],
    ['recommendations', 'recommendations.txt', 'references testimonials'],
    ['faq', 'faq.md', 'questions'],
    ['ask', 'ask.sh', 'ai question chat'],
    ['contact', 'get-in-touch.md', 'contact email hire talk get in touch'],
  ];
  const items = [
    ...sections.map(([id, label, kw]) => ({ icon: '#', label, kind: 'section', path: '#' + id, kw })),
    { icon: '▤', label: 'Open the plain CV', kind: 'action', path: 'cv/', kw: 'resume' },
    { icon: '↓', label: 'Download cv.pdf', kind: 'action', path: 'cv.pdf', kw: 'resume pdf' },
    {
      icon: '@',
      label: 'Copy email address',
      kind: 'action',
      action: 'email',
      kw: 'contact mail email craga89@gmail.com',
    },
    { icon: '◐', label: 'Switch theme', kind: 'action', action: 'theme', kw: 'theme dark light mode colours' },
    { icon: '✎', label: 'blog/ index', kind: 'section', path: 'blog/', kw: 'posts writing' },
    ...POSTS.map((b) => ({
      icon: '✎',
      label: b.title,
      kind: 'post · ' + b.date.slice(0, 4),
      path: `blog/${b.slug}/`,
      kw: 'blog post ' + b.tags.join(' '),
    })),
    ...['resp', 'case'].flatMap((kind) =>
      panels
        .filter((p) => p.kind === kind)
        .map((p) => ({
          icon: '›',
          label: SECTION[kind].label + p.file,
          kind: kind === 'case' ? 'case study' : 'responsibility',
          path: `${SECTION[kind].dir}/${SLUG(p.file)}/`,
        })),
    ),
    { icon: '↗', label: 'GitHub profile', kind: 'link', path: 'https://github.com/Craga89', kw: 'craga89 code' },
    {
      icon: '↗',
      label: 'LinkedIn profile',
      kind: 'link',
      path: 'https://www.linkedin.com/in/craigmichaelthompson/',
      kw: 'linkedin',
    },
  ];
  const src = readFileSync(join(SRC, 'palette.js'), 'utf8').replace('/*ITEMS*/ []', JSON.stringify(items));
  if (src.includes('/*ITEMS*/')) throw new Error('src/palette.js: the ITEMS placeholder was not filled in');
  PALETTE_PATH = '/assets/palette.' + hash(src) + '.js';
  writeOut(PALETTE_PATH.slice(1), src);
  const cv = join(OUT, 'cv', 'index.html');
  if (existsSync(cv)) writeFileSync(cv, readFileSync(cv, 'utf8').replace('__PALETTE_PATH__', PALETTE_PATH));
}

// Opens the palette on Ctrl/⌘+K, on / (unless single-key shortcuts are off), or from the search button.
// The CV page is written before the palette (which needs the prerendered file list), so it gets a
// placeholder that writePalette fills in.
const paletteBoot =
  () => `(function(){var p;function go(){(p=p||import(${JSON.stringify(PALETTE_PATH || '__PALETTE_PATH__')})).then(function(m){m.toggle()})}
var b=document.getElementById('sp-search');if(b)b.addEventListener('click',go);
document.addEventListener('keydown',function(e){var k=e.key;if((e.metaKey||e.ctrlKey)&&!e.altKey&&!e.shiftKey&&(k==='k'||k==='K')){e.preventDefault();go();return}
if(k!=='/'||e.metaKey||e.ctrlKey||e.altKey||e.defaultPrevented)return;try{if(localStorage.getItem('keys')==='off')return}catch(x){/* storage blocked: shortcuts stay on */}
var t=e.target;if(t&&(t.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))||document.querySelector('dialog[open]'))return;e.preventDefault();go()})})()`;

async function buildFilePages(browser, panels) {
  writePalette(panels);
  const css = `${fontFaces('fonts/', ['Big Shoulders Display', 'Public Sans', 'Red Hat Mono'])}
${FALLBACKS}
${HOME.css}
/* file pages */
.sp{max-width:980px;margin:0 auto;padding:clamp(18px,4vw,40px) clamp(16px,4vw,40px) 72px}
.sp-top{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin-bottom:clamp(20px,4vw,36px)}
.sp-home{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-family:var(--f-mono);font-weight:700;color:var(--head)!important;text-decoration:none}
.sp-tools{display:flex;gap:8px;flex-wrap:wrap}
.sp-b{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border:1px solid var(--line3);border-radius:8px;font-size:13px;color:var(--text3)}
.sp-b:hover{border-color:var(--acc);color:var(--head)}
.sp-b:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.sp-crumb{margin:0 0 18px;font-family:var(--f-mono);font-size:clamp(15px,2vw,18px);color:var(--ok)}
.sp-crumb a{color:inherit}
.sp-main .c-rs{border:1px solid var(--line2);border-radius:12px;background:var(--panel)}
.sp-main>div>.c-pop,.sp-main .c-pop{animation:none}
.c-term-s{border-bottom:1px dotted currentColor}
.sp-terms{margin-top:28px;border-top:1px dashed var(--line3);padding-top:16px}
.sp-terms h2,.sp-more h2{margin:0 0 10px;font-family:var(--f-mono);font-size:14px;font-weight:500;color:var(--ok)}
.sp-terms dl{margin:0;display:grid;gap:8px}
.sp-terms dt{color:var(--head);font-weight:700}
.sp-terms dd{margin:0 0 6px;color:var(--text3);font-size:14.5px}
.sp-pn{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:28px}
.sp-pn a{display:inline-flex;flex-direction:column;gap:2px;min-height:44px;padding:10px 14px;border:1px solid var(--line3);border-radius:8px;text-decoration:none!important;max-width:48%}
.sp-pn a span{font-size:12px;color:var(--dim)}
.sp-pn a b{font-family:var(--f-mono);font-weight:500;color:var(--acc)}
.sp-pn .next{margin-inline-start:auto;text-align:end}
.sp-more{margin-top:36px}
.sp-more ul{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}
.sp-more a{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border:1px solid var(--line3);border-radius:6px;font-family:var(--f-mono);font-size:13px;text-decoration:none!important;color:var(--text3)}
.sp-more a[aria-current="page"]{border-color:var(--acc);color:var(--head);background:var(--acc-bg)}
.sp-cta{margin-top:40px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px 20px;border:1px solid var(--acc);border-radius:12px;background:var(--acc-bg);padding:18px 20px}
.sp-cta p{margin:0;color:var(--text2);max-width:52ch}
.sp-cta p b{color:var(--head)}
.sp-cta div{display:flex;flex-wrap:wrap;gap:10px}
.sp-cta a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border-radius:8px;font-weight:700;text-decoration:none!important}
.sp-cta a.go{background:var(--acc);color:var(--bg)!important}
.sp-cta a.alt{border:1px solid var(--line3);color:var(--head)!important}
@media print{.sp-tools,.sp-more,.sp-pn,.sp-cta{display:none!important}}
/* blog posts */
.sp-post{max-width:72ch}
.sp-post-h{margin:0 0 28px}
.sp-post-k{margin:0 0 10px;font-family:var(--f-mono);font-size:13px;color:var(--mute)}
.sp-post-k b{font-weight:500;color:var(--acc)}
.sp-post h1{margin:0 0 14px;font-family:var(--f-head);font-size:clamp(34px,5.4vw,56px);line-height:1;color:var(--head);letter-spacing:.005em;text-wrap:balance}
.sp-post-note{margin:0;padding:10px 14px;border-inline-start:3px solid var(--line3);background:var(--panel);border-radius:0 8px 8px 0;font-size:14px;color:var(--text3)}
.sp-post-b{color:var(--text2);font-size:17px;line-height:1.75}
.sp-post-b>*{margin:0 0 1.1em}
.sp-post-b h2,.sp-post-b h3,.sp-post-b h4{margin:1.8em 0 .6em;color:var(--head);font-family:var(--f-head);line-height:1.15;letter-spacing:.005em}
.sp-post-b h2{font-size:30px}.sp-post-b h3{font-size:24px}.sp-post-b h4{font-size:20px}
.sp-post-b a{color:var(--acc);text-underline-offset:3px}
.sp-post-b code{font-family:var(--f-mono);font-size:.88em;padding:.08em .35em;border-radius:4px;background:var(--panel2);border:1px solid var(--line2)}
.sp-post-b pre{overflow:auto;padding:14px 16px;border:1px solid var(--line2);border-radius:10px;background:var(--panel);font-size:14px;line-height:1.6;direction:ltr;text-align:left}
.sp-post-b pre:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
.sp-post-b pre code{padding:0;border:0;background:none;font-size:inherit}
.sp-post-b img{max-width:100%;height:auto;border-radius:8px;border:1px solid var(--line2)}
.sp-post-b blockquote{margin-inline:0;padding:2px 16px;border-inline-start:3px solid var(--acc);color:var(--text3)}
.sp-post-b ul,.sp-post-b ol{padding-inline-start:1.4em}
.sp-post-b li{margin:.3em 0}
.sp-post-b table{border-collapse:collapse;display:block;overflow:auto}
.sp-post-b th,.sp-post-b td{border:1px solid var(--line2);padding:6px 10px}
.sp-tags{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 16px;padding:0;list-style:none}
.sp-tags li{font-family:var(--f-mono);font-size:12px;padding:2px 8px;border:1px solid var(--line3);border-radius:999px;color:var(--text3)}
.sp-bl{list-style:none;margin:0 0 28px;padding:0;border-top:1px dashed var(--line2)}
.sp-bl li{display:grid;grid-template-columns:7.5em minmax(0,1fr);gap:4px 18px;padding:14px 0;border-bottom:1px dashed var(--line2)}
.sp-bl time{font-family:var(--f-mono);font-size:13px;color:var(--dim);padding-top:3px}
.sp-bl a{font-weight:600;font-size:17px;color:var(--head);text-decoration:none}
.sp-bl a:hover{text-decoration:underline;text-decoration-color:var(--acc);text-underline-offset:3px}
.sp-bl p{margin:4px 0 0;font-size:14.5px;color:var(--text3)}
.sp-yr{margin:30px 0 8px;font-family:var(--f-mono);font-size:14px;font-weight:500;color:var(--ok)}
@media (max-width:640px){.sp-bl li{grid-template-columns:minmax(0,1fr)}}
@media print{.sp-post-b pre{white-space:pre-wrap}.sp-prog{display:none!important}}
/* reading progress: driven by scrolling, no script */
.sp-prog{display:none;position:fixed;z-index:60;inset-inline:0;top:0;height:3px;background:var(--acc);transform-origin:left center;transform:scaleX(0);pointer-events:none}
[dir="rtl"] .sp-prog{transform-origin:right center}
@supports (animation-timeline: scroll()){.sp-prog{display:block;animation:sp-prog linear both;animation-timeline:scroll(root)}}
@keyframes sp-prog{to{transform:scaleX(1)}}
`;
  const cssName = 'assets/pages.' + hash(css) + '.css';
  writeOut(cssName, css);
  const groups = { case: panels.filter((p) => p.kind === 'case'), resp: panels.filter((p) => p.kind === 'resp') };
  const where = Object.fromEntries(panels.map((p) => [p.file, SECTION[p.kind].dir]));
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const urls = [];
  for (const kind of ['case', 'resp']) {
    const list = groups[kind],
      S = SECTION[kind];
    for (let i = 0; i < list.length; i++) {
      const p = list[i],
        slug = SLUG(p.file),
        dir = `${S.dir}/${slug}/`;
      const { html, terms } = cleanPanel(p.html, kind, where);
      const h3 = strip((html.match(/<h3[^>]*>([\s\S]*?)<\/h3>/) || [])[1] || p.file);
      const kicker = strip(
        (html.match(/<div style="font-size: 13px; color: var\(--acc\)">([\s\S]*?)<\/div>/) || [])[1] || '',
      );
      const lead = strip((html.match(/<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/) || [])[1] || '');
      const desc =
        (lead.length > 158 ? lead.slice(0, 155).replace(/\s\S*$/, '') + '…' : lead) ||
        `${h3}: ${S.name.toLowerCase()} from Craig Michael Thompson's portfolio.`;
      const title = `${h3} · ${p.file} · Craig Michael Thompson`;
      const url = `${SITE}/${dir}`;
      const prev = list[(i - 1 + list.length) % list.length],
        next = list[(i + 1) % list.length];
      const homeLink = `../../?${S.home}=${HOME_KEYS[kind][p.file]}#${S.dir}`;
      // Social preview for this file.
      await ogImage(og, dir, S.label + p.file, kicker, h3);
      const ld = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: h3,
        name: p.file,
        description: desc,
        url,
        image: url + 'og.png',
        inLanguage: 'en-GB',
        dateModified: TODAY,
        author: { '@type': 'Person', '@id': SITE + '/#person', name: 'Craig Michael Thompson', url: SITE + '/' },
        isPartOf: { '@type': 'WebSite', name: 'craigthompson.dev', url: SITE + '/' },
      };
      const page = pageShell({
        title,
        desc,
        url,
        depth: '../../',
        cssName,
        socialTitle: `${h3} · ${p.file}`,
        imageAlt: `${h3}. ${S.label}${p.file}, Craig Michael Thompson`,
        ld,
        main: `<p class="sp-crumb">$ cat <a href="${homeLink}">${S.label}</a>${esc(p.file)}</p>
<h1 class="c-sr">${esc(h3)}</h1>
${html}
${terms.length ? `<section class="sp-terms" aria-labelledby="sp-terms-h"><h2 id="sp-terms-h"># terms used</h2><dl>${terms.map(([, t, d]) => `<dt>${esc(t)}</dt><dd>${esc(d)}</dd>`).join('')}</dl></section>` : ''}
<nav class="sp-pn" aria-label="More ${S.label}"><a href="../${SLUG(prev.file)}/"><span>← previous</span><b>${esc(prev.file)}</b></a><a class="next" href="../${SLUG(next.file)}/"><span>next →</span><b>${esc(next.file)}</b></a></nav>
<section class="sp-more" aria-labelledby="sp-more-h"><h2 id="sp-more-h">$ ls ${S.label}</h2><ul>${list.map((x) => `<li><a href="../${SLUG(x.file)}/"${x === p ? ' aria-current="page"' : ''}>${esc(x.file)}</a></li>`).join('')}</ul></section>
<aside class="sp-cta" aria-label="About Craig"><p><b>Craig Michael Thompson</b>, Head of Engineering: hands-on, AI-first, from start-up to acquisition. Open to new roles.</p><div><a class="go" href="mailto:craga89@gmail.com">./get-in-touch</a><a class="alt" href="${homeLink}">see it in the portfolio</a><a class="alt" href="../../cv/">CV</a></div></aside>
`,
      });
      writeFileSync(join(OUT, dir, 'index.html'), page);
      urls.push(url);
    }
  }
  await buildBlog(og, cssName, urls);
  await og.close();
  HOME.pageUrls = urls;
  console.log('file pages:', urls.length);
}

// ---------- the blog: /blog/ and /blog/<slug>/ from src/blog/*.md ----------
const LONG_DATE = (d) =>
  new Date(d + 'T12:00:00Z').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
async function renderPost(md, imgDir) {
  const { marked } = await import('marked');
  const sharp = (await import('sharp')).default;
  // Headings start at h2 (the post title is the h1), keeping the post's own steps between levels.
  const levels = [...md.matchAll(/^(#{1,6}) /gm)].map((m) => m[1].length);
  const shift = levels.length ? Math.min(...levels) - 2 : 0;
  const sizes = {};
  for (const m of md.matchAll(/!\[[^\]]*\]\(img\/([^)\s]+)\)/g)) {
    try {
      sizes[m[1]] = await sharp(join(imgDir, m[1])).metadata();
    } catch (e) {
      console.warn(`can't read ${join(imgDir, m[1])} (${errorMessage(e)}), so it has no width and height`);
    }
  }
  const renderer = new marked.Renderer();
  renderer.heading = ({ tokens, depth }) => {
    const l = Math.min(6, Math.max(2, depth - shift));
    return `<h${l}>${renderer.parser.parseInline(tokens)}</h${l}>\n`;
  };
  renderer.code = ({ text, lang }) =>
    `<pre tabindex="0" translate="no"${lang ? ` data-lang="${esc(lang)}"` : ''}><code${lang ? ` class="language-${esc(lang)}"` : ''}>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>\n`;
  // Links between old posts point at their new pages.
  const slugs = new Set(POSTS.map((b) => b.slug));
  renderer.link = ({ href, title, tokens }) => {
    const m = String(href).match(
      /^https?:\/\/(?:blog\.craigsworks\.com|(?:www\.)?craigsworks\.com\/blog\/\d{4}\/\d{2})\/([\w-]+)\/?(#.*)?$/,
    );
    const to = m && slugs.has(m[1]) ? `../${m[1]}/${m[2] || ''}` : href;
    return `<a href="${esc(to)}"${title ? ` title="${esc(title)}"` : ''}>${renderer.parser.parseInline(tokens)}</a>`;
  };
  renderer.image = ({ href, text }) => {
    const f = String(href).replace(/^img\//, '');
    const m = sizes[f];
    return `<img src="../img/${esc(f)}" alt="${esc(text || '')}" loading="lazy" decoding="async"${m ? ` width="${m.width}" height="${m.height}"` : ''}>`;
  };
  return marked.parse(md, { renderer, gfm: true });
}

async function buildBlog(og, cssName, urls) {
  if (!POSTS.length) return;
  const IMG = join(SRC, 'blog', 'img');
  if (existsSync(IMG)) {
    mkdirSync(join(OUT, 'blog', 'img'), { recursive: true });
    for (const f of readdirSync(IMG)) copyFileSync(join(IMG, f), join(OUT, 'blog', 'img', f));
  }
  const cta = (depth) =>
    `<aside class="sp-cta" aria-label="About Craig"><p><b>Craig Michael Thompson</b>, Head of Engineering: hands-on, AI-first, from start-up to acquisition. Open to new roles.</p><div><a class="go" href="mailto:craga89@gmail.com">./get-in-touch</a><a class="alt" href="${depth}#blog">the portfolio</a><a class="alt" href="${depth}cv/">CV</a></div></aside>`;
  const author = { '@type': 'Person', '@id': SITE + '/#person', name: 'Craig Michael Thompson', url: SITE + '/' };
  for (let i = 0; i < POSTS.length; i++) {
    const b = POSTS[i],
      dir = `blog/${b.slug}/`,
      url = `${SITE}/${dir}`;
    const newer = POSTS[i - 1],
      older = POSTS[i + 1];
    const html = await renderPost(b.md, IMG);
    const desc = b.summary.length > 158 ? b.summary.slice(0, 155).replace(/\s\S*$/, '') + '…' : b.summary;
    await ogImage(
      og,
      dir,
      `blog/${b.slug}.md`,
      `${LONG_DATE(b.date)}${b.tags.length ? ' · ' + b.tags.slice(0, 3).join(' · ') : ''}`,
      b.title,
    );
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: b.title,
      description: desc,
      url,
      image: url + 'og.png',
      inLanguage: 'en-GB',
      datePublished: b.date,
      keywords: b.tags.join(', '),
      author,
      isPartOf: { '@type': 'Blog', name: 'Craig Michael Thompson · blog', url: SITE + '/blog/' },
      ...(b.original ? { sameAs: b.original } : {}),
    };
    const main = `<div class="sp-prog" aria-hidden="true"></div>
<p class="sp-crumb">$ cat <a href="../">blog/</a>${esc(b.slug)}.md</p>
<article class="sp-post">
<header class="sp-post-h"><p class="sp-post-k"><time datetime="${b.date}">${LONG_DATE(b.date)}</time> · ${b.minutes} min read</p>
<h1 style="view-transition-name: p-${b.slug}; view-transition-class: post-title">${esc(b.title)}</h1>
${b.tags.length ? `<ul class="sp-tags" aria-label="Tags">${b.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
<p class="sp-post-note">First published on my old blog${b.original ? ` (<a href="${esc(b.archived || b.original)}">${esc(new URL(b.original).host)}</a>)` : ''} in ${new Date(b.date + 'T12:00:00Z').toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, and kept as it was written. Some code and links are out of date.</p></header>
<div class="sp-post-b">
${html}</div>
</article>
<nav class="sp-pn" aria-label="More posts">${newer ? `<a href="../${newer.slug}/"><span>← newer</span><b>${esc(newer.title)}</b></a>` : '<span></span>'}${older ? `<a class="next" href="../${older.slug}/"><span>older →</span><b>${esc(older.title)}</b></a>` : ''}</nav>
<section class="sp-more" aria-labelledby="sp-more-h"><h2 id="sp-more-h">$ ls blog/</h2><ul>${POSTS.map((x) => `<li><a href="../${x.slug}/"${x === b ? ' aria-current="page"' : ''}>${esc(x.slug)}.md</a></li>`).join('')}</ul></section>
${cta('../../')}
`;
    mkdirSync(join(OUT, dir), { recursive: true });
    writeFileSync(
      join(OUT, dir, 'index.html'),
      pageShell({
        title: `${b.title} · blog · Craig Michael Thompson`,
        desc,
        url,
        depth: '../../',
        cssName,
        socialTitle: b.title,
        imageAlt: `${b.title}. blog/${b.slug}.md, Craig Michael Thompson`,
        ld,
        main,
      }),
    );
    urls.push(url);
  }
  // The index: every post, newest first, by year.
  const years = [...new Set(POSTS.map((b) => b.date.slice(0, 4)))];
  const url = `${SITE}/blog/`;
  const span = `${years[years.length - 1]}–${years[0]}`;
  const desc = `${POSTS.length} posts from Craig Michael Thompson's old blog on craigsworks.com, ${span}: JavaScript, qTip2, Knockout, Durandal, webpack and more.`;
  await ogImage(og, 'blog/', 'ls -t blog/', `${POSTS.length} posts · ${span}`, 'Blog');
  const main = `<p class="sp-crumb">$ ls -t <a href="../#blog">blog/</a></p>
<h1 class="c-sr">Blog</h1>
<p style="margin: 0 0 8px; color: var(--text3); max-width: 64ch">${POSTS.length} posts from my old blog on craigsworks.com, ${span}, kept as they were written. Some of the tools have since moved on.</p>
${years
  .map(
    (y) =>
      `<h2 class="sp-yr">${y}</h2><ol class="sp-bl">${POSTS.filter((b) => b.date.startsWith(y))
        .map(
          (b) =>
            `<li><time datetime="${b.date}">${LONG_DATE(b.date).replace(/ \d{4}$/, '')}</time><div><a href="${b.slug}/" style="view-transition-name: p-${b.slug}; view-transition-class: post-title">${esc(b.title)}</a><p>${esc(b.summary)}</p></div></li>`,
        )
        .join('')}</ol>`,
  )
  .join('\n')}
${cta('../')}
`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Craig Michael Thompson · blog',
    description: desc,
    url,
    author,
    blogPost: POSTS.map((b) => ({
      '@type': 'BlogPosting',
      headline: b.title,
      datePublished: b.date,
      url: `${SITE}/blog/${b.slug}/`,
    })),
  };
  writeFileSync(
    join(OUT, 'blog', 'index.html'),
    pageShell({
      title: 'Blog · Craig Michael Thompson',
      desc,
      url,
      depth: '../',
      cssName,
      socialTitle: 'Blog · Craig Michael Thompson',
      imageAlt: `Blog: ${POSTS.length} posts, ${span}. Craig Michael Thompson`,
      ld,
      main,
    }),
  );
  urls.push(url);
  console.log('blog:', POSTS.length, 'posts');
}

// The plain CV as a PDF, printed by Chromium with the page's own print styles.
async function buildPdf(browser, base) {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.goto(base + 'cv/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: join(OUT, 'cv.pdf'),
    format: 'A4',
    preferCSSPageSize: true,
    printBackground: true,
    tagged: true,
    outline: true,
  });
  await page.close();
}

// Contact card (vCard 3.0, CRLF line endings, long lines folded at 75 octets).
async function buildVcard() {
  const sharp = (await import('sharp')).default;
  const photo = (
    await sharp(join(SRC, 'portrait.webp'))
      .resize(192, 192)
      .flatten({ background: '#FFFFFF' })
      .jpeg({ quality: 78 })
      .toBuffer()
  ).toString('base64');
  const fold = (line) => {
    const out = [];
    let rest = Buffer.from(line, 'utf8');
    out.push(rest.subarray(0, 75).toString('utf8'));
    rest = rest.subarray(75);
    while (rest.length) {
      out.push(' ' + rest.subarray(0, 74).toString('utf8'));
      rest = rest.subarray(74);
    }
    return out.join('\r\n');
  };
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    'N:Thompson;Craig;Michael;;',
    'FN:Craig Michael Thompson',
    'TITLE:Head of Engineering',
    'EMAIL;TYPE=INTERNET,PREF:craga89@gmail.com',
    `URL:${SITE}/`,
    'ADR;TYPE=HOME:;;;Newcastle upon Tyne;;;United Kingdom',
    'X-SOCIALPROFILE;TYPE=linkedin:https://www.linkedin.com/in/craigmichaelthompson/',
    'X-SOCIALPROFILE;TYPE=github:https://github.com/Craga89',
    'NOTE:Hands-on\\, AI-first Head of Engineering and full-stack engineer. Open to new roles.',
    `PHOTO;ENCODING=b;TYPE=JPEG:${photo}`,
    'END:VCARD',
  ];
  writeOut('craig-thompson.vcf', lines.map(fold).join('\r\n') + '\r\n');
}

// llms.txt (a plain summary for AI assistants), humans.txt and security.txt.
function buildTextFiles() {
  const cv = JSON.parse(readFileSync(join(SRC, 'cv.json'), 'utf8'));
  const b = cv.basics;
  const job = (w) =>
    `### ${w.position}, ${w.name} (${w.startDate.slice(0, 4)}${w.endDate ? '–' + w.endDate.slice(0, 4) : '–present'})\n\n${w.summary}\n${(w.highlights || []).map((h) => '\n- ' + h).join('')}`;
  writeOut(
    'llms.txt',
    `# ${b.name}

> ${b.label}. ${b.summary}

Location: ${b.location.city}, UK. Contact: ${b.email}.

## Links

- [Portfolio](${SITE}/): career, responsibilities, case studies, stack, open source, FAQ and ask.sh
- [Plain CV](${SITE}/cv/), also as [PDF](${SITE}/cv.pdf) and [JSON Resume](${SITE}/cv.json)
- [GitHub](https://github.com/Craga89)
- [LinkedIn](https://www.linkedin.com/in/craigmichaelthompson/)

For AI agents: the same content is available as tools (get_profile, get_career, list_files, read_file, search_site, ask, get_open_source, get_site_report) from the MCP server at ${ASK.endpoint ? ASK.endpoint.replace(/\/ask$/, '/mcp') : '(not configured)'}, and on the portfolio page itself in browsers with WebMCP.

## Experience

${cv.work.map(job).join('\n\n')}

## Education

${cv.education.map((e) => `- ${e.studyType}, ${e.area}, ${e.institution} (${e.startDate}–${e.endDate})`).join('\n')}

## Skills

${cv.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`).join('\n')}
`,
  );
  writeOut(
    'humans.txt',
    `/* TEAM */
Name: Craig Michael Thompson
Role: Head of Engineering, full-stack engineer
Contact: ${b.email}
GitHub: https://github.com/Craga89
From: Newcastle upon Tyne, UK

/* SITE */
Last update: ${TODAY}
Standards: HTML, CSS, JavaScript, WCAG 2.2 AA
Components: a small hand-written runtime, prerendered with Playwright
Fonts: Big Shoulders Display, Public Sans, Red Hat Mono (self-hosted)
Hosting: GitHub Pages; ask.sh on Cloudflare Workers AI
Source: https://github.com/Craga89/portfolio
`,
  );
  const expires = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 19) + 'Z';
  writeOut(
    '.well-known/security.txt',
    `Contact: mailto:${b.email}
Expires: ${expires}
Preferred-Languages: en
Canonical: ${SITE}/.well-known/security.txt
`,
  );
}

// Service worker: network-first for pages (always fresh when online), cache-first for
// content-hashed and static assets, everything available offline after the first visit.
// live.json is written by the Pages deploy from CI results (tools/live.mjs). Locally there's an
// empty one, so the page falls back to its static numbers without a 404.
function writeLivePlaceholder() {
  if (!existsSync(join(OUT, 'live.json'))) writeFileSync(join(OUT, 'live.json'), '{}');
}

function buildServiceWorker(appName) {
  const core = [
    './',
    'cv/',
    appName,
    'assets/fonts/big-shoulders-display-latin-600.woff2',
    'assets/fonts/public-sans-latin-400.woff2',
    'assets/fonts/red-hat-mono-latin-400.woff2',
    'assets/img/portrait-56.webp',
    'favicon.svg',
  ];
  const version = hash(core.join('|') + TODAY + readFileSync(join(OUT, 'index.html'), 'utf8').length);
  writeOut(
    'sw.js',
    `// Generated by tools/build.mjs
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

// ---------- main ----------
const TODAY = new Date().toISOString().slice(0, 10);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'fonts'), { recursive: true });
for (const f of readdirSync(join(SRC, 'fonts')).filter((name) => name.endsWith('.woff2')))
  copyFileSync(join(SRC, 'fonts', f), join(OUT, 'assets', 'fonts', f));
writeOut('index.html', buildHome(TODAY));
writeOut('cv/index.html', buildCV());
writeOut('404.html', NOT_FOUND);
writeOut('favicon.svg', FAVICON);
writeOut('CNAME', DOMAIN + '\n');
writeOut('.nojekyll', '');
writeOut(
  'robots.txt',
  ALLOW_INDEXING ? `User-agent: *\nAllow: /\nSitemap: https://${DOMAIN}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n',
);
writeOut(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://${DOMAIN}/</loc><lastmod>${TODAY}</lastmod></url>
<url><loc>https://${DOMAIN}/cv/</loc><lastmod>${TODAY}</lastmod></url>
</urlset>
`,
);
copyFileSync(join(SRC, 'cv.json'), join(OUT, 'cv.json'));
await buildImages();
await buildVcard();
buildTextFiles();
if (PRERENDER) await prerender();
if (HOME.pageUrls)
  writeOut(
    'sitemap.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://${DOMAIN}/</loc><lastmod>${TODAY}</lastmod></url>
<url><loc>https://${DOMAIN}/cv/</loc><lastmod>${TODAY}</lastmod></url>
${HOME.pageUrls.map((u) => `<url><loc>${u}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n')}
</urlset>
`,
  );
writeLivePlaceholder();
buildServiceWorker(
  readdirSync(join(OUT, 'assets'))
    .filter((f) => /^app\.[0-9a-f]+\.js$/.test(f))
    .map((f) => 'assets/' + f)[0],
);
console.log('built', OUT);
