# craga.dev

Personal site and CV of Craig Michael Thompson, served by GitHub Pages at <https://craga.dev>.

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

## Search engines

While the content is being finished, the build keeps the site out of search engines: `robots.txt` disallows everything and every page carries `<meta name="robots" content="noindex">`. When it's ready to be found, build with `node tools/build.mjs --public` (or set `ALLOW_INDEXING` to `true` in `tools/build.mjs`) and push.
