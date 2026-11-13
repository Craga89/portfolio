# 0009. Dependency updates merge themselves

- **Status:** Accepted
- **Date:** 2026-11-13

## Context

Dependabot opens a grouped pull request a week for the dev dependencies and one for the GitHub
Actions. Reviewing and merging them took time every week, and most were patch or minor bumps that
CI had already checked.

## Decision

- **Patch and minor updates merge by themselves** once every required check on `main` passes.
  `.github/workflows/dependabot.yml` calls the shared `dependabot-auto-merge.yml` from
  Craga89/standards, which turns on auto-merge. A grouped pull request merges only when every
  update in it is patch or minor.
- **It merges as a GitHub App**, whose client ID and key are Dependabot secrets, so the merge starts
  the deploy and the screenshot baselines as a person's would.
- **Majors, and updates that fail a check, wait for a person.** A weekly scheduled Claude task fixes
  the failing ones where it can (on the pull request's branch, never merging) and reports the rest.
  A pull request whose only failure is Screenshots always waits for a person.
- The 7-day Dependabot cooldown stays, so a release has had a week to be pulled first.

## Options considered

- **Auto-merge patch and minor, as a GitHub App.** Most updates need no one, and merges still
  deploy.
- **Auto-merge everything, majors too.** Fewer pull requests again, but a major can change behaviour
  the checks don't cover.
- **Merge with the workflow's `GITHUB_TOKEN`.** No App to set up, but its merges don't start the
  workflows that run on a push, so nothing would deploy until the next merge.
- **Keep merging by hand.** Safest, but the cost this decision removes.

## Consequences

The required checks become the only review of a patch or minor update, so a check removed from the
ruleset also stops guarding dependencies. An update that breaks something the checks don't cover
reaches the site unreviewed; the rollback is to revert its commit. Revisit if one does, or if the
App's key needs rotating (Settings → Developer settings → GitHub Apps).
