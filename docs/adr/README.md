# Architecture decision records

Each record here is one decision about how the site is built: what was decided, why, and what it
costs. They're short, numbered in the order they were made, and never rewritten. When a decision
changes, a new record replaces the old one, and the old one's status says so.

Records 0002 onwards were written after the fact, from the pull requests and history that made each
decision. Their dates are when the decision took effect.

| #                                                    | Decision                                                             | Status   |
| ---------------------------------------------------- | -------------------------------------------------------------------- | -------- |
| [0001](0001-record-architecture-decisions.md)        | Record architecture decisions                                        | Accepted |
| [0002](0002-static-astro-site-with-hash-only-csp.md) | A static Astro site, with a hash-only Content-Security-Policy        | Accepted |
| [0003](0003-pnpm-and-shared-standards.md)            | pnpm, and lint, format and TypeScript configs from Craga89/standards | Accepted |
| [0004](0004-host-on-cloudflare-workers.md)           | Host on Cloudflare Workers static assets, not GitHub Pages           | Accepted |
| [0005](0005-ask-sh-within-the-free-ai-allowance.md)  | ask.sh answers within Workers AI's free allowance                    | Accepted |
| [0006](0006-anonymous-analytics.md)                  | Anonymous analytics, with no cookies or identifiers                  | Accepted |
| [0007](0007-translation-on-the-visitors-device.md)   | Translation on the visitor's device                                  | Accepted |
| [0008](0008-component-catalogue-with-astrobook.md)   | A component catalogue with Astrobook                                 | Accepted |

## Writing one

Copy [template.md](template.md) to the next number, with a short name in the file name. Open it in
the same pull request as the change it records, or before the change if the decision needs agreeing
first. Link the pull request in the record.
