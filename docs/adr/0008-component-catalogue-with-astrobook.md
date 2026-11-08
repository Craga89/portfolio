# 0008. A component catalogue with Astrobook

- **Status:** Accepted
- **Date:** 2026-11-08
- **Pull requests:** #46, #47

## Context

The site has around 90 Astro components, many only seen deep inside a case study. There was no
place to see each one on its own, review a change to one, or test one in isolation.

## Decision

Build a catalogue of every component with Astrobook, into the site at `/storybook/`, with a story
per component in Storybook's format (CSF) and the site's own styles. Components that take content
show their first use in `src/content` (`tools/stories.mjs`). The catalogue is `noindex` and out
of the sitemap.

#47 then tests each story on its own: an axe audit and a comparison with an approved screenshot,
in both themes.

## Options considered

- **Astrobook.** Renders Astro components natively, builds with the site, needs no separate server.
  Props only, no slots, hence the content examples.
- **Storybook with a community Astro renderer.** The familiar UI and add-ons, but Storybook has no
  official Astro support, and the renderer lagged Storybook's releases.
- **No catalogue.** Components stay visible only in context.

## Consequences

- Each component can be seen, reviewed and tested on its own, and a test fails if one has no story.
- Astrobook's UI needs inline styles, so catalogue pages allow `'unsafe-inline'` for styles (only);
  their scripts stay hash-only (`tools/lib/catalogue.mjs`). Serving the catalogue from its own
  origin would remove that exception.
- If Storybook gains official Astro support, it's worth revisiting.
