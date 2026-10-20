// Open-source numbers for the site, from the GitHub API (run in CI with GITHUB_TOKEN):
// merged pull requests to other people's public projects, and qTip2's stars, forks and commits.
//   GITHUB_TOKEN=… node tools/oss-stats.mjs out.json
import { writeFileSync } from 'node:fs';

const USER = 'Craga89';
const OWN = ['Craga89', 'qTip2']; // my own accounts and projects don't count as "other projects"
const token = process.env.GITHUB_TOKEN;
const gh = async (path) => {
  const r = await fetch('https://api.github.com' + path, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: 'Bearer ' + token } : {}),
    },
  });
  if (!r.ok) throw new Error(path + ' → HTTP ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return { body: await r.json(), link: r.headers.get('link') || '' };
};

const q = encodeURIComponent(`is:pr is:merged author:${USER} ${OWN.map((o) => '-user:' + o).join(' ')}`);
const prs = [];
for (let page = 1; page <= 10; page++) {
  const { body } = await gh(`/search/issues?q=${q}&per_page=100&page=${page}`);
  prs.push(...body.items);
  if (prs.length >= body.total_count || !body.items.length) break;
}
const repos = new Set(prs.map((p) => p.repository_url.replace('https://api.github.com/repos/', '').toLowerCase()));
const years = prs.map(
  (p) => +((p.pull_request && p.pull_request.merged_at) || p.closed_at || p.created_at).slice(0, 4),
);

// Merged pull requests by quarter, for the open-source heatmap on the site.
const quarters = {};
for (const p of prs) {
  const at = (p.pull_request && p.pull_request.merged_at) || p.closed_at || p.created_at;
  const y = +at.slice(0, 4),
    q = Math.floor((+at.slice(5, 7) - 1) / 3) + 1,
    k = y + 'Q' + q;
  const repo = p.repository_url.replace('https://api.github.com/repos/', '');
  const e = quarters[k] || (quarters[k] = { y, q, n: 0, repos: [] });
  e.n++;
  if (!e.repos.includes(repo)) e.repos.push(repo);
}
const timeline = Object.values(quarters).sort((a, b) => a.y - b.y || a.q - b.q);

const { body: repo } = await gh('/repos/qTip2/qTip2');
const { body: c1, link } = await gh('/repos/qTip2/qTip2/commits?per_page=1');
const last = /[?&]page=(\d+)>; rel="last"/.exec(link);
const commits = last ? +last[1] : c1.length;

const out = {
  at: new Date().toISOString(),
  prs: prs.length,
  repos: repos.size,
  since: years.length ? Math.min(...years) : null,
  qtip: { stars: repo.stargazers_count, forks: repo.forks_count, commits },
  timeline,
};
console.log(JSON.stringify(out));
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(out, null, 2));
if (process.env.GITHUB_ACTIONS)
  console.log(
    `::notice title=Open source::${out.prs} merged PRs across ${out.repos} other projects since ${out.since}; qTip2 ${out.qtip.stars} stars, ${out.qtip.forks} forks, ${out.qtip.commits} commits`,
  );
