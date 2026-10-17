// Builds the static craigthompson.dev site from the design files in src/ into site/.
//   node tools/build.mjs            build + prerender (needs Playwright + Chromium)
//   node tools/build.mjs --no-prerender
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');
const DOMAIN = 'craigthompson.dev';
const PRERENDER = !process.argv.includes('--no-prerender');
// Keep search engines out while the content is being finished.
// Set to true (or run with --public) when the site is ready to be found.
const ALLOW_INDEXING = process.argv.includes('--public') || false;
// ask.sh: the Cloudflare Worker URL lives in ask.config.json ("" = search-only).
const ASK = existsSync(join(ROOT, 'ask.config.json')) ? JSON.parse(readFileSync(join(ROOT, 'ask.config.json'), 'utf8')) : { endpoint: '' };
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
const meta = (root) => `<meta name="viewport" content="width=device-width, initial-scale=1">${ROBOTS_META}
<meta name="color-scheme" content="dark light">
<meta name="theme-color" content="#16271F" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#EDF1EE" media="(prefers-color-scheme: light)">
<link rel="icon" href="${root}favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${root}apple-touch-icon.png">`;

// ---------- shared head pieces ----------
const SITE = 'https://' + DOMAIN;
const HOME_TITLE = 'Craig Michael Thompson · Head of Engineering, hands-on & AI-first';
const CV_DESC = 'CV of Craig Michael Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK, open to technical leadership roles.';
const HOME_DESC = 'Craig Michael Thompson: hands-on, AI-first Head of Engineering and full-stack engineer in Newcastle upon Tyne, UK. 20+ years, from start-up to acquisition.';
const OG_DESC = "Hands-on, AI-first Head of Engineering and full-stack engineer. 20+ years' experience in software development and management, from start-up to acquisition.";
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function social({ title, desc, url, type }) {
  return [
    `<meta property="og:type" content="${type}">`,
    `<meta property="og:site_name" content="craigthompson.dev">`,
    `<meta property="og:locale" content="en_GB">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${SITE}/og.png">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="Craig Michael Thompson, Head of Engineering. craigthompson.dev">`,
    type === 'profile' ? `<meta property="profile:first_name" content="Craig">\n<meta property="profile:last_name" content="Thompson">` : '',
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(desc)}">`,
    `<meta name="twitter:image" content="${SITE}/og.png">`,
  ].filter(Boolean).join('\n');
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
        person.knowsAbout = [...new Set(['AI-first engineering', 'AI-assisted development', 'Engineering management', 'Full-stack development', ...(person.knowsAbout || []), 'Google Cloud'])];
        person.knowsLanguage = 'en-GB';
      }
      if (d['@type'] === 'ProfilePage') { d['@id'] = url; d.url = url; d.name = title; d.dateModified = today; d.inLanguage = 'en-GB'; }
      return `<script type="application/ld+json">${JSON.stringify(d)}</script>`;
    } catch (e) { return all; }
  });
  return head.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${social({ title, desc, url, type })}`);
}

// Cookie-free visit count: one small beacon as the visitor leaves (page, referring site, device
// class, sections seen, time on page). Skipped for Do Not Track / Global Privacy Control.
const beacon = (endpoint, sections) => !endpoint ? '' : `(function () {
  try {
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1' || !navigator.sendBeacon) return;
    var url = ${JSON.stringify(new URL(endpoint || 'https://x').origin + '/hit')}, t0 = Date.now(), seen = {}, sent = false;
    ${sections ? `seen.top = 1;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) seen[e.target.id] = 1; }); }, { threshold: 0.2 });
      document.querySelectorAll('main > section[id]').forEach(function (n) { io.observe(n); });
    }` : ''}
    var send = function () {
      if (sent) return; sent = true;
      var w = window.innerWidth;
      navigator.sendBeacon(url, new Blob([JSON.stringify({ path: location.pathname, ref: document.referrer, device: w < 601 ? 'mobile' : w < 1025 ? 'tablet' : 'desktop', sections: Object.keys(seen), seconds: (Date.now() - t0) / 1000 })], { type: 'text/plain' }));
    };
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') send(); });
    window.addEventListener('pagehide', send);
  } catch (e) {}
})();`;

// ---------- devtools greeting ----------
// A terminal-styled hello for anyone who opens the console, plus ask("…") to query ask.sh from there.
const BANNER = " ██████╗ ██████╗   █████╗  ██╗  ██████╗ \n██╔════╝ ██╔══██╗ ██╔══██╗ ██║ ██╔════╝ \n██║      ██████╔╝ ███████║ ██║ ██║  ███╗\n██║      ██╔══██╗ ██╔══██║ ██║ ██║   ██║\n╚██████╗ ██║  ██║ ██║  ██║ ██║ ╚██████╔╝\n ╚═════╝ ╚═╝  ╚═╝ ╚═╝  ╚═╝ ╚═╝  ╚═════╝ ";
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
    try { console.log(parts.map(function (p) { return '%c' + p[1]; }).join(''), ...parts.map(function (p) { return S[p[0]]; })); } catch (e) {}
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
  for (const m of css.matchAll(/@font-face\{font-family:'([^']+)';font-style:normal;font-weight:(\d+);font-display:swap;src:url\(FONTDIR\/([^)]+)\) format\('woff2'\);unicode-range:([^}]+)\}/g)) {
    const [, fam, w, file, range] = m;
    if (families && !families.includes(fam)) continue;
    const k = fam + '|' + file;
    const g = groups.get(k) || { fam, file, range, lo: +w, hi: +w };
    g.lo = Math.min(g.lo, +w); g.hi = Math.max(g.hi, +w);
    groups.set(k, g);
  }
  return [...groups.values()].map((g) => `@font-face{font-family:'${g.fam}';font-style:normal;font-weight:${g.lo === g.hi ? g.lo : g.lo + ' ' + g.hi};font-display:swap;src:url(${dir}${g.file}) format('woff2');unicode-range:${g.range}}`).join('\n');
}
const preloadFont = (href) => `<link rel="preload" href="${href}" as="font" type="font/woff2" crossorigin>`;
// Drop the Google Fonts links and point the font stacks at the metric-matched fallbacks.
const localFonts = (helmet) => helmet
  .replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.(googleapis|gstatic)\.com"[^>]*>/g, '')
  .replace(/\s*<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/g, '')
  .replace(/'Big Shoulders Display',/g, "'Big Shoulders Display','Big Shoulders Display Fallback',")
  .replace(/'Public Sans',/g, "'Public Sans','Public Sans Fallback',")
  .replace(/(font-family:\s*)'?Inter'?,/g, "$1'Inter','Inter Fallback',");

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

// Responsive portrait: AVIF and WebP at 1x/2x for each displayed size.
const PORTRAIT_ALT = 'Illustrated caricature of Craig Michael Thompson at his keyboard, with his dog on his shoulder';
const portraitPicture = () => `<picture><source type="image/avif" srcset="assets/img/portrait-96.avif 96w, assets/img/portrait-192.avif 192w, assets/img/portrait-352.avif 352w" sizes="(max-width: 370px) 68px, (max-width: 600px) 96px, 176px"><img src="assets/img/portrait-192.webp" srcset="assets/img/portrait-96.webp 96w, assets/img/portrait-192.webp 192w, assets/img/portrait-352.webp 352w" sizes="(max-width: 370px) 68px, (max-width: 600px) 96px, 176px" alt="${PORTRAIT_ALT}" width="512" height="512" fetchpriority="high" decoding="async"></picture>`;

// ---------- home page ----------
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
  code = code.replaceAll("const hdr = document.getElementById('c-hdr');\n      const gap", "document.documentElement.classList.add('cv-all');\n      const hdr = document.getElementById('c-hdr');\n      const gap");
  const template = d.template.replace(/href="\/cv\/?"/g, 'href="cv/"')
    .replace(/<img src="\.\/portrait\.webp" alt="Illustrated caricature[^"]*" width="512" height="512" loading="eager" decoding="async">/g, portraitPicture())
    .replace(/<img src="\.\/portrait\.webp" alt="" width="28" height="28" loading="lazy" decoding="async">/g, '<img src="assets/img/portrait-56.webp" alt="" width="28" height="28" loading="lazy" decoding="async">');
  if (/\.\/portrait\.webp/.test(template)) throw new Error('unhandled portrait image in the template');
  const props = d.props.replace('"$preview"', '"$x"');
  // Everything the page needs only once JavaScript runs (runtime, template, component,
  // boot) goes into one deferred, cache-busted file, so the HTML stays small.
  const app = readFileSync(join(ROOT, 'tools', 'dc-runtime.js'), 'utf8') + `
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
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  var light = false;
  try { light = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
  document.addEventListener('focusin', function (e) {
    var a = e.target && e.target.closest && e.target.closest('.v2-mbar nav a');
    if (a) try { a.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (x) {}
  });
  // Offline support and instant repeat visits (https only, so local previews aren't cached).
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  window.CRAGA_ASK = { endpoint: ${JSON.stringify(ASK.endpoint || '')}, index: 'assets/ask-index.json' };
  var app = DCRuntime.mount({ root: '#app', template: '#dc-template', script: '#dc-component', props: { theme: saved || (light ? 'light' : 'dark') } });
  var set = app.c.setState;
  app.c.setState = function (p) {
    if (p && typeof p === 'object' && 'theme' in p) { try { localStorage.setItem('theme', p.theme); } catch (e) {} }
    return set.apply(this, arguments);
  };
})();
${CONSOLE_HELLO}
${beacon(ASK.endpoint, true)}
`;
  const appName = 'assets/app.' + hash(app) + '.js';
  writeOut(appName, app);
  // Runs before first paint: applies a saved or system light theme to the prerendered (dark) markup.
  const themeNow = `<script>try{var r=document.querySelector('#app .c-root'),t=localStorage.getItem('theme');if(r&&(t?t==='light':matchMedia('(prefers-color-scheme: light)').matches))r.classList.add('c-light');if(r&&localStorage.getItem('motion')==='off')r.classList.add('still')}catch(e){}</script>`;
  const fonts = fontFaces('assets/fonts/', ['Big Shoulders Display', 'Public Sans', 'Red Hat Mono']);
  const head = seoHead(d.head.trim(), { title: HOME_TITLE, desc: HOME_DESC, url: SITE + '/', type: 'profile', today });
  return `<!doctype html>
<html lang="en-GB">
<head>
${head}
${meta('')}
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
<script>window.CRAGA_BUILD={sha:"__BUILD_SHA__",short:"__BUILD_SHORT__",date:"${today}",at:"__BUILD_AT__"}</script>
<script type="speculationrules">{"prerender":[{"source":"document","where":{"selector_matches":"a[href=\\"cv/\\"]"},"eagerness":"moderate"}]}</script>
<script src="${appName}" defer></script>
</head>
<body>
<div id="app"><!--PRERENDER--></div>
${themeNow}
</body>
</html>
`;
}

// ---------- CV page (static; the only interaction is the print button) ----------
function buildCV() {
  const d = splitDesign('CV.dc.html');
  const body = d.template
    .replace(/onClick="\{\{print\}\}"/g, 'onclick="window.print()"')
    .replace(/\s*hint-placeholder-[a-z]+="[^"]*"/g, '')
    .replace(/href="\/"/g, 'href="../"');
  if (/\{\{/.test(body)) throw new Error('CV still has template holes');
  const today = new Date().toISOString().slice(0, 10);
  const title = (d.head.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || 'CV';
  let head = d.head.replace('href="https://craigthompson.dev/cv"', 'href="https://craigthompson.dev/cv/"');
  head = seoHead(head.trim(), { title: title.replace(/&amp;/g, '&'), desc: CV_DESC, url: SITE + '/cv/', type: 'website', today });
  const inter = existsSync(join(SRC, 'fonts', 'inter-latin-400.woff2'));
  const helmet = inter ? localFonts(d.helmet.trim()) : d.helmet.trim();
  return `<!doctype html>
<html lang="en-GB">
<head>
${head}
${meta('../')}
<link rel="alternate" type="application/json" href="../cv.json" title="CV (JSON Resume)">
${inter ? preloadFont('../assets/fonts/inter-latin-400.woff2') + '\n<style>\n' + fontFaces('../assets/fonts/', ['Inter']) + '\n' + FALLBACKS + '\n</style>' : ''}
${helmet}
<script type="speculationrules">{"prerender":[{"source":"document","where":{"selector_matches":"a[href=\\"../\\"]"},"eagerness":"moderate"}]}</script>
</head>
<body>
${body}
${ASK.endpoint ? '<script>' + beacon(ASK.endpoint, false) + '</script>\n' : ''}</body>
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
  var base = /\.github\.io$/.test(location.hostname) ? '/' + location.pathname.split('/')[1] + '/' : '/';
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
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
function serve(dir) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const f = join(dir, p);
      if (!f.startsWith(dir) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' });
      res.end(readFileSync(f));
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// Pull the site's own words out of the rendered page as short passages. ask.sh
// searches these in the browser, and the Worker gives them to the model as its
// only source of facts.
function extractPassages() {
  const clean = (t) => String(t || '').replace(/\s+/g, ' ').replace(/\s+([,.;:!?)])/g, '$1').trim();
  const INLINE = new Set(['a', 'b', 'strong', 'em', 'i', 'code', 'mark', 'small', 'abbr', 'sup', 'sub', 'u']);
  const SKIP = new Set(['script', 'style', 'svg', 'canvas', 'input', 'template']);
  // Node text with a space between block-level pieces, so words don't run together.
  const txt = (n) => {
    if (!n) return '';
    if (n.nodeType === 3) return n.data;
    if (n.nodeType !== 1 || SKIP.has(n.localName)) return '';
    let out = '';
    for (const c of n.childNodes) out += txt(c);
    return INLINE.has(n.localName) ? out : ' ' + out + ' ';
  };
  const out = [];
  const add = (id, title, text, href, kind, key) => {
    // Drop the terminal decoration ($ cat file.txt, # comments, → bullets) so passages read as prose.
    text = clean(String(text || '')
      .replace(/\$ (?:cat|ls|grep -ri|git log|\.\/[\w.-]+)(?: [^\s#]+)?/g, ' ')
      .replace(/(^|\s)# [a-z][\w ./-]*?(?=\s{2}|\s[A-Z0-9→$]|$)/g, ' ')
      .replace(/\s*→\s*/g, '; ')
      .replace(/^[;\s]+/, ''));
    if (text.length > 1800) text = text.slice(0, 1800).replace(/\s\S*$/, '') + '…';
    if (text) out.push({ id, title: clean(title), text, href, kind: kind || 'link', key: key || '' });
  };
  const q = (sel, root) => (root || document).querySelector(sel);
  const qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const intro = q('section[aria-label="Introduction"]');
  if (intro) add('intro', 'About Craig', [q('h1', intro), q('.v2-st', intro), q('#about', intro)].map(txt).join(' '), '#top');
  const side = q('.v2-id');
  if (side) add('profile', 'Profile', txt(side) + '. Contact: craga89@gmail.com, github.com/Craga89, linkedin.com/in/craigmichaelthompson.', '#top');
  qa('#career article.c-job').forEach((a, i) => {
    const h = q('h3', a);
    add('career-' + (i + 1), h ? txt(h) : 'Career', txt(a), '#career');
  });
  const rmap = { lead: 'lead', hire: 'hire', people: 'people', proc: 'proc', aiproc: 'aiproc', prod: 'prod', cust: 'cust', bud: 'bud', acq: 'acq', inc: 'inc', comp: 'comp', it: 'it' };
  qa('#responsibilities [role="tabpanel"][id^="rp-"]').forEach((p) => {
    const key = p.id.slice(3);
    const file = p.getAttribute('aria-label') || key;
    const h = q('h3', p);
    const body = [q('.c-rs-s', p), q('.c-rs-pts', p), q('.c-rs-n', p) && q('.c-rs-n', p).parentNode, q('.c-rs-body', p)].filter(Boolean).map(txt).join(' ');
    add('resp-' + key, file + (h ? ': ' + clean(txt(h)) : ''), body, '#responsibilities', 'resp', rmap[key] || key);
  });
  const cmap = { 'monorepo.md': 'mono', 'refactor.md': 'refactor', 'ci-cd.md': 'ci', 'testing.md': 'test', 'aws.md': 'aws', 'security.md': 'sec', 'auth.md': 'auth', 'data.md': 'data', 'cost.md': 'cost', 'ai/platform.md': 'ai', 'accessibility.md': 'a11y' };
  qa('#case-studies [role="tabpanel"]').forEach((p) => {
    const file = p.getAttribute('aria-label') || '';
    const h = q('h3', p);
    add('case-' + (cmap[file] || file), file + (h ? ': ' + clean(txt(h)) : ''), txt(p), '#case-studies', 'case', cmap[file] || '');
  });
  const stack = q('#stack');
  if (stack) {
    const rows = qa('#stack .c-sq-row').map((r) => {
      const kids = Array.from(r.children);
      const items = kids.slice(1).flatMap((k) => (k.children.length ? Array.from(k.children) : [k])).map((x) => clean(txt(x))).filter(Boolean);
      return items.length ? clean(txt(kids[0])) + ' ' + items.join(', ') : '';
    }).filter(Boolean);
    add('stack', 'Skills and tools (stack)', rows.length ? rows.join('. ') : txt(stack), '#stack');
  }
  ['oss', 'recommendations'].forEach((id) => { const n = q('#' + id); if (n) add(id, id === 'oss' ? 'Open source' : 'Recommendations', txt(n), '#' + id); });
  const aw = q('section[aria-labelledby="c-awards"]');
  if (aw) add('recognition', 'Recognition and education', clean(txt(aw))
    .replace(/\$ cat recognition\.txt\s*→?\s*/, 'Recognition: ')
    .replace(/\s*\$ cat education\.txt\s*(# education)?\s*/, '. Education: '), '#recommendations');
  qa('#faq details').forEach((d, i) => {
    const sum = q('summary', d);
    // The question is the title; the text is just the answer, so it isn't read back to the visitor.
    const answer = Array.from(d.childNodes).filter((n) => n !== sum).map(txt).join(' ');
    add('faq-' + (i + 1), 'FAQ: ' + (sum ? clean(txt(sum)) : ''), answer, '#faq');
  });
  return out;
}

async function prerender() {
  const { chromium } = await import('playwright');
  const srv = await serve(OUT);
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('#app .c-root');
    await page.waitForTimeout(300);
    if (errors.length) throw new Error('page errors during prerender:\n' + errors.join('\n'));
    // The chat bar and mic buttons only work with JavaScript, so leave it out of the static HTML; the runtime adds it.
    // Real section heights at a few widths, so skipped sections reserve the right space.
    const cis = [];
    for (const [w, media] of [[390, '(max-width:600px)'], [768, '(min-width:601px) and (max-width:900px)'], [1280, '(min-width:901px) and (max-width:1400px)'], [1680, '(min-width:1401px)']]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(150);
      const rules = await page.evaluate(() => {
        document.documentElement.classList.add('cv-all');
        const out = [];
        document.querySelectorAll('.v2-main>section.c-rv').forEach((sec) => {
          const sel = sec.id ? '#' + sec.id : sec.getAttribute('aria-labelledby') ? `section[aria-labelledby="${sec.getAttribute('aria-labelledby')}"]` : null;
          if (sel) out.push(`${sel}{--cis:${Math.round(sec.getBoundingClientRect().height)}px}`);
        });
        document.documentElement.classList.remove('cv-all');
        return out.join('');
      });
      cis.push(`@media ${media}{${rules}}`);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.waitForTimeout(150);
    const html = await page.$eval('#app', (el) => { const c = el.cloneNode(true); c.querySelectorAll('.c-chat, .c-mic, .v2-time').forEach((n) => n.remove()); return c.innerHTML; });
    const passages = await page.evaluate(extractPassages);
    const index = { generated: new Date().toISOString(), passages };
    writeFileSync(join(OUT, 'assets', 'ask-index.json'), JSON.stringify(index));
    mkdirSync(join(ROOT, 'worker'), { recursive: true });
    writeFileSync(join(ROOT, 'worker', 'knowledge.json'), JSON.stringify(index, null, 1) + '\n');
    console.log('ask.sh index:', passages.length, 'passages,', passages.reduce((n, p) => n + p.text.length, 0), 'chars');
    const file = join(OUT, 'index.html');
    writeFileSync(file, readFileSync(file, 'utf8').replace('<!--PRERENDER-->', html).replace('/*CIS*/', cis.join('\n')));
    await buildOgImage(browser);
    await buildPdf(browser, port);
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
    await sharp(src).resize(w, w).webp({ quality: 80, effort: 6 }).toFile(join(dir, `portrait-${w}.webp`));
    await sharp(src).resize(w, w).avif({ quality: 55, effort: 6 }).toFile(join(dir, `portrait-${w}.avif`));
  }
  await sharp(src).resize(56, 56).webp({ quality: 80 }).toFile(join(dir, 'portrait-56.webp'));
  await sharp(Buffer.from(FAVICON)).resize(180, 180).flatten({ background: '#16271F' }).png().toFile(join(OUT, 'apple-touch-icon.png'));
}

// Social preview card (1200x630), rendered with the site's own fonts and colours.
async function buildOgImage(browser) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const font = (f) => 'data:font/woff2;base64,' + readFileSync(join(SRC, 'fonts', f)).toString('base64');
  const img = 'data:image/webp;base64,' + readFileSync(join(OUT, 'assets', 'img', 'portrait-352.webp')).toString('base64');
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

// The plain CV as a PDF, printed by Chromium with the page's own print styles.
async function buildPdf(browser, port) {
  const page = await browser.newPage();
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.goto(`http://127.0.0.1:${port}/cv/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: join(OUT, 'cv.pdf'), format: 'A4', preferCSSPageSize: true, printBackground: true, tagged: true, outline: true });
  await page.close();
}

// Contact card (vCard 3.0, CRLF line endings, long lines folded at 75 octets).
async function buildVcard() {
  const sharp = (await import('sharp')).default;
  const photo = (await sharp(join(SRC, 'portrait.webp')).resize(192, 192).flatten({ background: '#FFFFFF' }).jpeg({ quality: 78 }).toBuffer()).toString('base64');
  const fold = (line) => { const out = []; let rest = Buffer.from(line, 'utf8'); out.push(rest.subarray(0, 75).toString('utf8')); rest = rest.subarray(75); while (rest.length) { out.push(' ' + rest.subarray(0, 74).toString('utf8')); rest = rest.subarray(74); } return out.join('\r\n'); };
  const lines = [
    'BEGIN:VCARD', 'VERSION:3.0',
    'N:Thompson;Craig;Michael;;', 'FN:Craig Michael Thompson',
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
  const job = (w) => `### ${w.position}, ${w.name} (${w.startDate.slice(0, 4)}${w.endDate ? '–' + w.endDate.slice(0, 4) : '–present'})\n\n${w.summary}\n${(w.highlights || []).map((h) => '\n- ' + h).join('')}`;
  writeOut('llms.txt', `# ${b.name}

> ${b.label}. ${b.summary}

Location: ${b.location.city}, UK. Contact: ${b.email}.

## Links

- [Portfolio](${SITE}/): career, responsibilities, case studies, stack, open source, FAQ and ask.sh
- [Plain CV](${SITE}/cv/), also as [PDF](${SITE}/cv.pdf) and [JSON Resume](${SITE}/cv.json)
- [GitHub](https://github.com/Craga89)
- [LinkedIn](https://www.linkedin.com/in/craigmichaelthompson/)

## Experience

${cv.work.map(job).join('\n\n')}

## Education

${cv.education.map((e) => `- ${e.studyType}, ${e.area}, ${e.institution} (${e.startDate}–${e.endDate})`).join('\n')}

## Skills

${cv.skills.map((s) => `- ${s.name}: ${s.keywords.join(', ')}`).join('\n')}
`);
  writeOut('humans.txt', `/* TEAM */
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
`);
  const expires = new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 19) + 'Z';
  writeOut('.well-known/security.txt', `Contact: mailto:${b.email}
Expires: ${expires}
Preferred-Languages: en
Canonical: ${SITE}/.well-known/security.txt
`);
}

// Service worker: network-first for pages (always fresh when online), cache-first for
// content-hashed and static assets, everything available offline after the first visit.
function buildServiceWorker(appName) {
  const core = ['./', 'cv/', appName, 'assets/fonts/big-shoulders-display-latin-600.woff2', 'assets/fonts/public-sans-latin-400.woff2', 'assets/fonts/red-hat-mono-latin-400.woff2', 'assets/img/portrait-56.webp', 'favicon.svg'];
  const version = hash(core.join('|') + TODAY + readFileSync(join(OUT, 'index.html'), 'utf8').length);
  writeOut('sw.js', `// Generated by tools/build.mjs
const CACHE = 'craga-${version}';
const CORE = ${JSON.stringify(core)};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    // Pages: network first so content is never stale online; cached copy offline.
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  // Assets: cache first, then network (and keep a copy).
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
`);
}

// ---------- main ----------
const TODAY = new Date().toISOString().slice(0, 10);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'assets', 'fonts'), { recursive: true });
for (const f of readdirSync(join(SRC, 'fonts')).filter((f) => f.endsWith('.woff2'))) copyFileSync(join(SRC, 'fonts', f), join(OUT, 'assets', 'fonts', f));
writeOut('index.html', buildHome(TODAY));
writeOut('cv/index.html', buildCV());
writeOut('404.html', NOT_FOUND);
writeOut('favicon.svg', FAVICON);
writeOut('CNAME', DOMAIN + '\n');
writeOut('.nojekyll', '');
writeOut('robots.txt', ALLOW_INDEXING
  ? `User-agent: *\nAllow: /\nSitemap: https://${DOMAIN}/sitemap.xml\n`
  : 'User-agent: *\nDisallow: /\n');
writeOut('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://${DOMAIN}/</loc><lastmod>${TODAY}</lastmod></url>
<url><loc>https://${DOMAIN}/cv/</loc><lastmod>${TODAY}</lastmod></url>
</urlset>
`);
copyFileSync(join(SRC, 'cv.json'), join(OUT, 'cv.json'));
await buildImages();
await buildVcard();
buildTextFiles();
if (PRERENDER) await prerender();
buildServiceWorker(readdirSync(join(OUT, 'assets')).filter((f) => /^app\.[0-9a-f]+\.js$/.test(f)).map((f) => 'assets/' + f)[0]);
console.log('built', OUT);
