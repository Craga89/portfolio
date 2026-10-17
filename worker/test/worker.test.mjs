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
  const env = { AI: { run: async (model) => { seen.push(model); if (seen.length === 1) throw new Error('4006: daily free allocation used'); return { choices: [{ message: { content: '<think>hmm</think>He studied at Newcastle University.\n**SOURCES:** recognition' } }] }; } } };
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

// A fake D1 that records statements.
const fakeDB = () => { const rows = []; return { rows, prepare: (sql) => ({ bind: (...args) => ({ run: async () => { rows.push({ sql, args }); return { success: true }; } }) }) }; };

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
  assert.deepEqual(DB.rows[0].args, ['/', 'linkedin.com', null, 'mobile', 'career,faq', 3600]);
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
