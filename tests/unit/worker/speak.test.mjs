// /speak: answers read aloud in a natural voice, falling back through voices.
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import worker, { speakable } from '../../../worker/src/index.js';
import { ORIGIN, ai, env, request } from './helpers.mjs';

describe('/speak', () => {
  it('reads with a natural voice, falling back to the next one', async () => {
    /** @type {[string, any][]} */
    const seen = [];
    const mp3 = new Uint8Array(4000).fill(7);
    const e = env({
      AI: ai((model, input) => {
        seen.push([model, input]);
        if (model.includes('aura-2')) throw new Error('quota');
        return new ReadableStream({
          start(c) {
            c.enqueue(mp3);
            c.close();
          },
        });
      }),
    });
    const r = await worker.fetch(
      request({ text: 'He has. See budget.md and faq.md, or email craga89@gmail.com.' }, { path: '/speak' }),
      e,
    );
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('content-type'), 'audio/mpeg');
    assert.equal(r.headers.get('x-voice'), 'aura-1');
    assert.equal(r.headers.get('access-control-allow-origin'), ORIGIN);
    assert.equal((await r.arrayBuffer()).byteLength, 4000);
    assert.equal(seen[0][0], '@cf/deepgram/aura-2-en');
    assert.equal(seen[1][1].text, 'He has. See the budget file and the FAQ, or email craga89 at gmail dot com.');
    assert.equal(seen[1][1].speaker, 'helios');
  });

  it('takes MeloTTS base64 as a last resort, and 503s when nothing works', async () => {
    const b64 = Buffer.from(new Uint8Array(500).fill(1)).toString('base64');
    const r = await worker.fetch(
      request({ text: 'Hello.' }, { path: '/speak' }),
      env({
        AI: ai((model) => {
          if (!model.includes('melotts')) throw new Error('down');
          return { audio: b64 };
        }),
      }),
    );
    assert.equal(r.status, 200);
    assert.equal(r.headers.get('x-voice'), 'melotts');
    const down = env({
      AI: ai(() => {
        throw new Error('down');
      }),
    });
    assert.equal((await worker.fetch(request({ text: 'Hello.' }, { path: '/speak' }), down)).status, 503);
  });

  it('checks the origin and the input', async () => {
    const e = env({
      AI: ai(() => {
        throw new Error('unused');
      }),
    });
    assert.equal(
      (await worker.fetch(request({ text: 'Hello.' }, { path: '/speak', origin: 'https://evil.example' }), e)).status,
      403,
    );
    assert.equal((await worker.fetch(request({ text: '  ' }, { path: '/speak' }), e)).status, 400);
    assert.equal((await worker.fetch(request(null, { path: '/speak', method: 'GET' }), e)).status, 405);
  });
});

describe('speakable', () => {
  it('reads file names and addresses as words, within a length limit', () => {
    assert.equal(speakable('x'.repeat(5000)).length, 1000);
    assert.equal(
      speakable('See ai/platform.md, ci-cd.md and README.md.'),
      'See the AI platform case study, the ci cd file and the README.',
    );
    assert.equal(speakable('Visit craigthompson.dev or run ask.sh'), 'Visit craigthompson dot dev or run ask');
    assert.equal(speakable(null), '');
  });
});
