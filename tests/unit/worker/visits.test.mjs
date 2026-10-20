// Anonymous logging: questions asked, and cookie-free visit counts.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { cleanHit } from '../../../worker/src/index.js';
import { ORIGIN, ai, env, fakeDB, request } from './helpers.mjs';

describe('question log', () => {
  it('logs questions anonymously, with whether they were answered', async () => {
    const DB = fakeDB();
    await worker.fetch(request({ q: 'Has he owned a budget?' }), env({ DB, AI: ai(() => ({ response: 'He has. See budget.md.\nSOURCES: resp-bud' })) }));
    const notCovered = env({ DB, AI: ai(() => ({ response: "That isn't covered on the site, but Craig can answer it directly: craga89@gmail.com." })) });
    await worker.fetch(request({ q: 'What is his favourite colour?' }), notCovered);
    assert.equal(DB.rows.length, 2);
    assert.match(DB.rows[0].sql, /INSERT INTO questions/);
    assert.deepEqual(DB.rows[0].args.slice(0, 2), ['Has he owned a budget?', 1]);
    assert.deepEqual(DB.rows[1].args.slice(0, 2), ['What is his favourite colour?', 0]);
    assert.ok(!JSON.stringify(DB.rows).includes('127.0.0.1'));
  });

  it("doesn't log CI and smoke-test traffic", async () => {
    const DB = fakeDB();
    await worker.fetch(request({ q: 'hi' }, { headers: { 'x-craga-test': '1' } }), env({ DB, AI: ai(() => ({ response: 'x' })) }));
    assert.equal(DB.rows.length, 0);
  });
});

describe('visit beacons', () => {
  it('are cleaned, and bots and other sites ignored', async () => {
    const DB = fakeDB();
    const e = env({ DB, AI: ai(() => ({ response: 'x' })) });
    const beacon = (/** @type {Record<string, unknown>} */ body, /** @type {Record<string, string>} */ headers = {}) =>
      worker.fetch(
        new Request('https://x/hit', {
          method: 'POST',
          headers: { origin: ORIGIN, 'content-type': 'text/plain', 'user-agent': 'Mozilla/5.0 Chrome/150', ...headers },
          body: JSON.stringify(body),
        }),
        e,
      );
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

  it('record the translated language and the offer, nothing else', () => {
    assert.equal(cleanHit({ path: '/', lang: 'de', offer: 'accepted' }, ORIGIN)?.lang, 'de');
    assert.equal(cleanHit({ path: '/', lang: 'de', offer: 'accepted' }, ORIGIN)?.offer, 'accepted');
    assert.equal(cleanHit({ path: '/', lang: 'xx-evil', offer: 'hack' }, ORIGIN)?.lang, null);
    assert.equal(cleanHit({ path: '/', lang: 'xx-evil', offer: 'hack' }, ORIGIN)?.offer, null);
    assert.equal(cleanHit({ path: '/', lang: 'zh-Hant' }, ORIGIN)?.lang, 'zh-Hant');
    assert.equal(cleanHit({ path: '/', ref: 'not a url' }, ORIGIN)?.referrer, null);
  });
});
