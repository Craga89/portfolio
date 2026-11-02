# Reviewing changes to this repo

For whoever reviews a pull request here, person or model. This is Craig's personal site and CV,
plus a public Cloudflare Worker (ask.sh, read-aloud, MCP) that visitors and AI agents call. What
matters: every page is true and works for everyone, wherever it's served from, and the Worker
stays free, private and read-only. Style is the formatter's and linter's job, not review's. See
[code-review.md](https://github.com/Craga89/standards/blob/main/guidelines/code-review.md).

## What failure looks like here

- **The Worker costing money or leaking.** Anything that lets AI spending skip `budget.js`
  (D1 unreadable must mean AI off, not unmetered), widens `ALLOWED` origins, loosens a rate
  limit, or stores more about visitors than the README promises (no IPs, cookies or user
  agents; Do Not Track and Global Privacy Control skip logging).
- **ask.sh saying something untrue**: answering beyond the passages, giving salary figures, or
  following instructions in a question. A prompt or model change runs the evals
  (`worker/evals.json`).
- **The MCP endpoint breaking one protocol era** while fixing the other, or a tool that writes.
  `shared/agent-tools.js` is shared by the page and the Worker; change it once, not in a copy.
- **A link, fetch or asset that ignores the base path.** Previews are served from
  `/preview/<branch>-<hash>/`; every internal URL goes through `url()` in `src/lib/url.ts`.
- **Breaking the Content-Security-Policy** (`astro.config.mjs`): an inline style or script, or a
  new origin, is blocked in production.
- **The printed CV changing.** `cv.pdf` is printed from the page, so anything new on the page
  needs a print style, or hiding in `@media print` (the preview bar once printed on the CV).
- **Translation breaking**: names, emails, file names or code losing `translate="no"`, a
  physical CSS property (`margin-left`) where a logical one mirrors for Arabic and Hebrew, or
  text added by script that skips the translator.
- **The page needing `live.json`.** It loads once the page is idle and can fail; the static
  fallbacks keep working without it.
- **An accessibility regression** (WCAG 2.2 AA), in either theme, at any viewport.
- **A deploy step installing with npm.** `wrangler-action` falls back to npm without
  `packageManager: pnpm` and wrangler as a dev dependency, which rewrites `package.json`.
- **`[visual]` on a commit whose screenshot changes weren't all intended.** It accepts every
  changed baseline.

## Skip

- `pnpm-lock.yaml` (review the `package.json` change instead)
- `site/` and other build output, and `worker/knowledge.json` and `worker/agent-data.json`
  (written by the build)
- `redirects/cloudflare-bulk.csv` (written by `tools/redirects.mjs`; review the script or
  `old-domains.json`)
- `src/origin-trials.txt` (tokens)

## How to report

- Every finding has `file:line` and the evidence: the page and viewport where it breaks, the
  request that gets through, the test that fails. No evidence, no finding.
- Tag each one **Important** (fix before merging), **Nit** (at most three in a review) or
  **Pre-existing** (true, but not this change's doing).
- One comment for a class of bug, listing every place it occurs.
- After the first round, review only what changed since, and don't repeat a finding that's been
  answered.
- Start the summary with the number of Important findings. When there are none, say "Nothing to
  fix."
