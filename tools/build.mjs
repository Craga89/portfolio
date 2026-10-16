// Builds the static craga.dev site from the design files in src/ into site/.
//   node tools/build.mjs            build + prerender (needs Playwright + Chromium)
//   node tools/build.mjs --no-prerender
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const OUT = join(ROOT, 'site');
const DOMAIN = 'craga.dev';
const PRERENDER = !process.argv.includes('--no-prerender');

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

const META_COMMON = `<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark light">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">`;

// ---------- home page ----------
function buildHome() {
  const d = splitDesign('ThemeTyne.dc.html');
  let code = d.code;
  // The animated shader canvases are hidden in this theme, so don't load them at all.
  code = code.replace('async syncTabFx() {', 'async syncTabFx() { return;');
  code = code.replace('async mountFx() {', 'async mountFx() { return;');
  const template = d.template.replace(/href="\/cv"/g, 'href="/cv/"');
  const props = d.props.replace('"$preview"', '"$x"');
  const boot = `<script>
(function () {
  var saved = null;
  try { saved = localStorage.getItem('theme'); } catch (e) {}
  var light = false;
  try { light = window.matchMedia('(prefers-color-scheme: light)').matches; } catch (e) {}
  var app = DCRuntime.mount({ root: '#app', template: '#dc-template', script: '#dc-component', props: { theme: saved || (light ? 'light' : 'dark') } });
  var set = app.c.setState;
  app.c.setState = function (p) {
    if (p && typeof p === 'object' && 'theme' in p) { try { localStorage.setItem('theme', p.theme); } catch (e) {} }
    return set.apply(this, arguments);
  };
})();
</script>`;
  return `<!doctype html>
<html lang="en">
<head>
${d.head.trim()}
${META_COMMON}
${d.helmet.trim()}
</head>
<body>
<div id="app"><!--PRERENDER--></div>
<template id="dc-template">
${template}
</template>
<script type="text/x-dc" id="dc-component" data-props='${props}'>${code}</script>
<script src="/assets/dc-runtime.js"></script>
${boot}
</body>
</html>
`;
}

// ---------- CV page (static; the only interaction is the print button) ----------
function buildCV() {
  const d = splitDesign('CV.dc.html');
  const body = d.template
    .replace(/onClick="\{\{print\}\}"/g, 'onclick="window.print()"')
    .replace(/\s*hint-placeholder-[a-z]+="[^"]*"/g, '');
  if (/\{\{/.test(body)) throw new Error('CV still has template holes');
  const head = d.head.replace('href="https://craga.dev/cv"', 'href="https://craga.dev/cv/"');
  return `<!doctype html>
<html lang="en">
<head>
${head.trim()}
${META_COMMON}
${d.helmet.trim()}
</head>
<body>
${body}
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
<title>Not found · craga.dev</title>
${META_COMMON}
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Red+Hat+Mono:wght@400;700&display=swap">
<style>
body{margin:0;min-height:100vh;display:grid;place-items:center;background:#16271F;color:#E7EEEA;font-family:'Red Hat Mono',ui-monospace,monospace;padding:24px;box-sizing:border-box}
main{max-width:56ch}
h1{font-size:20px;font-weight:400;color:#B7D47A;margin:0 0 12px}
p{margin:0 0 20px;color:#C9D8CF;line-height:1.6}
a{color:#8EC3E6}
@media (prefers-color-scheme: light){body{background:#EDF1EE;color:#1B2A22}h1{color:#4E7A1E}p{color:#30403A}a{color:#1F6E9C}}
</style>
</head>
<body>
<main>
<h1>$ cat this-page<br>cat: this-page: No such file or directory</h1>
<p>That address doesn't exist on craga.dev. It may have moved when the site was rebuilt.</p>
<p><a href="/">Go to the home page</a> · <a href="/cv/">Read the CV</a></p>
</main>
</body>
</html>
`;

function writeOut(rel, content) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// ---------- prerender ----------
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.xml': 'application/xml' };
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

async function prerender() {
  const { chromium } = await import('playwright');
  const srv = await serve(OUT);
  const port = srv.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', colorScheme: 'dark' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
    await page.waitForSelector('#app .c-root');
    await page.waitForTimeout(300);
    if (errors.length) throw new Error('page errors during prerender:\n' + errors.join('\n'));
    const html = await page.$eval('#app', (el) => el.innerHTML);
    const file = join(OUT, 'index.html');
    writeFileSync(file, readFileSync(file, 'utf8').replace('<!--PRERENDER-->', html));
  } finally {
    await browser.close();
    srv.close();
  }
}

// ---------- main ----------
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
writeOut('index.html', buildHome());
writeOut('cv/index.html', buildCV());
writeOut('404.html', NOT_FOUND);
writeOut('favicon.svg', FAVICON);
writeOut('CNAME', DOMAIN + '\n');
writeOut('.nojekyll', '');
writeOut('robots.txt', `User-agent: *\nAllow: /\nSitemap: https://${DOMAIN}/sitemap.xml\n`);
const today = new Date().toISOString().slice(0, 10);
writeOut('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://${DOMAIN}/</loc><lastmod>${today}</lastmod></url>
<url><loc>https://${DOMAIN}/cv/</loc><lastmod>${today}</lastmod></url>
</urlset>
`);
mkdirSync(join(OUT, 'assets'), { recursive: true });
copyFileSync(join(ROOT, 'tools', 'dc-runtime.js'), join(OUT, 'assets', 'dc-runtime.js'));
copyFileSync(join(SRC, 'portrait.webp'), join(OUT, 'portrait.webp'));
copyFileSync(join(SRC, 'cv.json'), join(OUT, 'cv.json'));
if (PRERENDER) await prerender();
console.log('built', OUT);
