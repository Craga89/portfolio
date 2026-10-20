// Runs worker/evals.json against the live ask.sh Worker and fails if any answer is wrong,
// makes something up, or ignores its rules. Requests are marked as test traffic so they
// aren't logged. Each case gets one retry, since model output varies slightly run to run.
//   node tools/ask-evals.mjs https://craga-ask.craga89.workers.dev/ask
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { errorMessage } from '../shared/errors.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const endpoint = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : '') || JSON.parse(readFileSync(join(ROOT, 'ask.config.json'), 'utf8')).endpoint;
const { cases } = JSON.parse(readFileSync(join(ROOT, 'worker', 'evals.json'), 'utf8'));
const ORIGIN = 'https://craigthompson.dev';

// The Worker allows 8 questions a minute per visitor, so pace the requests and wait out a 429.
const PACE = Number(process.env.EVAL_PACE_MS || 8000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
// The tests' share of the day's free AI allowance is used up: skip the run rather than fail it.
class OverBudget extends Error {}
async function ask(q) {
  for (let tries = 0; ; tries++) {
    const wait = last + PACE - Date.now();
    if (wait > 0) await sleep(wait);
    last = Date.now();
    const r = await fetch(endpoint, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-craga-test': '1' }, body: JSON.stringify({ q }) });
    if (r.status === 429 && tries < 3) { await sleep(30000); continue; }
    if (r.status === 503 && (await r.clone().json().catch(() => ({}))).error === 'budget') throw new OverBudget();
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
}
function grade(c, d) {
  const problems = [];
  const a = String(d.answer || '');
  for (const m of c.must || []) if (!new RegExp(m, 'i').test(a)) problems.push(`missing /${m}/`);
  for (const m of c.mustNot || []) if (new RegExp(m, 'is').test(a)) problems.push(`contains /${m}/`);
  if (c.answerable && !(d.sources || []).length) problems.push('no sources');
  if (a.split(/\s+/).length > 160) problems.push('too long');
  return problems;
}

let failed = 0;
const rows = [];
for (const c of cases) {
  let d = null, problems = ['no answer'];
  for (let attempt = 0; attempt < 2 && problems.length; attempt++) {
    try { d = await ask(c.q); problems = grade(c, d); } catch (e) {
      if (e instanceof OverBudget) { console.log((process.env.GITHUB_ACTIONS ? '::notice title=ask.sh answer tests::' : '') + "Skipped: today's AI allowance for tests is used up. They'll run again on the next schedule."); process.exit(0); }
      problems = [errorMessage(e)];
    }
  }
  const pass = !problems.length;
  if (!pass) failed++;
  rows.push({ q: c.q, expect: c.expect || '', pass, problems, answer: d && d.answer, sources: (d && d.sources) || [], model: d && d.model });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.q}${pass ? '' : '  → ' + problems.join('; ')}`);
  if (!pass && d) console.log('     ' + String(d.answer).replace(/\n/g, ' ').slice(0, 300));
  if (process.env.GITHUB_ACTIONS) {
    const esc = (x) => String(x).replace(/%/g, '%25').replace(/\r?\n/g, ' ').replace(/::/g, ': :');
    const line = esc((d ? `${d.answer} [sources: ${(d.sources || []).join(', ')}] [${d.model}]` : '').slice(0, 600));
    console.log(pass ? `::notice title=${esc(c.q)}::PASS ${line}` : `::error title=${esc(c.q)}::${esc(problems.join('; '))} — ${line}`);
  }
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ask.sh evals: ${cases.length - failed}/${cases.length} pass\n\n| | question | notes |\n|---|---|---|\n` + rows.map((r) => `| ${r.pass ? '✅' : '❌'} | ${r.q} | ${r.pass ? '' : r.problems.join('; ')} |`).join('\n') + '\n');
}
console.log(`${cases.length - failed}/${cases.length} pass`);
// --out file.json: the full results, for the site's "how ask.sh is tested" panel.
const outAt = process.argv.indexOf('--out');
if (outAt > 0 && process.argv[outAt + 1]) {
  const { writeFileSync } = await import('node:fs');
  writeFileSync(process.argv[outAt + 1], JSON.stringify({ at: new Date().toISOString(), total: cases.length, passed: cases.length - failed, cases: rows }, null, 2));
}
process.exit(failed ? 1 : 0);
