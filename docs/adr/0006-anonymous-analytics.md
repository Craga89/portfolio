# 0006. Anonymous analytics, with no cookies or identifiers

- **Status:** Accepted
- **Date:** 2026-10-17

## Context

Knowing which pages are read, how far, and what ask.sh can't answer helps improve the site. Most
analytics tools set cookies or fingerprint visitors, which would need a consent banner and isn't
needed for these questions.

## Decision

- **Cloudflare Web Analytics** for page views and Core Web Vitals. It's cookieless, and Cloudflare
  adds its beacon to each page as it serves it.
- **The site's own visit counts**, in the ask.sh Worker's D1 database: one beacon as a visitor
  leaves, with the page, referring site, country, device class, sections seen and time on the page.
  No IP addresses, cookies or user agents are stored. Do Not Track, Global Privacy Control, bots,
  CI and previews are skipped.
- A weekly report (`.github/workflows/stats.yml`) summarises both.

## Options considered

- **Cookieless analytics plus our own counts.** Answers the questions without a consent banner.
- **A full analytics product with cookies.** More detail, but needs consent and tracks people.
- **No analytics.** Private, but no way to tell what works.

## Consequences

- No consent banner, and the page says what's collected (in ask.sh, the chat and the FAQ).
- Figures are approximate: visitors who opt out, block the beacon or leave without the beacon firing
  aren't counted.
