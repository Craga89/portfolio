// Collects the latest CI results (Lighthouse, WCAG suite, ask.sh answer tests, open-source stats)
// from their report branches into one small live.json that the site reads. Run by the Pages
// deploy after `git fetch origin lighthouse accessibility evals oss`; missing pieces are skipped.
//   node tools/live.mjs site/live.json
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const show = (ref) => { try { return execFileSync('git', ['show', ref], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { return null; } };
const json = (ref) => { const t = show(ref); try { return t ? JSON.parse(t) : null; } catch { return null; } };
const text = (ref) => { const t = show(ref); return t ? t.trim() : null; };
const out = { at: new Date().toISOString() };
// The deployed commit, for the agent tools' site report (the worker has no other way to know it).
if (process.env.GITHUB_SHA) out.build = { sha: process.env.GITHUB_SHA, at: out.at };

const lh = json('origin/lighthouse:reports/summary.json');
if (lh && lh.mobile && lh.mobile.scores) {
  const pick = (s) => ({ performance: s.performance, accessibility: s.accessibility, bestPractices: s['best-practices'], seo: s.seo });
  out.lighthouse = { mobile: pick(lh.mobile.scores), desktop: lh.desktop && lh.desktop.scores ? pick(lh.desktop.scores) : null, at: text('origin/lighthouse:reports/at.txt'), run: text('origin/lighthouse:reports/run.txt'), sha: text('origin/lighthouse:reports/commit.txt') };
}
const a = json('origin/accessibility:reports/latest.json');
if (a && typeof a.pass === 'boolean') {
  out.a11y = { pass: a.pass, axeRuns: a.axeRuns, violations: (a.violations || []).length, failures: (a.failures || []).length, axe: a.axe, at: text('origin/accessibility:reports/at.txt') || a.at, run: text('origin/accessibility:reports/run.txt'), sha: text('origin/accessibility:reports/commit.txt') };
}
const e = json('origin/evals:reports/latest.json');
if (e && Array.isArray(e.cases)) {
  out.evals = { passed: e.passed, total: e.total, at: e.at, run: e.run || null, sha: e.sha || null, cases: e.cases.map((c) => ({ q: c.q, expect: c.expect || '', pass: !!c.pass, answer: String(c.answer || '').replace(/\s+/g, ' ').trim().slice(0, 420) })) };
}
const o = json('origin/oss:reports/oss.json');
if (o && o.prs) out.oss = { prs: o.prs, repos: o.repos, since: o.since, qtip: o.qtip, timeline: o.timeline || [], at: o.at };

writeFileSync(process.argv[2] || 'live.json', JSON.stringify(out));
const have = Object.keys(out).filter((k) => k !== 'at').join(', ') || '(nothing yet)';
console.log((process.env.GITHUB_ACTIONS ? '::notice title=live.json::' : 'live.json: ') + have + (out.evals ? ` · ask.sh ${out.evals.passed}/${out.evals.total}` : '') + (out.lighthouse ? ` · Lighthouse ${out.lighthouse.mobile.performance}/${out.lighthouse.desktop ? out.lighthouse.desktop.performance : '–'}` : '') + (out.a11y ? ` · WCAG ${out.a11y.pass ? 'pass' : 'fail'}` : ''));
