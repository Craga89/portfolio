// node worker/test/worker.test.mjs   (no Cloudflare needed: env.AI is mocked)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { register } from 'node:module';

register('data:text/javascript,' + encodeURIComponent(`
export async function load(url, ctx, next) {
  if (url.endsWith('.json')) return { format: 'json', source: (await import('node:fs')).readFileSync(new URL(url)), shortCircuit: true };
  return next(url, ctx);
}`));
const mod = await import('../src/index.js');
const worker = mod.default;
const ORIGIN = 'https://craigthompson.dev';
const req = (body, { origin = ORIGIN, method = 'POST', path = '/ask' } = {}) =>
  new Request('https://craga-ask.example.workers.dev' + path, { method, headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: method === 'POST' ? JSON.stringify(body) : undefined });

test('answers with parsed sources and CORS', async () => {
  const calls = [];
  const env = { AI: { run: async (model, input) => { calls.push({ model, input }); return { response: 'Yes, he has owned a substantial monthly AWS budget [resp-bud].\nSOURCES: resp-bud, case-cost, nope' }; } } };
  const r = await worker.fetch(req({ q: 'Has he owned a budget?' }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  const d = await r.json();
  assert.equal(d.answer, 'Yes, he has owned a substantial monthly AWS budget.');
  assert.deepEqual(d.sources, ['resp-bud', 'case-cost']);
  assert.equal(calls[0].model, '@cf/google/gemma-4-26b-a4b-it');
  const user = calls[0].input.messages[1].content;
  assert.match(user, /\[resp-bud\]/);
  assert.match(user, /\[intro\]/);
  assert.ok(user.length < 16000, 'context budget ' + user.length);
  assert.deepEqual(calls[0].input.chat_template_kwargs, { enable_thinking: false });
});

test('falls through to the next model and strips think blocks', async () => {
  const seen = [];
  const env = { AI: { run: async (model) => { seen.push(model); if (seen.length === 1) throw new Error('3040: Capacity temporarily exceeded'); return { choices: [{ message: { content: '<think>hmm</think>He studied at Newcastle University.\n**SOURCES:** recognition' } }] }; } } };
  const d = await (await worker.fetch(req({ q: 'Where did he study?' }), env)).json();
  assert.equal(seen[1], '@cf/qwen/qwen3-30b-a3b-fp8');
  assert.equal(d.answer, 'He studied at Newcastle University.');
  assert.deepEqual(d.sources, ['recognition']);
});

test('503 when every model fails, so the site falls back to search', async () => {
  const env = { AI: { run: async () => { throw new Error('down'); } } };
  const r = await worker.fetch(req({ q: 'anything' }), env);
  assert.equal(r.status, 503);
});

test('rejects other origins, bad input, wrong methods', async () => {
  const env = { AI: { run: async () => ({ response: 'x' }) } };
  assert.equal((await worker.fetch(req({ q: 'hi' }, { origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(req({ q: 'hi' }, { origin: '' }), env)).status, 403);
  assert.equal((await worker.fetch(req({ q: '   ' }), env)).status, 400);
  assert.equal((await worker.fetch(req(null, { method: 'GET' }), env)).status, 405);
  assert.equal((await worker.fetch(req({ q: 'hi' }, { path: '/' }), env)).status, 404);
  const pre = await worker.fetch(new Request('https://x/ask', { method: 'OPTIONS', headers: { origin: 'http://localhost:8080' } }), env);
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
});

test('rate limiter and question length', async () => {
  let q;
  const env = { AI: { run: async (m, i) => { q = i.messages[1].content; return { response: 'ok' }; } }, ASK_LIMITER: { limit: async () => ({ success: false }) } };
  assert.equal((await worker.fetch(req({ q: 'hi' }), env)).status, 429);
  delete env.ASK_LIMITER;
  await worker.fetch(req({ q: 'x'.repeat(5000) }), env);
  assert.ok(/QUESTION: x{300}$/.test(q));
});

test('passage ids cited as files become real file names', async () => {
  assert.equal(mod.fixRefs('See faq-1.md and career-1.md.'), 'See faq.md and career.log.');
  assert.equal(mod.fixRefs('See faq-1.md and faq-13.md.'), 'See faq.md.');
  assert.equal(mod.fixRefs('See resp-bud and case-ai.md.'), 'See budget.md and ' + mod.fileOf('case-ai') + '.');
  assert.equal(mod.fixRefs('He knows the stack well; see intro.md.'), 'He knows the stack well; see README.md.');
  assert.equal(mod.fixRefs('See budget.md.'), 'See budget.md.');
  const env = { AI: { run: async (m, i) => { assert.match(i.messages[1].content, /\[faq-1\] \(file: faq\.md\)/); return { response: 'He wants hands-on leadership roles. See faq-1.md and career-1.md.\nSOURCES: faq-1' }; } } };
  const d = await (await worker.fetch(req({ q: 'What roles is he looking for?' }), env)).json();
  assert.equal(d.answer, 'He wants hands-on leadership roles. See faq.md and career.log.');
});

test('copied file labels are dropped and file names on the SOURCES line map to passages', () => {
  const ctx = mod.pickContext('Where did he study?');
  let d = mod.parse('He earned an MEng from Newcastle University (file: recommendations.txt).\nSOURCES: recommendations.txt', ctx);
  assert.equal(d.answer, 'He earned an MEng from Newcastle University.');
  assert.ok(d.sources.includes('recognition'), JSON.stringify(d.sources));
  d = mod.parse('Yes, he has. See acquisition.md.\nSOURCES: acquisition.md, faq.md', mod.pickContext('Has he been through an acquisition?'));
  assert.ok(d.sources.includes('resp-acq'), JSON.stringify(d.sources));
  assert.ok(d.sources.some((id) => id.startsWith('faq-')), JSON.stringify(d.sources));
  d = mod.parse('Answer.\n\nSOURCES:\n- [faq-1]\n- career-1', ctx);
  assert.deepEqual(d.sources, ['faq-1', 'career-1']);
});

test('context selection finds the right passages', () => {
  const ids = (q) => mod.pickContext(q).map((p) => p.id);
  assert.ok(ids('Has he been through an acquisition?').includes('resp-acq'));
  assert.ok(ids('Tell me about the monorepo').includes('case-mono'));
  assert.ok(ids('What does he know about Terraform?').includes('stack'));
  assert.ok(ids('qwerty zzz').length >= 6);
  assert.ok(ids('Where did he study?').includes('recognition'));
  assert.ok(ids('Is he good at hiring?').includes('resp-hire'));
  assert.ok(ids('Who did he work for before Hive HR?').includes('career-3'));
  assert.ok(ids('Where has he worked?').includes('career-4'));
});

// A fake D1 that records statements, and keeps the AI budget (ai_budget) in memory.
const fakeDB = (spent = {}) => {
  const rows = [];
  const budget = { ...spent };
  return {
    rows, budget,
    prepare: (sql) => ({
      bind: (...args) => ({
        first: async () => (/FROM ai_budget/.test(sql) ? (args[1] in budget ? { neurons: budget[args[1]] } : null) : null),
        run: async () => {
          if (/INTO ai_budget/.test(sql)) { budget[args[1]] = (budget[args[1]] || 0) + args[2]; return { success: true }; }
          rows.push({ sql, args });
          return { success: true };
        },
      }),
    }),
  };
};

test('questions are logged anonymously, with whether they were answered', async () => {
  const DB = fakeDB();
  let env = { DB, AI: { run: async () => ({ response: 'He has. See budget.md.\nSOURCES: resp-bud' }) } };
  await worker.fetch(req({ q: 'Has he owned a budget?' }), env);
  env = { DB, AI: { run: async () => ({ response: "That isn't covered on the site, but Craig can answer it directly: craga89@gmail.com." }) } };
  await worker.fetch(req({ q: 'What is his favourite colour?' }), env);
  assert.equal(DB.rows.length, 2);
  assert.match(DB.rows[0].sql, /INSERT INTO questions/);
  assert.deepEqual(DB.rows[0].args.slice(0, 2), ['Has he owned a budget?', 1]);
  assert.deepEqual(DB.rows[1].args.slice(0, 2), ['What is his favourite colour?', 0]);
  assert.ok(!JSON.stringify(DB.rows).includes('127.0.0.1'));
  // CI and smoke-test traffic is not logged.
  const r = new Request('https://x/ask', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-craga-test': '1' }, body: '{"q":"hi"}' });
  await worker.fetch(r, env);
  assert.equal(DB.rows.length, 2);
});

test('visit beacons are cleaned, bots and other sites ignored', async () => {
  const DB = fakeDB();
  const env = { DB, AI: { run: async () => ({ response: 'x' }) } };
  const beacon = (body, headers = {}) => worker.fetch(new Request('https://x/hit', { method: 'POST', headers: { origin: 'https://craigthompson.dev', 'content-type': 'text/plain', 'user-agent': 'Mozilla/5.0 Chrome/150', ...headers }, body: JSON.stringify(body) }), env);
  const r = await beacon({ path: '/', ref: 'https://www.linkedin.com/feed/?x=1', device: 'mobile', sections: ['career', 'faq', 'evil', 'faq'], seconds: 99999 });
  assert.equal(r.status, 204);
  assert.deepEqual(DB.rows[0].args, ['/', 'linkedin.com', null, 'mobile', 'career,faq', 3600, null, null]);
  await beacon({ path: '/cv/', ref: 'https://craigthompson.dev/' });
  assert.deepEqual(DB.rows[1].args.slice(0, 2), ['/cv/', null]);
  await beacon({ path: '/' }, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
  await beacon({ path: '/' }, { origin: 'https://evil.example' });
  await beacon({ path: 'javascript:alert(1)' });
  assert.equal(DB.rows.length, 2);
});

test('answers are read aloud with a natural voice, falling back to the next one', async () => {
  const seen = [];
  const mp3 = new Uint8Array(4000).fill(7);
  const env = { AI: { run: async (model, input) => { seen.push([model, input]); if (model.includes('aura-2')) throw new Error('quota'); return new ReadableStream({ start(c) { c.enqueue(mp3); c.close(); } }); } } };
  const r = await worker.fetch(req({ text: 'He has. See budget.md and faq.md, or email craga89@gmail.com.' }, { path: '/speak' }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'audio/mpeg');
  assert.equal(r.headers.get('x-voice'), 'aura-1');
  assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal((await r.arrayBuffer()).byteLength, 4000);
  assert.equal(seen[0][0], '@cf/deepgram/aura-2-en');
  assert.equal(seen[1][1].text, 'He has. See the budget file and the FAQ, or email craga89 at gmail dot com.');
  assert.equal(seen[1][1].speaker, 'helios');
});

test('speak: MeloTTS base64 as a last resort, 503 when nothing works, origin and input checks', async () => {
  const b64 = Buffer.from(new Uint8Array(500).fill(1)).toString('base64');
  let env = { AI: { run: async (model) => { if (!model.includes('melotts')) throw new Error('down'); return { audio: b64 }; } } };
  let r = await worker.fetch(req({ text: 'Hello.' }, { path: '/speak' }), env);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('x-voice'), 'melotts');
  env = { AI: { run: async () => { throw new Error('down'); } } };
  assert.equal((await worker.fetch(req({ text: 'Hello.' }, { path: '/speak' }), env)).status, 503);
  assert.equal((await worker.fetch(req({ text: 'Hello.' }, { path: '/speak', origin: 'https://evil.example' }), env)).status, 403);
  assert.equal((await worker.fetch(req({ text: '  ' }, { path: '/speak' }), env)).status, 400);
  assert.equal(mod.speakable('x'.repeat(5000)).length, 1000);
  assert.equal(mod.speakable('See ai/platform.md, ci-cd.md and README.md.'), 'See the AI platform case study, the ci cd file and the README.');
});

// ---------- /mcp ----------
const MCP = 'https://craga-ask.example.workers.dev/mcp';
const rpc = (method, params, { id = 1, headers = {}, origin } = {}) => new Request(MCP, {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...(origin ? { origin } : {}), ...headers },
  body: JSON.stringify(id == null ? { jsonrpc: '2.0', method, params } : { jsonrpc: '2.0', id, method, params }),
});
const V = '2026-07-28';
const modernMeta = { 'io.modelcontextprotocol/protocolVersion': V, 'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': {} };
const modern = (method, params = {}, extra = {}) => rpc(method, { ...params, _meta: modernMeta }, { headers: { 'mcp-protocol-version': V, 'mcp-method': method, ...(params.name ? { 'mcp-name': params.name } : {}), ...extra } });
const LIVE = { oss: { prs: 59, repos: 35, since: 2012, qtip: { stars: 1970, forks: 458, commits: 1384 }, timeline: [{ y: 2014, q: 2, n: 7, repos: ['BlueSpire/Durandal'] }], at: '2026-10-17' }, lighthouse: { mobile: { performance: 97 }, desktop: { performance: 100 } }, build: { sha: 'abc123', at: '2026-10-18T00:00:00Z' } };
const realFetch = globalThis.fetch;
const liveFetches = [];
let liveDown = false;
globalThis.fetch = async (u, opts) => { if (String(u).endsWith('/live.json')) { liveFetches.push(String(u)); if (liveDown) return new Response('not found', { status: 404 }); return new Response(JSON.stringify(LIVE), { headers: { 'content-type': 'application/json' } }); } return realFetch(u, opts); };
const call = async (r, env = {}) => { const res = await worker.fetch(r, env); const t = await res.text(); return { status: res.status, headers: res.headers, body: t ? JSON.parse(t) : null }; };
const toolData = (b) => JSON.parse(b.result.content[0].text);

test('mcp legacy: initialize negotiates a version, no session', async () => {
  const r = await call(rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } }));
  assert.equal(r.status, 200);
  assert.equal(r.body.result.protocolVersion, '2025-06-18');
  assert.deepEqual(r.body.result.capabilities, { tools: { listChanged: false } });
  assert.equal(r.body.result.serverInfo.name, 'craigthompson-dev');
  assert.ok(r.body.result.instructions.length > 50);
  assert.equal(r.headers.get('mcp-session-id'), null);
  const old = await call(rpc('initialize', { protocolVersion: '2024-01-01' }));
  assert.equal(old.body.result.protocolVersion, '2025-11-25');
  const note = await call(rpc('notifications/initialized', {}, { id: null }));
  assert.equal(note.status, 202);
  assert.equal(note.body, null);
  assert.deepEqual((await call(rpc('ping', {}))).body.result, {});
});

test('mcp tools/list: the shared tools, minus page-only ones', async () => {
  const { body } = await call(rpc('tools/list', {}));
  const names = body.result.tools.map((t) => t.name);
  assert.deepEqual(names, ['get_profile', 'get_career', 'list_files', 'read_file', 'search_site', 'ask', 'get_open_source', 'get_site_report']);
  const read = body.result.tools.find((t) => t.name === 'read_file');
  assert.deepEqual(Object.keys(read.inputSchema.properties), ['file']);
  assert.deepEqual(read.inputSchema.required, ['file']);
  assert.ok(body.result.tools.every((t) => t.description.length > 40 && t.annotations.readOnlyHint === true && t.inputSchema.type === 'object'));
  assert.ok(!/on the page for the person/.test(read.description));
});

test('mcp tools/call: profile, files, search and errors', async () => {
  const p = await call(rpc('tools/call', { name: 'get_profile', arguments: {} }));
  assert.equal(p.body.result.structuredContent.name, 'Craig Michael Thompson');
  assert.equal(toolData(p.body).links.cv_pdf, 'https://craigthompson.dev/cv.pdf');
  const list = await call(rpc('tools/call', { name: 'list_files', arguments: { section: 'case-studies' } }));
  assert.ok(list.body.result.structuredContent.files.length >= 12);
  const f = await call(rpc('tools/call', { name: 'read_file', arguments: { file: 'ai/platform.md' } }));
  assert.equal(f.body.result.structuredContent.url, 'https://craigthompson.dev/case-studies/ai-platform/');
  assert.ok(f.body.result.structuredContent.text.length > 200);
  const miss = await call(rpc('tools/call', { name: 'read_file', arguments: { file: 'nope.md' } }));
  assert.equal(miss.body.result.isError, true);
  assert.match(miss.body.result.content[0].text, /monorepo\.md/);
  const s = await call(rpc('tools/call', { name: 'search_site', arguments: { query: 'ISO 27001', limit: 2 } }));
  assert.equal(s.body.result.structuredContent.results.length, 2);
  assert.match(s.body.result.structuredContent.results[0].title, /compliance\.md/);
  const bad = await call(rpc('tools/call', { name: 'search_site', arguments: { query: 'x', limit: 50 } }));
  assert.equal(bad.body.result.isError, true);
  const unknown = await call(rpc('tools/call', { name: 'show_section', arguments: { section: 'faq' } }));
  assert.equal(unknown.body.error.code, -32602);
});

test('mcp ask: answers from the model, logs as mcp, and respects the limit', async () => {
  const logged = [];
  const env = {
    AI: { run: async () => ({ response: 'Yes, he has owned the AWS budget. See budget.md.\nSOURCES: resp-bud' }) },
    DB: { prepare: (sql) => ({ bind: (...a) => ({ first: async () => null, run: async () => { if (!/ai_budget/.test(sql)) logged.push(a); } }) }) },
    ASK_LIMITER: { limit: async () => ({ success: true }) },
  };
  const r = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Has he owned a budget?' } }), env);
  const d = r.body.result.structuredContent;
  assert.equal(d.via, 'ai');
  assert.match(d.answer, /AWS budget/);
  assert.match(d.sources[0], /^budget\.md/);
  assert.equal(logged.length, 1);
  assert.equal(logged[0][5], 'mcp');
  const limited = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Again?' } }), { ...env, ASK_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(limited.body.result.isError, true);
  assert.match(limited.body.result.content[0].text, /Too many questions/);
  const down = await call(rpc('tools/call', { name: 'ask', arguments: { question: 'Where did he study?' } }), { AI: { run: async () => { throw new Error('quota'); } } });
  assert.equal(down.body.result.structuredContent.via, 'search');
});

test('mcp live data: open source falls back to the build snapshot when live.json is unreachable', async () => {
  liveDown = true;
  try {
    const o = await call(rpc('tools/call', { name: 'get_open_source', arguments: {} }));
    const d = o.body.result.structuredContent;
    assert.ok(d.merged_pull_requests > 0, 'merged count from the snapshot');
    assert.ok(d.by_quarter.length > 0);
  } finally { liveDown = false; }
});
test('mcp live data: open source and site report read live.json from the site', async () => {
  liveFetches.length = 0;
  const o = await call(rpc('tools/call', { name: 'get_open_source', arguments: {} }), { SITE_URL: 'https://craigthompson.dev/' });
  const d = o.body.result.structuredContent;
  assert.equal(d.merged_pull_requests, 59);
  assert.equal(d.qtip2.stars, 1970);
  assert.equal(d.by_quarter[0].merged, 7);
  assert.ok(d.linked_projects.some((p) => p.url === 'https://github.com/qTip2/qTip2'));
  assert.deepEqual(liveFetches, ['https://craigthompson.dev/live.json']);
  const rep = await call(rpc('tools/call', { name: 'get_site_report', arguments: {} }));
  assert.equal(rep.body.result.structuredContent.deployed.commit, 'abc123');
  assert.equal(rep.body.result.structuredContent.lighthouse.mobile.performance, 97);
});

test('mcp modern (2026-07-28): discover, per-request meta, header checks', async () => {
  const d = await call(modern('server/discover'));
  assert.equal(d.status, 200);
  assert.equal(d.body.result.resultType, 'complete');
  assert.deepEqual(d.body.result.supportedVersions.slice(0, 2), ['2026-07-28', '2025-11-25']);
  assert.equal(d.body.result._meta['io.modelcontextprotocol/serverInfo'].name, 'craigthompson-dev');
  assert.equal(d.body.result.cacheScope, 'public');
  const l = await call(modern('tools/list'));
  assert.equal(l.body.result.tools.length, 8);
  assert.equal(typeof l.body.result.ttlMs, 'number');
  const c = await call(modern('tools/call', { name: 'get_career', arguments: {} }));
  assert.equal(c.body.result.resultType, 'complete');
  assert.ok(c.body.result.structuredContent.work.length >= 3);
  // Base64-encoded Mcp-Name is decoded before comparing.
  const b64 = await call(modern('tools/call', { name: 'get_career', arguments: {} }, { 'mcp-name': '=?base64?' + btoa('get_career') + '?=' }));
  assert.equal(b64.status, 200);
  const noName = await call(rpc('tools/call', { name: 'get_career', arguments: {}, _meta: modernMeta }, { headers: { 'mcp-protocol-version': V, 'mcp-method': 'tools/call' } }));
  assert.equal(noName.status, 400);
  assert.equal(noName.body.error.code, -32020);
  const wrongName = await call(modern('tools/call', { name: 'get_career', arguments: {} }, { 'mcp-name': 'get_profile' }));
  assert.equal(wrongName.body.error.code, -32020);
  const wrongMethod = await call(modern('tools/list', {}, { 'mcp-method': 'tools/call' }));
  assert.equal(wrongMethod.body.error.code, -32020);
  const noVersion = await call(rpc('tools/list', { _meta: modernMeta }, { headers: { 'mcp-method': 'tools/list' } }));
  assert.equal(noVersion.body.error.code, -32020);
  const future = { ...modernMeta, 'io.modelcontextprotocol/protocolVersion': '2099-01-01' };
  const unsup = await call(rpc('tools/list', { _meta: future }, { headers: { 'mcp-protocol-version': '2099-01-01', 'mcp-method': 'tools/list' } }));
  assert.equal(unsup.status, 400);
  assert.equal(unsup.body.error.code, -32022);
  assert.equal(unsup.body.error.data.requested, '2099-01-01');
  assert.ok(unsup.body.error.data.supported.includes('2026-07-28'));
  const ping = await call(modern('ping'));
  assert.equal(ping.status, 404);
  assert.equal(ping.body.error.code, -32601);
  const init = await call(modern('initialize'));
  assert.equal(init.body.error.code, -32601);
});

test('mcp transport: methods, origins, batches, rate limit', async () => {
  const get = await worker.fetch(new Request(MCP, { method: 'GET' }), {});
  assert.equal(get.status, 405);
  assert.equal((await worker.fetch(new Request(MCP, { method: 'DELETE' }), {})).status, 405);
  const foreign = await call(rpc('tools/list', {}, { origin: 'https://evil.example' }));
  assert.equal(foreign.status, 403);
  const site = await call(rpc('tools/list', {}, { origin: ORIGIN }));
  assert.equal(site.status, 200);
  assert.equal(site.headers.get('access-control-allow-origin'), ORIGIN);
  assert.match(site.headers.get('access-control-allow-headers'), /mcp-protocol-version/);
  const pre = await worker.fetch(new Request(MCP, { method: 'OPTIONS', headers: { origin: ORIGIN } }), {});
  assert.equal(pre.status, 204);
  const bad = await call(new Request(MCP, { method: 'POST', body: '{nope' }));
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, -32700);
  const batch = await worker.fetch(new Request(MCP, { method: 'POST', body: JSON.stringify([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }]) }), {});
  const out = await batch.json();
  assert.deepEqual(out.map((x) => x.id), [1, 2]);
  const slow = await call(rpc('tools/list', {}), { MCP_LIMITER: { limit: async () => ({ success: false }) } });
  assert.equal(slow.status, 429);
  const wrongHeader = await call(rpc('tools/list', {}, { headers: { 'mcp-protocol-version': '1999-01-01' } }));
  assert.equal(wrongHeader.status, 400);
});

test('visit beacons record the translated language and the offer, nothing else', () => {
  assert.deepEqual(mod.cleanHit({ path: '/', lang: 'de', offer: 'accepted' }, ORIGIN).lang, 'de');
  assert.equal(mod.cleanHit({ path: '/', lang: 'de', offer: 'accepted' }, ORIGIN).offer, 'accepted');
  assert.equal(mod.cleanHit({ path: '/', lang: 'xx-evil', offer: 'hack' }, ORIGIN).lang, null);
  assert.equal(mod.cleanHit({ path: '/', lang: 'xx-evil', offer: 'hack' }, ORIGIN).offer, null);
  assert.equal(mod.cleanHit({ path: '/', lang: 'zh-Hant' }, ORIGIN).lang, 'zh-Hant');
});

test('AI budget: answers and voice are charged to their share, and stop when it is used', async () => {
  const run = async (model) => (model.includes('deepgram') ? new Uint8Array(4000) : { response: 'He owned the AWS budget. See budget.md.\nSOURCES: resp-bud', usage: { prompt_tokens: 4000, completion_tokens: 150 } });
  const DB = fakeDB();
  const env = { DB, AI: { run } };
  const r = await worker.fetch(req({ q: 'Has he owned a budget?' }), env);
  assert.equal(r.status, 200);
  // gemma-4-26b: 4,000 tokens in at 9,091/M and 150 out at 27,273/M.
  assert.ok(Math.abs(DB.budget.ask - (4000 * 9091 + 150 * 27273) / 1e6) < 0.05, String(DB.budget.ask));
  const sp = await worker.fetch(req({ text: 'Craig has led engineering teams for twelve years.' }, { path: '/speak' }), env);
  assert.equal(sp.status, 200);
  assert.ok(DB.budget.speak > 100 && DB.budget.speak < 160, String(DB.budget.speak)); // ~49 characters at 2.73 each
  // Over the share: the question gets a 503 'budget' (the page then uses its own search), no model call.
  let called = 0;
  const full = { DB: fakeDB({ ask: 5990 }), AI: { run: async (m) => { called++; return run(m); } } };
  const over = await worker.fetch(req({ q: 'Has he owned a budget?' }), full);
  assert.equal(over.status, 503);
  assert.equal((await over.json()).error, 'budget');
  assert.equal(called, 0);
  // Read-aloud has its own share: a long answer that won't fit is refused (the page uses the browser's voice).
  const voiceFull = { DB: fakeDB({ speak: 2400 }), AI: { run } };
  const v = await worker.fetch(req({ text: 'x'.repeat(200) }, { path: '/speak' }), voiceFull);
  assert.equal(v.status, 503);
  assert.equal((await v.json()).error, 'budget');
  // CI traffic is charged to the test share, not visitors'.
  const t = fakeDB();
  await worker.fetch(new Request('https://x/ask', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-craga-test': '1' }, body: '{"q":"Has he owned a budget?"}' }), { DB: t, AI: { run } });
  assert.ok(t.budget.test > 0 && !t.budget.ask);
  // Workers AI saying the free allocation is used up closes every share for the day.
  const closed = fakeDB();
  const no = await worker.fetch(req({ q: 'Has he owned a budget?' }), { DB: closed, AI: { run: async () => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); } } });
  assert.equal(no.status, 503);
  assert.ok(closed.budget.ask >= 6000 && closed.budget.speak >= 2500 && closed.budget.test >= 1000);
  // No database to check against: AI is off rather than unmetered.
  const broken = { DB: { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 down'); }, run: async () => {} }) }) }, AI: { run } };
  assert.equal((await worker.fetch(req({ q: 'Has he owned a budget?' }), broken)).status, 503);
});

test('page and worker share one search: worker context uses the shared ranking', async () => {
  const shared = await import('../../shared/agent-tools.js');
  const ix = shared.prepareIndex(JSON.parse(readFileSync(new URL('../knowledge.json', import.meta.url))));
  const top = shared.rank(ix, 'What qualifications does he have?')[0].p.id;
  const ctx = mod.pickContext('What qualifications does he have?').map((p) => p.id);
  assert.ok(ctx.includes(top), top + ' in ' + ctx.join(','));
  // Synonyms from both old copies survive the merge.
  assert.ok(shared.ALT.qualifications && shared.ALT.ai);
});
