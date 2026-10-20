#!/usr/bin/env node
// Recover the old craigsworks blog posts from the Wayback Machine (run in CI: this needs the
// network). Finds the post addresses in the archived URL list (redirect-data branch,
// archive/archived.json), then saves each post's newest good snapshot, raw, with its images.
//
//   node tools/blog-fetch.mjs <archived.json> <out dir>
//
// Writes <out>/posts.json (one entry per post: address, snapshot, saved file, images) and
// <out>/html/<slug>.html, <out>/img/<file>. tools/blog-import.mjs turns these into src/blog/.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { errorMessage } from '../shared/errors.js';

const [archivedFile, OUT, MODE] = process.argv.slice(2);
// "gists": only (re)fetch the gists for posts already saved in <out>.
const GISTS_ONLY = MODE === 'gists';
if (!archivedFile || !OUT) {
  console.log('usage: node tools/blog-fetch.mjs <archived.json> <out dir>');
  process.exit(1);
}
mkdirSync(join(OUT, 'html'), { recursive: true });
mkdirSync(join(OUT, 'img'), { recursive: true });
const UA = { 'user-agent': 'craigthompson.dev blog recovery (github.com/Craga89/portfolio)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch, retrying rate limits and server errors with a growing wait.
 * @param {string | URL} url
 * @returns {Promise<Response>}
 */
async function get(url, tries = 5) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.status === 429 || r.status >= 500) throw new Error('HTTP ' + r.status);
      return r;
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(4000 * (i + 1));
    }
  }
  throw new Error('no attempts made at ' + url);
}

let out = [];
if (GISTS_ONLY) out = JSON.parse(readFileSync(join(OUT, 'posts.json'), 'utf8'));
else {
  // Post addresses: blog.craigsworks.com/<slug> (2012-16) and craigsworks.com/blog/<yyyy>/<mm>/<slug> (2010).
  const NOT_POSTS =
    /^(tag|category|author|page|rss|feed|about-me|assets|content|public|ghost|shared|search|archive|wp-[a-z]+|xmlrpc\.php|robots\.txt|favicon\.ico|sitemap.*|amp)$/i;
  const posts = new Map();
  for (const x of JSON.parse(readFileSync(archivedFile, 'utf8'))) {
    let u;
    try {
      u = new URL(x.url);
    } catch (e) {
      continue;
    }
    const segs = u.pathname.split('/').filter(Boolean);
    let slug = null;
    if (
      u.hostname === 'blog.craigsworks.com' &&
      segs.length >= 1 &&
      segs.length <= 2 &&
      (segs.length === 1 || segs[1] === 'amp') &&
      /^[a-z0-9][a-z0-9-]{3,}$/.test(segs[0]) &&
      !NOT_POSTS.test(segs[0])
    )
      slug = segs[0];
    if (
      /^(www\.)?craigsworks\.com$/.test(u.hostname) &&
      segs[0] === 'blog' &&
      /^\d{4}$/.test(segs[1] || '') &&
      /^\d{2}$/.test(segs[2] || '') &&
      /^[a-z0-9-]{4,}$/.test(segs[3] || '')
    )
      slug = segs[3];
    if (!slug || u.search) continue;
    const key = u.hostname.replace(/^www\./, '') + ':' + slug;
    const p = posts.get(key) || { slug, host: u.hostname.replace(/^www\./, ''), urls: new Set() };
    p.urls.add(u.origin + '/' + segs.filter((s) => s !== 'amp').join('/') + (u.pathname.endsWith('/') ? '/' : ''));
    posts.set(key, p);
  }
  console.log(`${posts.size} posts found in the archive list`);

  // The newest snapshot of each post that came back 200 as HTML.
  async function snapshots(url) {
    const bare = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const q = new URL('https://web.archive.org/cdx/search/cdx');
    Object.entries({
      url: bare,
      matchType: 'exact',
      output: 'json',
      fl: 'timestamp,original,statuscode,mimetype',
      filter: 'statuscode:200',
    }).forEach(([k, v]) => q.searchParams.set(k, v));
    const rows = [];
    for (const variant of [bare, bare + '/']) {
      q.searchParams.set('url', variant);
      const t = await (await get(q)).text();
      if (t.trim()) rows.push(...JSON.parse(t).slice(1));
      await sleep(800);
    }
    return rows.filter((r) => /html/.test(r[3])).sort((a, b) => b[0].localeCompare(a[0]));
  }

  for (const p of posts.values()) {
    const urls = [...p.urls];
    let snaps = [];
    for (const u of urls) {
      try {
        snaps.push(...(await snapshots(u)));
      } catch (e) {
        console.log(`::warning title=${p.slug}::snapshot list failed: ${errorMessage(e)}`);
      }
    }
    // Newest first, but from before the blog went offline (2019 on, the server shows a stock nginx page).
    snaps.sort((a, b) => (a[0] < '2019' ? 0 : 1) - (b[0] < '2019' ? 0 : 1) || b[0].localeCompare(a[0]));
    const seen = new Set();
    snaps = snaps.filter((s) => (seen.has(s[0]) ? false : seen.add(s[0])));
    let saved = null;
    const why = [];
    for (const [ts, orig] of snaps.slice(0, 15)) {
      try {
        const r = await get(`https://web.archive.org/web/${ts}id_/${orig}`);
        if (!r.ok) {
          why.push(`${ts}: HTTP ${r.status}`);
          continue;
        }
        const html = await r.text();
        // An error page or a stub, not the post.
        if (html.length < 1500 || !/<(article|div)[^>]+(post|entry)/i.test(html)) {
          why.push(
            `${ts}: ${html.length} bytes, "${((html.match(/<title>([^<]*)/i) || [])[1] || '').trim().slice(0, 60)}"`,
          );
          continue;
        }
        writeFileSync(join(OUT, 'html', p.slug + '.html'), html);
        saved = { ts, orig, html };
        break;
      } catch (e) {
        console.log(`::warning title=${p.slug}::${errorMessage(e)}`);
      }
      await sleep(800);
    }
    if (!saved) {
      console.log(
        `::warning title=${p.slug}::no usable snapshot (${snaps.length} listed): ${why.slice(0, 4).join('; ')}`,
      );
      out.push({ slug: p.slug, host: p.host, urls, snapshot: null });
      continue;
    }
    // Images in the post (not the theme's): saved from the same moment in the archive.
    const imgs = [];
    for (const m of saved.html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
      let src = m[1].replace(/^https?:\/\/web\.archive\.org\/web\/\d+(im_|id_)?\//, '');
      try {
        src = new URL(src, saved.orig).href;
      } catch (e) {
        continue;
      }
      if (
        /gravatar|favicon|logo|avatar|feeds\.feedburner|stats\.wordpress|\/themes\//i.test(src) ||
        imgs.some((i) => i.src === src)
      )
        continue;
      const name =
        createHash('sha1').update(src).digest('hex').slice(0, 10) +
        (extname(new URL(src).pathname)
          .toLowerCase()
          .replace(/[^.a-z0-9]/g, '') || '.img');
      try {
        const r = await get(`https://web.archive.org/web/${saved.ts}im_/${src}`);
        const type = r.headers.get('content-type') || '';
        if (r.ok && type.startsWith('image/')) {
          writeFileSync(join(OUT, 'img', name), Buffer.from(await r.arrayBuffer()));
          imgs.push({ src, file: name, type });
        } else imgs.push({ src, file: null, status: r.status, type });
      } catch (e) {
        imgs.push({ src, file: null, error: errorMessage(e) });
      }
      await sleep(500);
    }
    out.push({
      slug: p.slug,
      host: p.host,
      urls,
      snapshot: saved.ts,
      from: saved.orig,
      file: 'html/' + p.slug + '.html',
      images: imgs,
    });
    console.log(`${p.slug}: snapshot ${saved.ts}, ${imgs.filter((i) => i.file).length}/${imgs.length} images`);
  }
}
// Code embedded from GitHub gists: the archive doesn't run the embed, so fetch the gist itself.
mkdirSync(join(OUT, 'gists'), { recursive: true });
const gistIds = new Set();
for (const p of out)
  if (p.file)
    for (const m of readFileSync(join(OUT, p.file), 'utf8').matchAll(
      /gist\.github\.com\/(?:[\w-]+\/)?([0-9a-f]{12,}|\d{5,})(?:\.js)?/gi,
    ))
      gistIds.add(m[1]);
for (const id of gistIds) {
  try {
    const r = await get(`https://api.github.com/gists/${id}`, 3);
    if (!r.ok) {
      console.log(`::warning title=gist ${id}::HTTP ${r.status}`);
      continue;
    }
    const g = await r.json();
    writeFileSync(
      join(OUT, 'gists', id + '.json'),
      JSON.stringify(
        {
          id,
          url: g.html_url,
          description: g.description,
          files: Object.fromEntries(
            Object.values(g.files).map((f) => [f.filename, { language: f.language, content: f.content }]),
          ),
        },
        null,
        1,
      ),
    );
  } catch (e) {
    console.log(`::warning title=gist ${id}::${errorMessage(e)}`);
  }
}
console.log(`${gistIds.size} gists`);
writeFileSync(join(OUT, 'posts.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`saved ${out.filter((p) => p.snapshot).length} of ${out.length} posts`);
