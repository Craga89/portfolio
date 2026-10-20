#!/usr/bin/env node
// Redirects from the old domains (redirects/old-domains.json) to craigthompson.dev.
//
//   node tools/redirects.mjs csv [file]        write the Cloudflare Bulk Redirects CSV
//   node tools/redirects.mjs match <url>…      which rule a URL hits and where it goes (offline)
//   node tools/redirects.mjs discover [dir]    list every URL the Wayback Machine has archived on
//                                              the old domains, and where each one will go
//   node tools/redirects.mjs targets [archived] [out.md]  check the destinations load (before switching)
//   node tools/redirects.mjs check [archived]  request the test URLs (and, given the discover output,
//                                              every archived URL) and check each redirects once,
//                                              permanently, to the right place, and that it loads
//
// The rules and how they match: tools/lib/redirects.mjs.
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage } from '../shared/errors.js';
import { CONF, RULES, junk, match } from './lib/redirects.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function csv(file) {
  const b = (v) => (v ? 'TRUE' : 'FALSE');
  const lines = RULES.map((r) => [r.source, r.target, 301, b(r.query), b(r.subdomains), b(r.subpath), b(r.subpath && r.suffix)].join(','));
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`wrote ${lines.length} redirects to ${file}`);
}

// ---------- discover: what the Wayback Machine has seen ----------

async function discover(dir) {
  mkdirSync(dir, { recursive: true });
  const seen = new Map();
  const skippedAll = [];
  for (const d of CONF.domains) {
    const q = new URL('https://web.archive.org/cdx/search/cdx');
    Object.entries({ url: d, matchType: 'domain', output: 'json', fl: 'original,statuscode,mimetype,timestamp', collapse: 'urlkey', limit: '150000' }).forEach(([k, v]) => q.searchParams.set(k, v));
    let rows = [];
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await fetch(q, { headers: { 'user-agent': 'craigthompson.dev redirect check (github.com/Craga89/portfolio)' } });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const t = await r.text();
        rows = t.trim() ? JSON.parse(t).slice(1) : [];
        break;
      } catch (e) { console.log(`${process.env.GITHUB_ACTIONS && attempt === 2 ? '::warning title=Wayback ' + d + '::' : ''}${d}: ${errorMessage(e)}${attempt < 2 ? ', retrying' : ', giving up'}`); await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); }
    }
    // Paths with thousands of archived URLs (the old forums) are counted, not listed.
    const skipped = {};
    rows = rows.filter(([orig]) => { const k = (CONF.discoverSkip || []).find((p) => orig.toLowerCase().includes(p)); if (k) skipped[k] = (skipped[k] || 0) + 1; return !k; });
    console.log(`${d}: ${rows.length} archived URLs` + Object.entries(skipped).map(([k, n]) => `, plus ${n} under ${k} (not listed; they go to ${(match('https://' + d + k) || {}).target})`).join(''));
    skippedAll.push(...Object.entries(skipped).map(([k, n]) => [d + k, n]));
    for (const [orig, status, mime, ts] of rows) {
      let u;
      try { u = new URL(/^https?:\/\//i.test(orig) ? orig : 'http://' + orig); } catch (e) { continue; }
      u.protocol = 'https:'; u.port = ''; u.hash = '';
      const key = (u.hostname.replace(/^www\./, '') + u.pathname + u.search).toLowerCase();
      const prev = seen.get(key);
      if (!prev || ts > prev.last) seen.set(key, { url: u.href, status: Number(status) || null, mime, last: ts, first: prev ? prev.first : ts });
      else if (ts < prev.first) prev.first = ts;
    }
  }
  const out = [...seen.values()].filter((x) => !junk(x.url)).sort((a, b) => a.url.localeCompare(b.url)).map((x) => { const m = match(x.url); return Object.assign(x, { to: m ? m.target : null, rule: m ? m.rule.source : null }); });
  writeFileSync(join(dir, 'archived.json'), JSON.stringify(out, null, 1) + '\n');
  const md = ['# Archived URLs on the old domains', '', `${out.length} distinct URLs from the Wayback Machine (${new Date().toISOString().slice(0, 10)}), and where each will redirect.` + skippedAll.map(([p, n]) => ` Not listed: ${n} under ${p}, which go to ${(match('https://' + p) || {}).target}.`).join(''), '', '| rule | URLs |', '| --- | --- |'];
  const by = {}; out.forEach((x) => { (by[x.rule || 'no rule'] = by[x.rule || 'no rule'] || []).push(x); });
  RULES.map((r) => r.source).concat(['no rule']).forEach((k) => { if (by[k]) md.push(`| \`${k}\` | ${by[k].length} |`); });
  md.push('', '## Going to the home page (catch-all)', '', 'Pages here that people still link to may deserve a rule of their own.', '', '| archived URL | last archived | status | type |', '| --- | --- | --- | --- |');
  out.filter((x) => x.to === CONF.home && x.rule && x.rule.endsWith('/') && !/\.(png|jpe?g|gif|ico|svg|css|js|map|woff2?|ttf|eot|xml)$/i.test(new URL(x.url).pathname)).forEach((x) => md.push(`| ${x.url} | ${x.last.slice(0, 4)}-${x.last.slice(4, 6)} | ${x.status || '–'} | ${x.mime} |`));
  md.push('', '## Everything else', '', '| archived URL | goes to |', '| --- | --- |');
  out.filter((x) => x.to !== CONF.home).forEach((x) => md.push(`| ${x.url} | ${x.to || '**nothing**'} |`));
  writeFileSync(join(dir, 'archived.md'), md.join('\n') + '\n');
  console.log(`wrote ${join(dir, 'archived.json')} and archived.md`);
}

// ---------- check: the live redirects ----------

async function hop(url) {
  const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'craigthompson.dev redirect check' } });
  return { status: r.status, location: (loc => (loc ? new URL(loc, url).href : null))(r.headers.get('location')) };
}

async function lands(url, tries = 2) {
  const r = await landsOnce(url);
  if (r.status === 0 && tries > 1) { await new Promise((res) => setTimeout(res, 1500)); return lands(url, tries - 1); }
  return r;
}
async function landsOnce(url) {
  try {
    const r = await fetch(url.replace(/#.*$/, ''), { redirect: 'follow', headers: { 'user-agent': 'craigthompson.dev redirect check' } });
    return { status: r.status, type: r.headers.get('content-type') || '', final: r.url };
  } catch (e) { return { status: 0, type: '', final: '', error: errorMessage(e) + (e instanceof Error && e.cause ? ' (' + (/** @type {{ code?: string, message?: string }} */ (e.cause).code || /** @type {{ message?: string }} */ (e.cause).message) + ')' : '') }; }
}

async function check(archivedFile) {
  const cases = CONF.tests.map(([from, to]) => ({ from, to, test: true }));
  for (const c of cases) { const m = match(c.from); if (!m || m.target !== c.to) { console.error(`config: ${c.from} maps to ${m ? m.target : 'nothing'}, test expects ${c.to}`); process.exitCode = 1; } }
  if (archivedFile && existsSync(archivedFile)) {
    const seen = new Set(cases.map((c) => c.from));
    for (const x of JSON.parse(readFileSync(archivedFile, 'utf8'))) { const m = !junk(x.url) && !seen.has(x.url) && match(x.url); if (m) { cases.push({ from: x.url, to: m.target }); seen.add(x.url); } }
  }
  const results = [];
  const targets = new Map();
  let i = 0;
  const work = async () => {
    while (i < cases.length) {
      const c = cases[i++];
      let res;
      try {
        const h = await hop(c.from);
        res = Object.assign({}, c, h, { ok: h.status === 301 && h.location === c.to });
        if (!res.ok) res.why = h.status === 301 ? `goes to ${h.location}` : h.status >= 300 && h.status < 400 ? `${h.status} (not permanent) to ${h.location}` : `HTTP ${h.status}, not redirected`;
      } catch (e) { res = Object.assign({}, c, { ok: false, why: 'no response: ' + errorMessage(e) }); }
      results.push(res);
      if (res.ok) targets.set(c.to, null);
    }
  };
  await Promise.all(Array.from({ length: 6 }, work));
  // Each distinct destination should load (and Simpletip's scripts should still be JavaScript).
  for (const t of targets.keys()) targets.set(t, await lands(t));
  for (const r of results) {
    if (!r.ok) continue;
    const l = targets.get(r.to);
    if (!(l.status >= 200 && l.status < 400)) { r.ok = false; r.why = `redirects correctly, but ${r.to} gives HTTP ${l.status}${l.error ? ' (' + l.error + ')' : ''}`; }
    else if (/\.js$/.test(new URL(r.to).pathname) && !/javascript/.test(l.type)) { r.ok = false; r.why = `the script is served as ${l.type}, which browsers won't run`; }
  }
  const bad = results.filter((r) => !r.ok);
  const lines = [`# Old-domain redirects`, '', `${results.length - bad.length} of ${results.length} URLs redirect correctly${bad.length ? `; ${bad.length} don't` : ''}.`, ''];
  if (bad.length) { lines.push('| URL | expected | problem |', '| --- | --- | --- |'); bad.sort((a, b) => (b.test ? 1 : 0) - (a.test ? 1 : 0)).forEach((r) => lines.push(`| ${r.from} | ${r.to} | ${r.why} |`)); }
  const text = lines.join('\n') + '\n';
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  for (const r of bad.slice(0, 40)) if (process.env.GITHUB_ACTIONS) console.log(`::error title=${r.from}::expected ${r.to}: ${r.why}`);
  if (bad.length) process.exitCode = 1;
}

// targets: before switching over, check every destination the redirects will send people to loads.
async function targets(archivedFile) {
  const list = new Set(CONF.tests.map(([, to]) => to));
  if (archivedFile && existsSync(archivedFile)) for (const x of JSON.parse(readFileSync(archivedFile, 'utf8'))) { const m = !junk(x.url) && match(x.url); if (m) list.add(m.target); }
  const all = [...list];
  const res = [];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < all.length) { const t = all[i++]; res.push(Object.assign({ t }, await lands(t))); } }));
  const host = {};
  for (const r of res) { const h = new URL(r.t).hostname; const k = r.status >= 200 && r.status < 400 ? 'ok' : String(r.status || 'error'); host[h] = host[h] || {}; host[h][k] = (host[h][k] || 0) + 1; }
  const bad = res.filter((r) => !(r.status >= 200 && r.status < 400) || (/\.js$/.test(new URL(r.t).pathname) && !/javascript/.test(r.type)));
  const lines = ['# Redirect destinations', '', `${res.length - bad.length} of ${res.length} destinations load.`, '', '| host | results |', '| --- | --- |'];
  Object.entries(host).forEach(([h, c]) => lines.push(`| ${h} | ${Object.entries(c).map(([k, n]) => `${k}: ${n}`).join(', ')} |`));
  if (bad.length) { lines.push('', '| destination | result |', '| --- | --- |'); bad.slice(0, 200).forEach((r) => lines.push(`| ${r.t} | ${r.status ? 'HTTP ' + r.status : r.error}${r.final && r.final !== r.t ? ' (via ' + r.final + ')' : ''} ${/\.js$/.test(new URL(r.t).pathname) ? r.type : ''} |`)); }
  const text = lines.join('\n') + '\n';
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  return text;
}

const [cmd, ...args] = process.argv.slice(2);
if (process.argv[1] !== fileURLToPath(import.meta.url)) {
  // imported (by the tests): no command to run
} else if (cmd === 'csv') csv(args[0] || join(ROOT, 'redirects', 'cloudflare-bulk.csv'));
else if (cmd === 'match') for (const a of args) { const m = match(a); console.log(a, '→', m ? `${m.target}  (${m.rule.source})` : 'no rule'); }
else if (cmd === 'discover') await discover(args[0] || join(ROOT, 'redirects', 'archive'));
else if (cmd === 'check') await check(args[0]);
else if (cmd === 'targets') { const t = await targets(args[0]); if (args[1]) writeFileSync(args[1], t); }
else { console.log('usage: node tools/redirects.mjs csv|match|discover|check'); process.exitCode = 1; }
