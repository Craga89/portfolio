# 0004. Host on Cloudflare Workers static assets, not GitHub Pages

- **Status:** Accepted
- **Date:** 2026-11-04
- **Pull requests:** #36, #37, #38, #41, #42

## Context

GitHub Pages served the site, with branch previews under `/preview/<branch>/` on the same site. It
can't set response headers, previews shared the live site's origin, and the ask.sh service was
already on Cloudflare. Craga89/standards' hosting guideline proposed piloting Cloudflare first.

## Decision

Serve craigthompson.dev from the `portfolio` Worker with static assets (`cloudflare/wrangler.jsonc`),
deployed by CI after every check passes. Every other branch gets a Cloudflare Preview at its own
address, behind Cloudflare Access and marked `noindex`. GitHub Pages is retired.

It was piloted alongside GitHub Pages first (#36), then switched over once the pilot served the
same site.

## Options considered

- **Cloudflare Workers static assets.** Response headers (`cloudflare/_headers`), previews on their
  own origins, private previews with Access, and the same account as ask.sh; free at this traffic.
- **GitHub Pages.** No setup, but no headers, and previews on the live origin.

## Consequences

- Security headers and `noindex` on previews are possible, and previews can't affect the live site.
- Deploys need Cloudflare credentials in CI, and the required check keeps its old name, "Deploy to
  GitHub Pages", until the ruleset changes.
- Cloudflare Web Analytics is added to pages automatically ([0006](0006-anonymous-analytics.md)).
