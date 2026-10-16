// Runs worker/evals.json against the live ask.sh Worker and fails if any answer is wrong,
// makes something up, or ignores its rules. Requests are marked as test traffic so they
// aren't logged. Each case gets one retry, since model output varies slightly run to run.
//   node tools/ask-evals.mjs https://craga-ask.craga89.workers.dev/ask
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const endpoint = process.argv[2] || JSON.parse(readFileSync(join(ROOT, 'ask.config.json'), 'utf8')).endpoint;
const { cases } = JSON.parse(readFileSync(join(ROOT, 'worker', 'evals.json'), 'utf8'));
const ORIGIN = 'https://craigthompson.dev';

async function ask(q) {
  const r = await fetch(endpoint, { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json', 'x-craga-test': '1' }, body: JSON.stringify({ q }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
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
    try { d = await ask(c.q); problems = grade(c, d); } catch (e) { problems = [e.message]; }
  }
  const pass = !problems.length;
  if (!pass) failed++;
  rows.push({ q: c.q, pass, problems, answer: d && d.answer, model: d && d.model });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${c.q}${pass ? '' : '  → ' + problems.join('; ')}`);
  if (!pass && d) console.log('     ' + String(d.answer).replace(/\n/g, ' ').slice(0, 300));
}
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import('node:fs');
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `## ask.sh evals: ${cases.length - failed}/${cases.length} pass\n\n| | question | notes |\n|---|---|---|\n` + rows.map((r) => `| ${r.pass ? '✅' : '❌'} | ${r.q} | ${r.pass ? '' : r.problems.join('; ')} |`).join('\n') + '\n');
}
console.log(`${cases.length - failed}/${cases.length} pass`);
process.exit(failed ? 1 : 0);
