// Core Web Vitals from real visitors, as Cloudflare Web Analytics measures them: its beacon, which
// Cloudflare adds to every page, reports LCP, INP and CLS. This reads them back through the
// GraphQL Analytics API, at the 75th percentile (how Google judges a page), for the weekly stats
// report (tools/stats-report.mjs). The token needs Account → Account Analytics → Read.

/** The site's Web Analytics tag (it's in every page's beacon, so not a secret). */
export const SITE_TAG = '9126a029dd344569b09474fca5f135c6';

/** Good and poor thresholds (web.dev): at or under the first is good, over the second is poor. */
export const THRESHOLDS = { lcp: [2500, 4000], inp: [200, 500], cls: [0.1, 0.25] };

const QUANTILES = 'count quantiles { largestContentfulPaintP75 interactionToNextPaintP75 cumulativeLayoutShiftP75 }';
const QUERY = `query ($account: String!, $site: String!, $since: Time!, $until: Time!) {
  viewer { accounts(filter: { accountTag: $account }) {
    all: rumWebVitalsEventsAdaptiveGroups(limit: 1, filter: $filter) { ${QUANTILES} }
    byPath: rumWebVitalsEventsAdaptiveGroups(limit: 10, orderBy: [count_DESC], filter: $filter) { dimensions { requestPath } ${QUANTILES} }
    byDevice: rumWebVitalsEventsAdaptiveGroups(limit: 5, orderBy: [count_DESC], filter: $filter) { dimensions { deviceType } ${QUANTILES} }
  } }
}`.replaceAll(
  '$filter',
  // Real pages only: not the component catalogue or a branch preview.
  '{ siteTag: $site, datetime_geq: $since, datetime_leq: $until, requestPath_notlike: "/storybook/%", AND: [{ requestPath_notlike: "/preview/%" }] }',
);

/**
 * @typedef {{ count: number, lcp: number | null, inp: number | null, cls: number | null }} Vitals
 *   LCP and INP in milliseconds, CLS as a score; null when nothing was measured
 * @typedef {{ count: number, dimensions?: Record<string, string>, quantiles: Record<string, number | null> }} Group
 */

/** @param {Group} g @returns {Vitals} */
export function toVitals(g) {
  const q = g.quantiles || {};
  // The API gives times in microseconds, and -1 when there was nothing to measure (no interaction on
  // the page, say).
  const ms = (/** @type {number | null | undefined} */ v) => (v == null || v < 0 ? null : Math.round(v / 1000));
  return {
    count: g.count,
    lcp: ms(q.largestContentfulPaintP75),
    inp: ms(q.interactionToNextPaintP75),
    cls: q.cumulativeLayoutShiftP75 ?? null,
  };
}

/**
 * How a value rates: good, needs improvement or poor.
 * @param {keyof typeof THRESHOLDS} metric @param {number | null} value
 */
export function rate(metric, value) {
  if (value == null) return '–';
  const [good, poor] = THRESHOLDS[metric];
  return value <= good ? 'good' : value <= poor ? 'needs improvement' : 'poor';
}

/** @param {Vitals} v */
export const describe = (v) => ({
  visits: v.count,
  'LCP (p75)': v.lcp == null ? '–' : `${(v.lcp / 1000).toFixed(2)}s, ${rate('lcp', v.lcp)}`,
  'INP (p75)': v.inp == null ? '–' : `${v.inp}ms, ${rate('inp', v.inp)}`,
  'CLS (p75)': v.cls == null ? '–' : `${v.cls.toFixed(3)}, ${rate('cls', v.cls)}`,
});

/**
 * The site's Core Web Vitals over the last `days` days: overall, by page and by device.
 * @param {{ account: string, token: string, days: number, site?: string, now?: Date, fetch?: typeof fetch }} o
 * @returns {Promise<{ all: Vitals, byPath: (Vitals & { path: string })[], byDevice: (Vitals & { device: string })[] }>}
 */
export async function vitals({ account, token, days, site = SITE_TAG, now = new Date(), fetch = globalThis.fetch }) {
  const until = now.toISOString();
  const since = new Date(now.getTime() - days * 864e5).toISOString();
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ query: QUERY, variables: { account, site, since, until } }),
  });
  // An error from a proxy or gateway may not be JSON, so read it as text first.
  const text = await res.text();
  /** @type {{ data?: any, errors?: { message: string }[] | null }} */
  let body = {};
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`HTTP ${res.status}: ${text.replace(/\s+/g, ' ').slice(0, 200)}`);
  }
  if (!res.ok || body.errors?.length || !body.data) {
    const why = body.errors?.map((e) => e.message).join('; ');
    throw new Error(why ? `HTTP ${res.status}: ${why}` : `HTTP ${res.status}`);
  }
  const a = body.data.viewer.accounts[0] ?? { all: [], byPath: [], byDevice: [] };
  /** @type {Group[]} */
  const all = a.all;
  return {
    all: all[0] ? toVitals(all[0]) : { count: 0, lcp: null, inp: null, cls: null },
    byPath: a.byPath.map((/** @type {Group} */ g) =>
      Object.assign(toVitals(g), { path: g.dimensions?.requestPath ?? '?' }),
    ),
    byDevice: a.byDevice.map((/** @type {Group} */ g) =>
      Object.assign(toVitals(g), { device: g.dimensions?.deviceType ?? '?' }),
    ),
  };
}
