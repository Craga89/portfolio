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
});
