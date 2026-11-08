# 0002. A static Astro site, with a hash-only Content-Security-Policy

- **Status:** Accepted
- **Date:** 2026-10-24
- **Commits:** e940a6d ("Move the site to Astro")

## Context

The site started as hand-written HTML. As it grew (case studies, the CV, file pages, a blog), the
same markup was repeated across pages, and content was mixed with layout. It has no logged-in users
and nothing per visitor, so every page can be built ahead of time.

## Decision

Build the site with Astro into static HTML (`site/`): content in Markdown and MDX content
collections, components with scoped styles, and TypeScript modules for page behaviour. Every page
gets a Content-Security-Policy from Astro's `security.csp`, with hashes for its own inline scripts
and styles and no `'unsafe-inline'`.

## Options considered

- **Astro, static output.** Components and content collections without shipping a framework to the
  browser; per-page CSP hashes built in.
- **Hand-written HTML, as before.** No build step, but repeated markup and no checked content.

## Consequences

- Pages are plain files any host can serve, and fast without a server.
- The CSP means injected markup can't run script. Anything that adds inline code must be hashed
  (see `astro.config.mjs` and `src/scripts/inline.mjs`); [0008](0008-component-catalogue-with-astrobook.md)
  had to work around this for the component catalogue.
- Anything per visitor (ask.sh, visit counts) needs a separate service:
  [0005](0005-ask-sh-within-the-free-ai-allowance.md), [0006](0006-anonymous-analytics.md).
