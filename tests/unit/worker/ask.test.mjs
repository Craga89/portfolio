// /ask: answers from Workers AI using the site's passages, falling back through models.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { fixRefs, fileOf, parse, pickContext } from '../../../worker/src/index.js';
import { prepareIndex, rank, ALT } from '../../../shared/agent-tools.js';
import knowledge from '../../../worker/knowledge.json' with { type: 'json' };
import { ORIGIN, ai, env, limiter, request } from './helpers.mjs';

describe('/ask', () => {
  it('answers with parsed sources and CORS headers', async () => {
    /** @type {{ model: string, input: any }[]} */
    const calls = [];
    const e = env({
      AI: ai((model, input) => {
        calls.push({ model, input });
        return {
          response:
            'Yes, he has owned a substantial monthly AWS budget [resp-bud].\nSOURCES: resp-bud, case-cost, nope',
        };
      }),
    });
    const r = await worker.fetch(request({ q: 'Has he owned a budget?' }), e);
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

  it('falls through to the next model and strips think blocks', async () => {
    /** @type {string[]} */
    const seen = [];
    const e = env({
      AI: ai((model) => {
        seen.push(model);
        if (seen.length === 1) throw new Error('3040: Capacity temporarily exceeded');
        return {
          choices: [
            { message: { content: '<think>hmm</think>He studied at Newcastle University.\n**SOURCES:** recognition' } },
          ],
        };
      }),
    });
    const d = await (await worker.fetch(request({ q: 'Where did he study?' }), e)).json();
    assert.equal(seen[1], '@cf/qwen/qwen3-30b-a3b-fp8');
    assert.equal(d.answer, 'He studied at Newcastle University.');
    assert.deepEqual(d.sources, ['recognition']);
  });

  it('returns 503 when every model fails, so the site falls back to search', async () => {
    const e = env({
      AI: ai(() => {
        throw new Error('down');
      }),
    });
    assert.equal((await worker.fetch(request({ q: 'anything' }), e)).status, 503);
  });

  it('rejects other origins, bad input and wrong methods', async () => {
    const e = env({ AI: ai(() => ({ response: 'x' })) });
    assert.equal((await worker.fetch(request({ q: 'hi' }, { origin: 'https://evil.example' }), e)).status, 403);
    assert.equal((await worker.fetch(request({ q: 'hi' }, { origin: '' }), e)).status, 403);
    assert.equal((await worker.fetch(request({ q: '   ' }), e)).status, 400);
    assert.equal((await worker.fetch(request(null, { method: 'GET' }), e)).status, 405);
    assert.equal((await worker.fetch(request({ q: 'hi' }, { path: '/' }), e)).status, 404);
    const pre = await worker.fetch(
      new Request('https://x/ask', { method: 'OPTIONS', headers: { origin: 'http://localhost:8080' } }),
      e,
    );
    assert.equal(pre.status, 204);
    assert.equal(pre.headers.get('access-control-allow-methods'), 'POST, OPTIONS');
  });

  it('applies the rate limit, and cuts long questions', async () => {
    let q = '';
    const run = ai((m, i) => {
      q = i.messages[1].content;
      return { response: 'ok' };
    });
    assert.equal((await worker.fetch(request({ q: 'hi' }), env({ AI: run, ASK_LIMITER: limiter(false) }))).status, 429);
    await worker.fetch(request({ q: 'x'.repeat(5000) }), env({ AI: run }));
    assert.match(q, /QUESTION: x{300}$/);
  });
});

describe('answer text', () => {
  it('turns passage ids cited as files into real file names', async () => {
    assert.equal(fixRefs('See faq-1.md and career-1.md.'), 'See faq.md and career.log.');
    assert.equal(fixRefs('See faq-1.md and faq-13.md.'), 'See faq.md.');
    assert.equal(fixRefs('See resp-bud and case-ai.md.'), 'See budget.md and ' + fileOf('case-ai') + '.');
    assert.equal(fixRefs('He knows the stack well; see intro.md.'), 'He knows the stack well; see README.md.');
    assert.equal(fixRefs('See budget.md.'), 'See budget.md.');
    const e = env({
      AI: ai((m, i) => {
        assert.match(i.messages[1].content, /\[faq-1\] \(file: faq\.md\)/);
        return { response: 'He wants hands-on leadership roles. See faq-1.md and career-1.md.\nSOURCES: faq-1' };
      }),
    });
    const d = await (await worker.fetch(request({ q: 'What roles is he looking for?' }), e)).json();
    assert.equal(d.answer, 'He wants hands-on leadership roles. See faq.md and career.log.');
  });

  it('drops copied file labels, and maps file names on the SOURCES line to passages', () => {
    const ctx = pickContext('Where did he study?');
    let d = parse(
      'He earned an MEng from Newcastle University (file: recommendations.txt).\nSOURCES: recommendations.txt',
      ctx,
    );
    assert.equal(d.answer, 'He earned an MEng from Newcastle University.');
    assert.ok(d.sources.includes('recognition'), JSON.stringify(d.sources));
    d = parse(
      'Yes, he has. See acquisition.md.\nSOURCES: acquisition.md, faq.md',
      pickContext('Has he been through an acquisition?'),
    );
    assert.ok(d.sources.includes('resp-acq'), JSON.stringify(d.sources));
    assert.ok(
      d.sources.some((id) => id.startsWith('faq-')),
      JSON.stringify(d.sources),
    );
    d = parse('Answer.\n\nSOURCES:\n- [faq-1]\n- career-1', ctx);
    assert.deepEqual(d.sources, ['faq-1', 'career-1']);
  });

  it('knows which file each kind of passage lives in', () => {
    assert.equal(fileOf('intro'), 'README.md');
    assert.equal(fileOf('faq-3'), 'faq.md');
    assert.equal(fileOf('career-2'), 'career.log');
    assert.equal(fileOf('no-such-passage'), null);
  });
});

describe('context selection', () => {
  const ids = (/** @type {string} */ q) => pickContext(q).map((p) => p.id);

  it('finds the passages that answer the question', () => {
    assert.ok(ids('Has he been through an acquisition?').includes('resp-acq'));
    assert.ok(ids('Tell me about the monorepo').includes('case-mono'));
    assert.ok(ids('What does he know about Terraform?').includes('stack'));
    assert.ok(ids('Where did he study?').includes('recognition'));
    assert.ok(ids('Is he good at hiring?').includes('resp-hire'));
  });

  it('gives career questions the whole career, and unmatched ones a fallback', () => {
    assert.ok(ids('Who did he work for before Hive HR?').includes('career-3'));
    assert.ok(ids('Where has he worked?').includes('career-4'));
    assert.ok(ids('qwerty zzz').length >= 6);
  });

  it('uses the same search as the page', () => {
    const index = prepareIndex(knowledge);
    const top = rank(index, 'What qualifications does he have?')[0].p.id;
    assert.ok(ids('What qualifications does he have?').includes(top));
    // Synonyms from both old copies survive the merge.
    assert.ok(ALT.qualifications && ALT.ai);
  });
});
