// The daily AI budget: every AI feature stays inside Workers AI's free allowance.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../../worker/src/index.js';
import { ASK_RESERVE, BudgetError, CAPS, charge, check, exhausted, textCost, voiceCost } from '../../../worker/src/budget.js';
import { ai, env, fakeDB, request } from './helpers.mjs';

describe('costs', () => {
  it('prices text from reported token usage, or estimates it from characters', () => {
    // gemma-4-26b: 9,091 neurons per million tokens in, 27,273 out.
    assert.equal(textCost('@cf/google/gemma-4-26b-a4b-it', { prompt_tokens: 1e6, completion_tokens: 0 }, 0, 0), 9091);
    assert.equal(textCost('@cf/google/gemma-4-26b-a4b-it', undefined, 4e6, 0), 9091);
    // An unknown model is priced at the dearest rate, so it can't overspend.
    assert.ok(textCost('@cf/unknown/model', undefined, 4000, 0) > textCost('@cf/google/gemma-4-26b-a4b-it', undefined, 4000, 0));
  });

  it('prices voices per character', () => {
    assert.ok(Math.abs(voiceCost('@cf/deepgram/aura-2-en', 1000) - 2727.27) < 0.01);
    assert.equal(voiceCost('@cf/unknown/voice', 1000), voiceCost('@cf/deepgram/aura-2-en', 1000));
  });

  it('keeps the shares inside the 10,000 free neurons, and a question inside its reserve', () => {
    assert.ok(CAPS.ask + CAPS.speak + CAPS.test < 10000);
    assert.ok(textCost('@cf/google/gemma-4-26b-a4b-it', undefined, 16000, 2000) < ASK_RESERVE);
  });

  it("recognises Workers AI saying the day's free allocation is used", () => {
    assert.ok(exhausted(new Error('4006: you have used up your daily free allocation of 10,000 neurons')));
    assert.ok(!exhausted(new Error('3040: Capacity temporarily exceeded')));
    assert.ok(!exhausted('down'));
  });
});

describe('the ledger', () => {
  it('charges a share and refuses once it is full', async () => {
    const DB = fakeDB();
    const e = env({ DB, AI_CAP_ASK: '100' });
    await check(e, 'ask', 60);
    await charge(e, 'ask', 60);
    assert.equal(DB.budget.ask, 60);
    await assert.rejects(check(e, 'ask', 60), BudgetError);
    await check(e, 'speak', 60); // other shares are untouched
  });

  it('turns AI off when the ledger is unreadable, and skips without a database', async () => {
    const broken = env({ DB: { prepare: () => ({ bind: () => ({ first: async () => { throw new Error('D1 down'); }, run: async () => ({}) }) }) } });
    await assert.rejects(check(broken, 'ask', 1), /budget unavailable: D1 down/);
    await check(env(), 'ask', 1e9);
    await charge(env(), 'ask', 1e9);
  });
});

describe('through the endpoints', () => {
  const run = (/** @type {string} */ model) =>
    model.includes('deepgram') ? new Uint8Array(4000) : { response: 'He owned the AWS budget. See budget.md.\nSOURCES: resp-bud', usage: { prompt_tokens: 4000, completion_tokens: 150 } };

  it('charges answers and voice to their shares', async () => {
    const DB = fakeDB();
    const e = env({ DB, AI: ai(run) });
    assert.equal((await worker.fetch(request({ q: 'Has he owned a budget?' }), e)).status, 200);
    assert.ok(Math.abs(DB.budget.ask - (4000 * 9091 + 150 * 27273) / 1e6) < 0.05, String(DB.budget.ask));
    const sp = await worker.fetch(request({ text: 'Craig has led engineering teams for twelve years.' }, { path: '/speak' }), e);
    assert.equal(sp.status, 200);
    assert.ok(DB.budget.speak > 100 && DB.budget.speak < 160, String(DB.budget.speak)); // ~49 characters at 2.73 each
  });

  it("refuses a question over the share without calling a model, so the page uses its own search", async () => {
    let called = 0;
    const e = env({ DB: fakeDB({ ask: 5990 }), AI: ai((m) => { called++; return run(m); }) });
    const over = await worker.fetch(request({ q: 'Has he owned a budget?' }), e);
    assert.equal(over.status, 503);
    assert.equal((await over.json()).error, 'budget');
    assert.equal(called, 0);
  });

  it("refuses read-aloud that won't fit its share, so the page uses the browser's voice", async () => {
    const v = await worker.fetch(request({ text: 'x'.repeat(200) }, { path: '/speak' }), env({ DB: fakeDB({ speak: 2400 }), AI: ai(run) }));
    assert.equal(v.status, 503);
    assert.equal((await v.json()).error, 'budget');
  });

  it("charges CI traffic to the test share, not visitors'", async () => {
    const DB = fakeDB();
    await worker.fetch(request({ q: 'Has he owned a budget?' }, { headers: { 'x-craga-test': '1' } }), env({ DB, AI: ai(run) }));
    assert.ok(DB.budget.test > 0 && !DB.budget.ask);
  });

  it('closes every share for the day when the free allocation runs out', async () => {
    const DB = fakeDB();
    const e = env({ DB, AI: ai(() => { throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); }) });
    assert.equal((await worker.fetch(request({ q: 'Has he owned a budget?' }), e)).status, 503);
    assert.ok(DB.budget.ask >= CAPS.ask && DB.budget.speak >= CAPS.speak && DB.budget.test >= CAPS.test);
  });
});

