// Condenses Lighthouse JSON reports into one summary: median scores per category,
// key metrics, and every audit that isn't passing (with its top offending items).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] || 'out';
const median = (xs) => { const s = xs.filter((x) => x != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const out = {};
for (const preset of ['mobile', 'desktop']) {
  const runs = readdirSync(dir).filter((f) => f.startsWith(preset + '-') && f.endsWith('.json'))
    .map((f) => { try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; } })
    .filter((r) => r && r.categories);
  if (!runs.length) { out[preset] = { error: 'no runs' }; continue; }
  const pick = runs.slice().sort((a, b) => a.categories.performance.score - b.categories.performance.score)[Math.floor(runs.length / 2)];
  const scores = {};
  for (const k of Object.keys(pick.categories)) scores[k] = median(runs.map((r) => r.categories[k] && Math.round(r.categories[k].score * 100)));
  const metrics = {};
  for (const id of ['first-contentful-paint', 'largest-contentful-paint', 'total-blocking-time', 'cumulative-layout-shift', 'speed-index', 'interactive']) {
    metrics[id] = median(runs.map((r) => r.audits[id] && r.audits[id].numericValue));
    if (metrics[id] != null) metrics[id] = id.includes('layout') ? +metrics[id].toFixed(3) : Math.round(metrics[id]);
  }
  const failing = [];
  for (const [cat, c] of Object.entries(pick.categories)) {
    for (const ref of c.auditRefs) {
      const a = pick.audits[ref.id];
      if (!a || a.score == null || a.score >= 0.9 || a.scoreDisplayMode === 'notApplicable' || a.scoreDisplayMode === 'manual') continue;
      const items = ((a.details && a.details.items) || []).slice(0, 5).map((it) => {
        const o = {};
        for (const k of ['url', 'source', 'node', 'wastedBytes', 'wastedMs', 'totalBytes', 'label', 'description', 'value']) {
          if (it[k] == null) continue;
          o[k] = k === 'node' ? (it.node.snippet || it.node.selector) : k === 'source' && typeof it.source === 'object' ? it.source.url : it[k];
        }
        return o;
      });
      failing.push({ category: cat, id: ref.id, title: a.title, score: a.score, display: a.displayValue || '', items });
    }
  }
  const weight = pick.audits['total-byte-weight'];
  const lcpEl = pick.audits['largest-contentful-paint-element'];
  out[preset] = {
    runs: runs.length, scores, metrics,
    totalBytes: weight && weight.numericValue,
    lcpElement: lcpEl && lcpEl.details && lcpEl.details.items && JSON.stringify(lcpEl.details.items).slice(0, 400),
    failing,
  };
}
console.log(JSON.stringify(out, null, 2));
