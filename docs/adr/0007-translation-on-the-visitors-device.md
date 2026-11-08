# 0007. Translation on the visitor's device

- **Status:** Accepted
- **Date:** 2026-10-18

## Context

Some visitors read English as a second language. Translating every page ahead of time means
keeping translations up to date with each content change, and a translation service costs money
and sends the page to a third party.

## Decision

Offer translation with the browser's built-in AI (the Translator and Language Detector APIs), on
the visitor's device. The static page is translated in place, says it's machine translation, and
"Show original" puts the English back. Names, email addresses, domains and file names are protected.
Browsers without the APIs don't see the offer.

## Options considered

- **The browser's on-device translation.** Free, private, and always matches the current content.
- **Translations written for each language.** Better quality, but a maintenance cost on every change.
- **A translation API.** Wide support, but a cost and a third party seeing the content.

## Consequences

- Only browsers with the APIs (Chromium-based, today) get the offer; others can use the browser's
  own page translation.
- Quality is machine translation, and the page says so. CI has no language models, so tests use a
  stand-in (`tools/translator-stub.mjs`).
