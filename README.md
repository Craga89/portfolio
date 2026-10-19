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

## Extras

- **Downloads:** the build prints the plain CV to `cv.pdf` (Chromium, the CV's own print styles) and writes a `craig-thompson.vcf` contact card. Both are linked from the sidebar, the mobile links and the CV page.
- **Text files:** `llms.txt` (a summary for AI assistants, built from `cv.json`), `humans.txt` and `.well-known/security.txt`.
- **Offline:** `sw.js` makes pages network-first and assets cache-first, so return visits are instant and the site works offline. It only registers over https.
- **Version stamp:** the sidebar shows `main@<commit> · 3 days ago`, with the full date on hover. The Pages workflow fills in the commit and its time at deploy; local builds show the placeholder.
- **Command palette:** Ctrl/⌘+K (or the button by EXPLORER) searches sections, every responsibilities and case-study file, the FAQ and actions (copy email, cv.pdf, theme, animations…); anything else becomes an ask.sh question. `/` and `?` are single-key shortcuts, which the shortcuts dialog can turn off (WCAG 2.1.4). Both are native modal `<dialog>`s.
- **Section links:** the `#` beside each section heading copies a link to that section.
- **Plain CV themes:** `/cv/` follows the same saved theme as the home page (or the system setting), has its own toggle, and always prints and exports light.
- **Landing flash:** an in-page link briefly highlights where it lands (the section heading, or the item itself) once the scroll ends.
- **File pages:** every case study and responsibility also builds as its own static page (`/case-studies/<file>/`, `/responsibilities/<file>/`) with its own title, description, JSON-LD, social preview image (`og.png`, rendered at build time) and sitemap entry, plus previous/next, the folder listing, a glossary of the jargon used, and a link back into the portfolio (`/?case=<id>#case-studies`, `/?resp=<id>#responsibilities`). The home page links to the open file's page under each carousel.
- **Focus links:** `/?focus=leadership`, `platform`, `ai` or `frontend` adds a suggested reading order under the intro (and opens the most relevant tabs), for sending a tailored link. Also in the command palette. "show everything" removes it.
- **Read aloud:** every ask.sh and chat answer has a "listen" button. The Worker's `/speak` turns the answer into speech with Deepgram Aura on Workers AI (a British voice, Aura-2 then Aura-1, then MeloTTS), with file names read as words; the page plays it through Web Audio, and falls back to the browser's own best English voice. A question asked by voice gets its answer read back automatically. Rate-limited to 12 a minute per visitor; nothing is logged.
- **Easter egg:** ↑↑↓↓←→←→BA, or `bridge` in ask.sh.
- **Mobile menu:** below 600px wide (or on short landscape screens) the header is the site name, a get in touch button and a menu button. The menu is a `<details>`, so it opens without JavaScript; it lists every section (marking the current one), with search and the theme switch, and closes on a jump, Escape or a tap outside.
- **Get in touch:** a contact section at the bottom (`#contact`, get-in-touch.md in the sidebar) that every get-in-touch button links to: email with a copy button, links, cv.pdf, contact card, and what roles and working pattern Craig is looking for.
- **Transitions:** tab and file switches cross-fade with the View Transitions API; the chat panel, toggletips and dialogs ease in with `@starting-style`. All of it is skipped with reduced motion or "pause animations".
- **Swipe:** on touch screens, swiping sideways on the responsibilities tour or a case study moves to the next or previous one (the buttons and tabs still work). Vertical scrolling is untouched, and wide tables inside still scroll sideways. Next/previous slide the panel in that direction.
- **Instant CV:** speculation rules prerender `/cv/` when you hover its link (and the home page from the CV).
- **Share:** on phones, a share link opens the native share sheet.
- **Typography and modes:** balanced headings, `text-wrap: pretty` paragraphs, themed selection and scrollbars, tuned styles for Windows High Contrast (`forced-colors`) and `prefers-contrast: more`.
- **ask.sh:** shell commands (`help`, `ls`, `cat <file>`, `whoami`, `clear`…) are answered locally. Every answer has a "copy link", and `/?ask=…` opens the page with that question answered.
- **Jargon toggletips:** buttons on technical terms open a definition in a shared popover. CSS anchor positioning places it, and a few lines of JS take over in browsers without it.
- **Print:** the home page prints as a light, single-column document with every tab and FAQ answer laid out, controls hidden and outbound link URLs shown.
- **Console:** opening DevTools shows a greeting, and `ask("…")` queries ask.sh from the console.

## Live results on the site (live.json)

The Pages deploy (on every push, and daily) collects the latest CI results from their report branches into `site/live.json` (`tools/live.mjs`): Lighthouse scores (`lighthouse`), the WCAG suite (`accessibility`), the ask.sh answer tests with each answer (`evals`, from `.github/workflows/evals.yml`) and the open-source counts (`oss`, from `.github/workflows/oss-stats.yml`, weekly via the GitHub API). The page fetches it once it's idle and shows it in the sidebar, the `this-site.md` case study, the open-source section and "how ask.sh is tested"; until then (or offline, or locally) it shows static fallbacks. The service worker always fetches `live.json` from the network first.

### Costs: designed to be free

Nothing on the site needs a paid plan. The services and their free limits:

| Service | Used for | Free limit | Over the limit |
|---|---|---|---|
| GitHub Pages and Actions | hosting, CI | free for public repositories | — |
| Cloudflare Workers (Free plan) | ask.sh, read-aloud, MCP, visit counts | 100,000 requests a day | requests fail until midnight UTC |
| Workers AI | ask.sh answers, read-aloud voice | 10,000 neurons a day | Free plan: requests fail; Paid plan: billed |
| D1 | question log, visit counts, AI budget | 5M rows read, 100k written a day | queries fail until midnight UTC |
| Cloudflare Web Analytics | page views | free | — |
| The browser's built-in AI (Translator, Language Detector) | translation, ask.sh in other languages | runs on the visitor's device | — |

On the Workers Free plan nothing can be billed: going over a limit makes requests fail, and every AI feature falls back (search answers, the browser's own voice). Keep the account on the Free plan to keep it that way.

On top of that, `worker/src/budget.js` keeps Workers AI inside the free allowance on any plan. Spending is recorded per UTC day in D1 (`ai_budget`), split into shares so one feature can't use up another's:

| Share | Neurons a day | Roughly |
|---|---|---|
| `ask`: visitors' ask.sh answers (site, WebMCP, MCP) | 6,000 | ~140 answers (~40 neurons each on Gemma 4) |
| `speak`: read-aloud in the natural voice | 2,500 | a few answers (Aura 2 is ~2.7 neurons a character); then the browser's voice, which is free |
| `test`: CI smoke tests and answer tests | 1,000 | about one full test run |

When a share is used up the Worker answers 503 `{"error":"budget"}`: ask.sh says it's used today's free allowance and answers from the site's search, and read-aloud uses the browser's voice. If Workers AI reports the account's free allocation is used up, every share closes for the day. If D1 can't be read, AI is off rather than unmetered. Shares can be changed with `AI_CAP_ASK`, `AI_CAP_SPEAK` and `AI_CAP_TEST` variables. The weekly stats show spending per share.

To keep CI's share small, the answer tests run after a Worker deploy only when the worker's code, prompt, shared search or test cases changed (content-only deploys skip them), and the smoke test's voice check reads a short phrase.

The natural voice plays at 1.15× with its pitch kept (an audio element with `preservesPitch`); the browser's voice reads at 1.1×.

### On-device translation

Visitors whose browser prefers another language (38 are supported, Arabic and Hebrew right-to-left) are offered the site in it, using the browser's built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api) (Chrome and Edge on desktop). The language model runs on the visitor's computer: nothing is sent anywhere. Anyone else can pick a language from the menu next to "pause animations" (and on the plain CV). Browsers without the API see no change.

- **Loading:** a small boot snippet on every page decides whether to offer a language (the visitor's first preferred language is supported and isn't English), or to start straight away (they chose one before). Only then does it load `src/i18n.js` (built to `/assets/i18n.<hash>.js`). The offer is written in each language in `src/i18n.js`, since no model is on the device yet; "No thanks" is remembered.
- **Translation units:** text is grouped into units (a paragraph, a list item, a button). Inline markup becomes numbered tokens (`{0}text{/0}`), so whole sentences are translated and the markup goes back round the right words. If the tokens don't come back intact, each run of text is translated on its own instead. The name, email addresses, domains and file names are protected tokens, and elements marked `translate="no"` (file links, commands, the sidebar's file names, code) are left alone. That attribute also helps the browser's own page translation. Attributes (`aria-label`, `title`, `placeholder`, `alt`) and the page title are translated too.
- **The home page** is rendered by the design runtime, which re-renders from its English template. So translation is a render step (`app.transform` in `tools/dc-runtime.js`): each render is translated from the cache before it's patched in, and nothing flickers back to English. Visible text is translated first, then the rest in the background. Static pages (the CV, the file pages) are translated in place, and "Show original" puts the stashed English back.
- **Saying it's machine translation:** the offer, the banner and the sidebar all say the page is translated by the browser, not by a person. The offer and banner use a note written for each language in `src/i18n.js` (so the disclaimer itself isn't machine-translated), and the banner's info button opens a popover (Popover API, placed with CSS anchor positioning) explaining what that means. The sidebar's language menu shows "machine translation" while a language is on, and an ask.sh answer translated back from English says so.
- **The browser's own page translation** (Chrome's "Translate this page") also survives: the runtime patches only what changed between its own renders, so it doesn't undo text that the browser swapped in.
- **Caching:** translations are kept per language in the visitor's browser (`localStorage`), so returning visits and tab switches are instant.
- **Language and direction:** the page gets `lang` (and `dir="rtl"` for Arabic and Hebrew); text not translated yet is marked `lang="en"` so screen readers pronounce it right. Arrows in running text are swapped in right-to-left languages; diagrams are mirrored by CSS. The CSS uses logical properties throughout (`margin-inline-start`, `inset-inline-end`, `padding-inline` and so on), so the layout mirrors. Charts and commands stay left-to-right.
- **ask.sh in other languages:** a question in another language is detected (Language Detector API), translated to English on the device, answered as usual, and the answer translated back (unless the whole page is already in that language). Read-aloud uses the browser's voice for that language.
- **Stats:** the anonymous visit beacon records the translated language and what the visitor did with the offer (`lang`, `offer` in D1); the weekly stats show both.
- **Tests:** CI has no language models, so `tools/translator-stub.mjs` stands in for the API. `tools/check.mjs` covers the offer, full-page translation with names and files kept, the machine-translation notices, no flicker, the token fallback, tabs, ask.sh in German, "Show original", returning visitors, "No thanks", Arabic right-to-left with no sideways scroll, and the CV. `tools/a11y.mjs` runs axe on the offer, the banner and translated pages in German and Arabic.

### Agent tools: WebMCP and MCP

The site's content is available to AI agents as tools, in two places, from one definition:

- **`shared/agent-tools.js`** defines the tools (`get_profile`, `get_career`, `list_files`, `read_file`, `search_site`, `ask`, `get_open_source`, `get_site_report`, and the page-only `show_section`), their JSON Schemas and argument checks, and the site's keyword search (tokens, synonyms, ranking). Each surface passes a small "source" saying where the data comes from. The page build bundles the file as `window.CragaAgent`; the worker imports it. ask.sh's search on the page, the worker's choice of context for the model, and the `search_site` tool all use the same ranking, so they can't drift apart (the old copies had).
- **WebMCP (the page).** Where the browser supports [WebMCP](https://webmachinelearning.github.io/webmcp/) (`document.modelContext`, or `navigator.modelContext` before Chrome 150), the home page registers the tools once it's idle, reading what the page already loads (`cv.json`, the ask.sh index, `live.json`). `read_file` can also open the file on screen. They unregister on `pagehide` through an `AbortSignal`. Browsers without the API skip it.
- **MCP (the worker).** `POST https://craga-ask.craga89.workers.dev/mcp` is a public, read-only MCP server (Streamable HTTP, JSON responses, no sessions). It serves both protocol eras on one endpoint: **2026-07-28** (no handshake; `server/discover`; the version in each request's `_meta`, mirrored in `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers, which are checked) and **2025-11-25 and earlier** (`initialize`, `ping`, batches for 2025-03-26). Data: the passages and CV bundled at deploy (`worker/knowledge.json`, `worker/agent-data.json`, both written by the build), and `live.json` fetched from `SITE_URL` (cached 5 minutes). Limits: 60 requests a minute per client (`MCP_LIMITER`), and `ask` calls share ask.sh's limit. Browsers may only call it from the site's own origins. Questions asked through it are logged anonymously with `via = 'mcp'` (`'webmcp'` from the page's tools).
- To use it: add `https://craga-ask.craga89.workers.dev/mcp` as a custom connector (Claude, ChatGPT) or a remote MCP server (Cursor, VS Code, Claude Code: `claude mcp add --transport http craigthompson https://craga-ask.craga89.workers.dev/mcp`).

Tests: `tools/check.mjs` runs the page's tools against a stand-in `modelContext` (the `ask` call is stubbed so tests never reach the real service). `worker/test/worker.test.mjs` covers the MCP endpoint in both eras: header checks, version errors, origins, rate limits, tool errors and logging. After each worker deploy, CI calls the live `/mcp` with curl in both eras and with the official MCP TypeScript SDK client (`worker/test/mcp-client.mjs`).

In Chrome 149–156 WebMCP is an origin trial. Tokens live in `src/origin-trials.txt`, one per line. The build reads the origin out of each token (and drops expired ones), and the app bundle adds the token for the origin it's served from as a `<meta http-equiv="origin-trial">` before the tools register. They're added by the bundle, not written into the HTML, because tokens registered for third-party matching only count when an external script on their origin adds them. To try it without a token, enable `chrome://flags/#enable-webmcp-testing`.

The `webmcp.md` case study explains the tools, shows the MCP server address, and shows whether the visitor's browser has WebMCP; its file page leaves out the parts that need JavaScript.

The open-source section has a heatmap of merged pull requests to other projects by year and quarter. `tools/oss-stats.mjs` writes the per-quarter `timeline` (count and repos); the build bakes the latest snapshot into the page (`window.CRAGA_OSS`) so it prerenders, and `live.json` replaces it when newer. It uses one blue ramp per theme (checked for contrast and colour-blind separation), hover tips per cell, and a "as a table" view for screen readers and print.

## Visits and questions (anonymous)

- **Cloudflare Web Analytics** (cookieless) runs on the home page and CV, only on craigthompson.dev, and not for Do Not Track or Global Privacy Control. It loads on the first interaction (scroll, tap, key) or 6s after the page has loaded, so it never competes with the page for the network. The token is in `tools/build.mjs` (`CF_ANALYTICS_TOKEN`); the dashboard is Cloudflare → Analytics & Logs → Web Analytics.

- The Worker keeps two tables in the D1 database `craga-ask` (schema in `worker/schema.sql`). `questions` holds each ask.sh question, whether it was answered, the model and the sources. `visits` holds one row per page view: path, referring site, country, device class, sections seen and seconds on the page. No IP addresses, cookies or user agents are stored. Bots, CI traffic (`x-craga-test: 1`) and Do Not Track / Global Privacy Control visitors are skipped. The page says so in ask.sh, the chat and the FAQ.
- `.github/workflows/stats.yml` writes a weekly summary to its run page: visits, referrers, how far people read, devices, countries, and the questions ask.sh couldn't answer (FAQ candidates). You can also query the tables in the Cloudflare dashboard (D1 → craga-ask → Console).

## Quality checks in CI

- **ask.sh evals** (`worker/evals.json`, `tools/ask-evals.mjs`, `.github/workflows/evals.yml`): after every Worker deploy and weekly, known questions must get answers with the right facts, no invented ones, no salary figures, and no response to prompt injection. Results (with the answers) are saved to the `evals` branch and shown on the site.
- **Lighthouse thresholds:** performance at least 95 and accessibility and best practices at 100 on mobile and desktop. SEO counts once the site is open to search engines.
- **Screenshot comparison** (`tools/visual.mjs`, `.github/workflows/visual.yml`): 11 views compared against baselines on the `visual-baselines` branch. Put `[visual]` in a commit message to accept an intended change.
- **Link check** (`.github/workflows/links.yml`): every outbound link, weekly.

## Accessibility (WCAG 2.2 AA)

`npm run a11y` (`tools/a11y.mjs`) checks the built site against WCAG 2.2 AA:

- axe-core (vendored in `tools/vendor/`, refreshed by `.github/workflows/vendor-axe.yml`) with every WCAG 2.0, 2.1 and 2.2 A/AA rule. It runs in both themes, at desktop and mobile widths, on every responsibilities and case-study tab, with the FAQ open, in stack search, in ask.sh and the chat with an answer, in the command palette and shortcuts dialog, and on the plain CV, the 404 page and every file page.
- Checks automated rule engines can't make: a keyboard-only walk through the whole page with a visible focus indicator at every stop (2.4.7), nothing focused hidden behind the sticky header or chat bar (2.4.11), reflow at 320px (1.4.10), text spacing (1.4.12), reduced motion and a pause control for the auto-playing tour (2.2.2, 2.3.3), and an off switch for single-key shortcuts (2.1.4).

`.github/workflows/accessibility.yml` runs it after every Pages deploy and every Monday, saves the report to the `accessibility` branch (`reports/latest.txt`), and fails the run if anything doesn't pass. Pass `--url https://craigthompson.dev/` to test the live site instead.

Automated checks can't cover all of WCAG; screen reader passes (VoiceOver, NVDA) are still worth doing after big content or layout changes.

## Search engines

While the content is being finished, the build keeps the site out of search engines: `robots.txt` disallows everything and every page carries `<meta name="robots" content="noindex">`. When it's ready to be found, build with `node tools/build.mjs --public` (or set `ALLOW_INDEXING` to `true` in `tools/build.mjs`) and push.

## ask.sh

The `ask.sh` section at the bottom of the home page answers questions about the CV.

- The build extracts the page's text into passages: `site/assets/ask-index.json` for the page and `worker/knowledge.json` for the Worker. Rebuilding after a content change keeps both in step.
- `worker/` is a Cloudflare Worker that runs on Workers AI's free daily allowance. It picks the passages that best match the question and asks the model to answer only from those. When the allowance is used up it fails rather than charging, and the page falls back to its own search over the same passages. It tries Gemma 4 26B first, then Qwen3 30B, then Llama 3.1 8B. It only accepts requests from craigthompson.dev, craga89.github.io and localhost, and it allows each visitor 8 questions a minute.
- `ask.config.json` holds the Worker URL. When it's empty, ask.sh works as search only.

Deploying the Worker:

1. Create a free Cloudflare account and an API token from the **Edit Cloudflare Workers** template (it covers Workers AI).
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. Pushing a change under `worker/` (or running the workflow by hand) then deploys it through `.github/workflows/ask-worker.yml`. You can also run `cd worker && npx wrangler deploy`.
3. Put the Worker URL in `ask.config.json`, for example `{ "endpoint": "https://craga-ask.<subdomain>.workers.dev/ask" }`, then rebuild and push.

Test the Worker without Cloudflare with `node worker/test/worker.test.mjs`.
