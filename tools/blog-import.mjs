#!/usr/bin/env node
// Turn the recovered blog posts (tools/blog-fetch.mjs, blog-import branch) into Markdown files in
// src/blog/: <slug>.md with front matter, and their images in src/blog/img/. Run once; after that
// the Markdown files are the source, and can be edited like any other.
//
//   node tools/blog-import.mjs <import dir>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN = process.argv[2];
if (!IN) { console.log('usage: node tools/blog-import.mjs <import dir>'); process.exit(1); }
const OUT = join(ROOT, 'src', 'blog');
mkdirSync(join(OUT, 'img'), { recursive: true });

// Left out: notices rather than posts (their old addresses redirect to the blog index).
const SKIP = new Set(['holiday', 'where-are-you-using-qtip']);
// Names of colleagues stay off the site.
const EDITS = { 'jquery-ui-draggable-exclusive-draggables': [[/Shout out to to my friend and colleague \[[^\]]+\]\([^)]*\) who came up/, 'Shout out to a former colleague, who came up']] };
const posts = JSON.parse(readFileSync(join(IN, 'posts.json'), 'utf8')).filter((p) => p.file && !SKIP.has(p.slug));
const gists = {};
if (existsSync(join(IN, 'gists'))) for (const f of readdirSync(join(IN, 'gists'))) { const g = JSON.parse(readFileSync(join(IN, 'gists', f), 'utf8')); gists[g.id] = g; }

const browser = await chromium.launch();
const page = await browser.newPage({ javaScriptEnabled: false });
const yaml = (v) => (/^[\w .,'()&/-]*$/.test(v) && !/^[-?:]/.test(v) ? v : JSON.stringify(v));
const done = [];
for (const p of posts) {
  const html = readFileSync(join(IN, p.file), 'utf8').replace(/<script\b[^>]*src="[^"]*gist\.github\.com[^"]*"[^>]*><\/script>/gi, (m) => m.replace('<script', '<x-gist').replace('</script>', '</x-gist>'));
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const imgMap = Object.fromEntries((p.images || []).filter((i) => i.file).map((i) => [i.src, i.file]));
  const r = await page.evaluate(({ orig, imgMap, gists }) => {
    const $ = (s) => document.querySelector(s);
    const meta = (k) => { const m = document.querySelector(`meta[property="${k}"],meta[name="${k}"]`); return m ? m.getAttribute('content') : ''; };
    const body = $('.post-content') || $('.entry-content') || $('.post .entry') || $('.entry');
    if (!body) return null;
    const pick = (...sels) => { for (const x of sels) { const n = $(x); if (n && n.textContent.trim()) return n.textContent; } return ''; };
    const title = (meta('og:title') || pick('.post-title', '.entry-title', '.post h2.title', 'article h1', 'h1') || document.title).replace(/\s*[|·–-]\s*craigsworks.*$/i, '').trim();
    let date = meta('article:published_time') || (($('time[datetime]') || {}).getAttribute ? $('time[datetime]').getAttribute('datetime') : '');
    if (!date) { const m = orig.match(/\/(\d{4})\/(\d{2})\//); const d = ($('.post-meta, .date, .post-date') || {}).textContent || ''; const day = (d.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/) || [])[1]; if (m) date = `${m[1]}-${m[2]}-${String(day || 1).padStart(2, '0')}`; }
    const tags = [...document.querySelectorAll('meta[property="article:tag"]')].map((m) => m.getAttribute('content'));
    if (!tags.length) { const a = document.querySelector('article[class*="tag-"], article[class*="category-"]'); if (a) a.className.split(/\s+/).forEach((c) => { const m = c.match(/^(?:tag|category)-(.+)$/); if (m && m[1] !== 'uncategorized') tags.push(m[1].replace(/-/g, ' ')); }); }

    // HTML → Markdown, for the handful of elements old posts use.
    const abs = (u) => { try { return new URL(u.replace(/^https?:\/\/web\.archive\.org\/web\/\d+[a-z_]*\//, ''), orig).href; } catch (e) { return u; } };
    const esc = (t) => t.replace(/([\\`*_[\]])/g, '\\$1');
    const inline = (n) => {
      if (n.nodeType === 3) return esc(n.data.replace(/\s+/g, ' '));
      if (n.nodeType !== 1) return '';
      const t = n.localName, kids = () => [...n.childNodes].map(inline).join('');
      if (t === 'br') return '  \n';
      if (t === 'strong' || t === 'b') { const k = kids().trim(); return k ? `**${k}**` : ''; }
      if (t === 'em' || t === 'i') { const k = kids().trim(); return k ? `*${k}*` : ''; }
      if (t === 'code' || t === 'kbd' || t === 'tt') { const c = n.textContent; const f = c.includes('`') ? '``' : '`'; return f + c + f; }
      if (t === 'a') { const h = n.getAttribute('href'); const k = kids().trim(); if (!h || h.startsWith('#') || !k) return k; return `[${k}](${abs(h)})`; }
      if (t === 'img') { const s = abs(n.getAttribute('src') || ''); const f = imgMap[s]; return f ? `![${(n.getAttribute('alt') || '').replace(/[[\]]/g, '')}](img/${f})` : ''; }
      if (t === 'x-gist' || t === 'script' || t === 'style' || t === 'iframe') return '';
      return kids();
    };
    const gist = (n) => {
      const src = n.getAttribute('src') || '';
      const id = (src.match(/\/([0-9a-f]{12,}|\d{5,})\.js/) || [])[1], file = (src.match(/[?&]file=([^&]+)/) || [])[1];
      const g = gists[id];
      if (!g) return `[See the code on GitHub](https://gist.github.com/${id})`;
      const files = Object.entries(g.files).filter(([name]) => !file || name === decodeURIComponent(file));
      return files.map(([name, f]) => { const lang = (f.language || '').toLowerCase().replace('javascript', 'js'); const fence = f.content.includes('```') ? '~~~~' : '```'; return `${fence}${lang}\n${f.content.replace(/\s+$/, '')}\n${fence}`; }).join('\n\n');
    };
    const block = (n, depth = 0) => {
      if (n.nodeType === 3) { const t = n.data.trim(); return t ? esc(t.replace(/\s+/g, ' ')) : ''; }
      if (n.nodeType !== 1) return '';
      const t = n.localName;
      if (/^h[1-6]$/.test(t)) { const k = [...n.childNodes].map(inline).join('').trim(); return k ? '#'.repeat(Math.min(6, Math.max(2, +t[1]))) + ' ' + k : ''; }
      if (t === 'p') return [...n.childNodes].map(inline).join('').replace(/^\s+|\s+$/g, '').replace(/ {2,}/g, ' ');
      if (t === 'pre') { const c = n.querySelector('code') || n; const lang = ((c.className || '').match(/(?:language|lang)-([\w+-]+)/) || [])[1] || ''; const txt = c.textContent.replace(/\s+$/, ''); const fence = txt.includes('```') ? '~~~~' : '```'; return `${fence}${lang}\n${txt}\n${fence}`; }
      if (t === 'ul' || t === 'ol') return [...n.children].filter((li) => li.localName === 'li').map((li, i) => { const mark = t === 'ol' ? `${i + 1}.` : '-'; const parts = []; let line = ''; for (const c of li.childNodes) { if (c.nodeType === 1 && (c.localName === 'ul' || c.localName === 'ol' || c.localName === 'pre' || c.localName === 'p')) { if (line.trim()) parts.push(line.trim()); line = ''; parts.push(block(c, depth + 1)); } else line += inline(c); } if (line.trim()) parts.push(line.trim()); const pad = ' '.repeat(mark.length + 1); return mark + ' ' + parts.join('\n\n').split('\n').map((l, j) => (j ? (l ? pad + l : '') : l)).join('\n'); }).join('\n');
      if (t === 'blockquote') return [...n.childNodes].map((c) => block(c, depth)).filter(Boolean).join('\n\n').split('\n').map((l) => '> ' + l).join('\n');
      if (t === 'hr') return '---';
      if (t === 'x-gist') return gist(n);
      if (t === 'img') return inline(n);
      if (t === 'table') return n.outerHTML.replace(/\s+(class|style|id)="[^"]*"/g, '');
      if (t === 'script' || t === 'style' || t === 'iframe' || t === 'noscript' || t === 'form' || t === 'button') return '';
      if (/share|social|related|comments|post-meta|author/.test(n.className || '')) return '';
      const kids = [...n.childNodes];
      if (kids.every((c) => c.nodeType === 3 || ['a', 'strong', 'b', 'em', 'i', 'code', 'span', 'br', 'img', 'kbd'].includes(c.localName))) return [...n.childNodes].map(inline).join('').trim();
      return kids.map((c) => block(c, depth)).filter(Boolean).join('\n\n');
    };
    const md = [...body.childNodes].map((c) => block(c)).filter((x) => x && x.trim()).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
    return { title, date: (date || '').slice(0, 10), tags: [...new Set(tags)], md };
  }, { orig: p.from, imgMap, gists });
  if (!r || !r.md) { console.log(`${p.slug}: no post body found`); continue; }
  // Old "Flattr this" buttons and empty links go; titles lose their markup.
  r.md = r.md.replace(/\[!\[[^\]]*flattr[^\]]*\]\([^)]*\)\]\([^)]*\)\s*/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  r.title = r.title.replace(/<[^>]+>/g, '').replace(/`/g, '').replace(/\s+/g, ' ').trim();
  for (const [re, to] of EDITS[p.slug] || []) { if (!re.test(r.md)) console.log(`${p.slug}: edit didn't apply: ${re}`); r.md = r.md.replace(re, to); }
  for (const i of p.images || []) if (i.file && r.md.includes(`img/${i.file}`)) copyFileSync(join(IN, 'img', i.file), join(OUT, 'img', i.file));
  const original = p.urls.find((u) => u.includes(p.slug)) || p.urls[0];
  const fm = ['---', `title: ${yaml(r.title)}`, `date: ${r.date}`, `tags: [${r.tags.map(yaml).join(', ')}]`, `original: ${original}`, `archived: https://web.archive.org/web/${p.snapshot}/${p.from}`, '---', ''].join('\n');
  writeFileSync(join(OUT, p.slug + '.md'), fm + r.md + '\n');
  done.push(`${r.date} ${p.slug} (${r.md.length} chars)`);
}
await browser.close();
console.log(done.sort().join('\n'));
console.log(`${done.length} posts written to src/blog/`);
