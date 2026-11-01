# Working on this repo

This repo follows [Craga89/standards](https://github.com/Craga89/standards). The short version:

- **pnpm only**, pinned in `package.json` (`packageManager`). Use `pnpm install`, `pnpm <script>`
  and `pnpm exec <bin>`, never npm or npx, and commit `pnpm-lock.yaml` with any dependency change.
- **oxlint and oxfmt** for linting and formatting. Don't add ESLint, Prettier or Biome.
- **Run `pnpm run verify`** (lint, format check, types, unit tests) before pushing, then
  `/code-review` (and `/security-review` for workflows, secrets or dependencies) before opening a
  pull request. Fill in the PR template's Testing, Risk and How to revert.
- **When reviewing**, follow [REVIEW.md](REVIEW.md). See
  [code-review.md](https://github.com/Craga89/standards/blob/main/guidelines/code-review.md).
- **Types are checked by `tsc`**, JavaScript included (`checkJs`). Write ESM.
- **Actions are pinned to commit SHAs.** Keep the `# vX.Y.Z` comment when you change one.
- **Commits and PR titles** follow Conventional Commits: `type(scope): summary`. See
  [git.md](https://github.com/Craga89/standards/blob/main/guidelines/git.md).

## This repo

- See `README.md` for how the site, the Worker and CI fit together.
- **Scopes** for commits and PR titles: `pages`, `content`, `cv`, `intro`, `theme`, `seo`,
  `contact`, `recommendations`, `ask`, `worker`, `a11y`, `e2e`, `preview`, `deploy`,
  `analytics`, `deps`.
- Put `[visual]` in a commit message on `main` only when every screenshot change is intended.
