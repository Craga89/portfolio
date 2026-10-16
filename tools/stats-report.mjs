// Weekly summary of the anonymous visit counts and ask.sh questions (D1 database craga-ask),
// written to the GitHub Actions job summary. Needs wrangler and a Cloudflare API token with D1 read.
//   CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… node tools/stats-report.mjs [days]
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const days = Number(process.argv[2] || 7);
const since = `strftime('%Y-%m-%dT%H:%M:%SZ','now','-${days} days')`;
const q = (sql) => {
  const out = execFileSync('npx', ['-y', 'wrangler@4', 'd1', 'execute', 'craga-ask', '--remote', '--json', '--command', sql], { cwd: join(ROOT, 'worker'), encoding: 'utf8' });
  return JSON.parse(out)[0].results;
};
const table = (rows, cols) => rows.length ? `| ${cols.join(' | ')} |\n|${cols.map(() => '---').join('|')}|\n` + rows.map((r) => `| ${cols.map((c) => String(r[c] ?? '–').replace(/\|/g, '\\|')).join(' | ')} |`).join('\n') + '\n' : '_none_\n';

const visits = q(`SELECT COUNT(*) AS n, ROUND(AVG(seconds)) AS avg_s FROM visits WHERE at >= ${since}`)[0];
const byPath = q(`SELECT path, COUNT(*) AS visits FROM visits WHERE at >= ${since} GROUP BY path ORDER BY visits DESC LIMIT 10`);
const refs = q(`SELECT COALESCE(referrer,'(direct or hidden)') AS referrer, COUNT(*) AS visits FROM visits WHERE at >= ${since} GROUP BY referrer ORDER BY visits DESC LIMIT 10`);
const devices = q(`SELECT COALESCE(device,'?') AS device, COUNT(*) AS visits FROM visits WHERE at >= ${since} GROUP BY device ORDER BY visits DESC`);
const countries = q(`SELECT COALESCE(country,'?') AS country, COUNT(*) AS visits FROM visits WHERE at >= ${since} GROUP BY country ORDER BY visits DESC LIMIT 8`);
const home = q(`SELECT COUNT(*) AS n FROM visits WHERE at >= ${since} AND path IN ('/','/portfolio/')`)[0].n || 0;
const reach = ['career', 'responsibilities', 'case-studies', 'stack', 'oss', 'recommendations', 'faq', 'ask'].map((s) => {
  const n = q(`SELECT COUNT(*) AS n FROM visits WHERE at >= ${since} AND path IN ('/','/portfolio/') AND (',' || sections || ',') LIKE '%,${s},%'`)[0].n || 0;
  return { section: s, reached: n, share: home ? Math.round((n / home) * 100) + '%' : '–' };
});
const qs = q(`SELECT COUNT(*) AS n, SUM(answered) AS answered FROM questions WHERE at >= ${since}`)[0];
const unanswered = q(`SELECT substr(at,1,10) AS day, question, model FROM questions WHERE at >= ${since} AND answered = 0 ORDER BY at DESC LIMIT 25`);
const recent = q(`SELECT substr(at,1,10) AS day, question FROM questions WHERE at >= ${since} AND answered = 1 ORDER BY at DESC LIMIT 25`);

const md = `## craigthompson.dev · last ${days} days

**${visits.n || 0} visits** (average ${visits.avg_s || 0}s on the page) · **${qs.n || 0} ask.sh questions**, ${qs.answered || 0} answered

### Pages
${table(byPath, ['path', 'visits'])}
### Where visitors came from
${table(refs, ['referrer', 'visits'])}
### How far people read (home page)
${table(reach, ['section', 'reached', 'share'])}
### Devices
${table(devices, ['device', 'visits'])}
### Countries
${table(countries, ['country', 'visits'])}
### Questions ask.sh couldn't answer (FAQ candidates)
${table(unanswered, ['day', 'question', 'model'])}
### Questions it answered
${table(recent, ['day', 'question'])}`;
console.log(md);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
