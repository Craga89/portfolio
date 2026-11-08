# 0001. Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-11-08

## Context

The reasons for the site's larger choices are spread across pull request descriptions, commit
messages and the README. The README says how things work now, not why they were chosen or what
else was considered. Someone changing the site later, including an AI assistant, can't easily find
why something is the way it is, so may undo a decision without knowing what it was protecting.

## Decision

Record each significant decision as a short Markdown file in `docs/adr/`, numbered, with its
context, the decision, the options considered and the consequences. A record isn't edited once
accepted, apart from its status; a changed decision gets a new record.

Significant means hard to reverse, or affecting how the rest of the site is built: hosting, the
framework, security policy, data collected, paid services, shared tooling.

## Options considered

- **Records in the repository.** They're reviewed in the same pull request as the change and
  travel with the code.
- **The README alone.** It describes the current state well, but loses the reasons and the options
  turned down.
- **A wiki or a separate document.** It drifts from the code, and isn't reviewed with it.

## Consequences

Each significant change has a little more writing. The records written after the fact (0002–0008)
are only as complete as the pull requests they came from.
