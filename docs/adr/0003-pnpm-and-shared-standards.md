# 0003. pnpm, and lint, format and TypeScript configs from Craga89/standards

- **Status:** Accepted
- **Date:** 2026-10-30
- **Pull requests:** #21, #30

## Context

This repo and craigsworks each kept their own copies of the same lint, format and TypeScript
settings and CI steps, so a change had to be made twice. npm ran dependencies' install scripts
without review.

## Decision

- Use pnpm, pinned in `package.json` (`packageManager`). Dependencies' install scripts only run when
  listed in `pnpm-workspace.yaml` (`allowBuilds`), and new releases wait a day before they're
  installed (`minimumReleaseAge`).
- Take the oxlint, oxfmt and TypeScript configs from `@craga89/standards`, a pnpm config dependency
  pinned by version and integrity, and keep only this repo's overrides here.
- Use Craga89/standards' shared actions and workflows (setup, previews, security review), pinned to
  commit SHAs.

## Options considered

- **pnpm and shared configs.** One place to change the rules for every repo; install scripts
  reviewed.
- **npm with copied configs.** What was there; every change made in each repo.

## Consequences

- A change to the shared rules is made once, in Craga89/standards, and each repo takes it with a
  version bump.
- Contributors need pnpm. `npm` and `npx` are gone from the scripts and docs.
- The shared workflows are pinned to merge commits newer than standards' `v1` branch, so their
  `# v1` comments don't match the pin (zizmor reports this; `.github/zizmor.yml` accepts it until
  standards tags its releases).
