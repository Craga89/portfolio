# craigthompson.dev

Personal site and CV of Craig Michael Thompson, served by GitHub Pages at <https://craigthompson.dev>.

## Layout

- `src/` holds the design files exported from the design canvas: `ThemeTyne.dc.html` (the home page), `CV.dc.html` (the plain CV), plus `cv.json` (JSON Resume) and `portrait.webp`.
- `tools/dc-runtime.js` is a small runtime that runs the design files as an ordinary web page: it fills the template, handles clicks and typing, and patches the page in place when state changes.
- `tools/build.mjs` turns `src/` into the static site in `site/`. It prerenders the home page in Chromium, so search engines, ATS tools and people without JavaScript get the full content in the HTML.
- `tools/check.mjs` loads the built site in Chromium, exercises the interactive parts and saves screenshots to `shots/`.
- `site/` is what gets published. It's committed, so deploys don't need a build step.

## Updating the site

```sh
npm install
npx playwright install chromium
# replace the files in src/ with new exports, then
npm run build
npm run check
git add -A && git commit -m "Update site" && git push
```

Every push to `main` deploys `site/` through `.github/workflows/pages.yml`.

## Performance

- Fonts are self-hosted from `src/fonts/` (fetched once from Google Fonts by `.github/workflows/fetch-fonts.yml`). The build inlines the `@font-face` rules, preloads the three used for first paint, and adds size-matched system fallbacks so text doesn't move when the web fonts arrive.
- The home page HTML holds the prerendered content and the CSS. The runtime, template and component code go in one deferred, content-hashed `assets/app.<hash>.js`.
- The portrait is served as AVIF/WebP at the sizes it's shown. The build also renders the social preview card (`og.png`) and the home-screen icon.
- `.github/workflows/lighthouse.yml` runs Lighthouse (3 runs each, mobile and desktop) after every Pages deploy and saves a summary to the `lighthouse` branch (`reports/summary.json`).

## Accessibility (WCAG 2.2 AA)

`npm run a11y` (`tools/a11y.mjs`) checks the built site against WCAG 2.2 AA:

- axe-core (vendored in `tools/vendor/`, refreshed by `.github/workflows/vendor-axe.yml`) with every WCAG 2.0, 2.1 and 2.2 A/AA rule. It runs in both themes, at desktop and mobile widths, on every responsibilities and case-study tab, with the FAQ open, in stack search, in ask.sh and the chat with an answer, and on the plain CV and 404 pages.
- Checks automated rule engines can't make: a keyboard-only walk through the whole page with a visible focus indicator at every stop (2.4.7), nothing focused hidden behind the sticky header or chat bar (2.4.11), reflow at 320px (1.4.10), text spacing (1.4.12), reduced motion and a pause control for the auto-playing tour (2.2.2, 2.3.3).

`.github/workflows/accessibility.yml` runs it after every Pages deploy and every Monday, saves the report to the `accessibility` branch (`reports/latest.txt`), and fails the run if anything doesn't pass. Pass `--url https://craigthompson.dev/` to test the live site instead.

Automated checks can't cover all of WCAG; screen reader passes (VoiceOver, NVDA) are still worth doing after big content or layout changes.

## Search engines

While the content is being finished, the build keeps the site out of search engines: `robots.txt` disallows everything and every page carries `<meta name="robots" content="noindex">`. When it's ready to be found, build with `node tools/build.mjs --public` (or set `ALLOW_INDEXING` to `true` in `tools/build.mjs`) and push.

## ask.sh

The `ask.sh` section at the bottom of the home page answers questions about the CV.

- The build extracts the page's text into passages: `site/assets/ask-index.json` for the page and `worker/knowledge.json` for the Worker. Rebuilding after a content change keeps both in step.
- `worker/` is a Cloudflare Worker that runs on Workers AI's free daily allowance. It picks the passages that best match the question and asks the model to answer only from those. When the allowance is used up it fails rather than charging, and the page falls back to its own search over the same passages. It tries Gemma 4 26B first, then Qwen3 30B, then Llama 3.1 8B. It only accepts requests from craigthompson.dev (and craga.dev while that redirects), craga89.github.io and localhost, and it allows each visitor 8 questions a minute.
- `ask.config.json` holds the Worker URL. When it's empty, ask.sh works as search only.

Deploying the Worker:

1. Create a free Cloudflare account and an API token from the **Edit Cloudflare Workers** template (it covers Workers AI).
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Pushing a change under `worker/` (or running the workflow by hand) then deploys it through `.github/workflows/ask-worker.yml`. You can also run `cd worker && npx wrangler deploy`.
3. Put the Worker URL in `ask.config.json`, for example `{ "endpoint": "https://craga-ask.<subdomain>.workers.dev/ask" }`, then rebuild and push.

Test the Worker without Cloudflare with `node worker/test/worker.test.mjs`.
