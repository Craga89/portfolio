// Core Web Vitals from Cloudflare Web Analytics, for the weekly stats report.
import { describe as group, it } from 'node:test';
import assert from 'node:assert/strict';
import { describe, rate, toVitals, vitals } from '../../../../tools/lib/vitals.mjs';

const q = (lcp, inp, cls) => ({
  largestContentfulPaintP75: lcp,
  interactionToNextPaintP75: inp,
  cumulativeLayoutShiftP75: cls,
});

/** A stand-in for the GraphQL API. @param {unknown} body @param {number} [status] */
const api = (body, status = 200) => {
  /** @type {{ url: string, init: RequestInit }[]} */
  const calls = [];
  const fetch = async (/** @type {string} */ url, /** @type {RequestInit} */ init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  };
  return { calls, fetch: /** @type {typeof globalThis.fetch} */ (/** @type {unknown} */ (fetch)) };
};

group('vitals', () => {
  it('turns microseconds into milliseconds, and keeps CLS as a score', () => {
    assert.deepEqual(toVitals({ count: 3, quantiles: q(960000, 80000, 0.006) }), {
      count: 3,
      lcp: 960,
      inp: 80,
      cls: 0.006,
    });
    assert.equal(toVitals({ count: 1, quantiles: q(276000, -1, 0) }).inp, null, 'no interaction on the page');
    assert.deepEqual(toVitals({ count: 0, quantiles: q(null, null, null) }), {
      count: 0,
      lcp: null,
      inp: null,
      cls: null,
    });
  });

  it('rates each metric against the web.dev thresholds', () => {
    assert.equal(rate('lcp', 2500), 'good');
    assert.equal(rate('lcp', 2501), 'needs improvement');
    assert.equal(rate('inp', 501), 'poor');
    assert.equal(rate('cls', 0.1), 'good');
    assert.equal(rate('cls', null), '–');
  });

  it('describes them for the report', () => {
    assert.deepEqual(describe({ count: 9, lcp: 960, inp: 80, cls: 0.006 }), {
      visits: 9,
      'LCP (p75)': '0.96s, good',
      'INP (p75)': '80ms, good',
      'CLS (p75)': '0.006, good',
    });
    assert.equal(describe({ count: 0, lcp: null, inp: null, cls: null })['LCP (p75)'], '–');
  });

  it('asks for the last days of real pages, and reads the answer', async () => {
    const { calls, fetch } = api({
      data: {
        viewer: {
          accounts: [
            {
              all: [{ count: 154, quantiles: q(960000, 80000, 0.006) }],
              byPath: [{ count: 100, dimensions: { requestPath: '/' }, quantiles: q(900000, 70000, 0.004) }],
              byDevice: [{ count: 90, dimensions: { deviceType: 'mobile' }, quantiles: q(1200000, 96000, 0.01) }],
            },
          ],
        },
      },
    });
    const now = new Date('2026-11-09T07:07:00Z');
    const r = await vitals({ account: 'acc', token: 'tok', days: 7, now, fetch });
    assert.deepEqual(r.all, { count: 154, lcp: 960, inp: 80, cls: 0.006 });
    assert.deepEqual(r.byPath, [{ path: '/', count: 100, lcp: 900, inp: 70, cls: 0.004 }]);
    assert.deepEqual(r.byDevice, [{ device: 'mobile', count: 90, lcp: 1200, inp: 96, cls: 0.01 }]);

    const sent = JSON.parse(String(calls[0].init.body));
    assert.equal(calls[0].url, 'https://api.cloudflare.com/client/v4/graphql');
    assert.equal(/** @type {Record<string, string>} */ (calls[0].init.headers).authorization, 'Bearer tok');
    assert.deepEqual(sent.variables, {
      account: 'acc',
      site: '9126a029dd344569b09474fca5f135c6',
      since: '2026-11-02T07:07:00.000Z',
      until: '2026-11-09T07:07:00.000Z',
    });
    assert.match(sent.query, /requestPath_notlike: "\/storybook\/%"/);
    assert.match(sent.query, /requestPath_notlike: "\/preview\/%"/);
  });

  it('reports no visits as no measurements', async () => {
    const { fetch } = api({ data: { viewer: { accounts: [{ all: [], byPath: [], byDevice: [] }] } } });
    const r = await vitals({ account: 'a', token: 't', days: 7, fetch });
    assert.deepEqual(r, { all: { count: 0, lcp: null, inp: null, cls: null }, byPath: [], byDevice: [] });
    const none = api({ data: { viewer: { accounts: [] } } });
    assert.equal((await vitals({ account: 'a', token: 't', days: 7, fetch: none.fetch })).all.count, 0);
  });

  it('says why when the API refuses', async () => {
    await assert.rejects(
      vitals({
        account: 'a',
        token: 't',
        days: 7,
        fetch: api({ data: null, errors: [{ message: 'not authorized' }] }).fetch,
      }),
      /not authorized/,
    );
    await assert.rejects(vitals({ account: 'a', token: 't', days: 7, fetch: api({}, 403).fetch }), /HTTP 403/);
    const gateway = /** @type {typeof globalThis.fetch} */ (
      /** @type {unknown} */ (async () => new Response('<html>Bad gateway</html>', { status: 502 }))
    );
    await assert.rejects(vitals({ account: 'a', token: 't', days: 7, fetch: gateway }), /HTTP 502: <html>Bad gateway/);
  });
});
