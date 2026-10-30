# craigthompson.dev

Personal site and CV of Craig Thompson, served by GitHub Pages at <https://craigthompson.dev>.

## Layout

- `src/` is an [Astro](https://astro.build) site, built to static HTML:
  - `content/`: the words. One file per case study, role in the career log and blog post (Markdown and MDX) and per responsibility (YAML), plus the intro, FAQ, recognition, education and the plain CV (`content/sections/`). `content.config.ts` checks each file at build time.
  - `data/`: the lists (stack, projects, focus views, recommendations, the glossary) as YAML.
  - `components/`: `content/` are the pieces MDX files use (steps, chains, stats, toggletip terms…), `figures/` the diagrams in the case studies, `sections/` the home page's sections, `files/` the responsibility and case-study cards, `home/` and `page/` the page furniture.
  - `layouts/`, `pages/` (the home page, the file pages, the blog, the CV, the 404 page, and the text, JSON, vCard and icon endpoints), `lib/` (build-time helpers), `scripts/` (the page's TypeScript, one module per behaviour) and `styles/` (the shared tokens and base styles; each component has its own scoped styles).
  - `cv.json` (JSON Resume) and `i18n.js` (on-device translation, loaded only when it's used).
  - There are no inline styles: state is shown with attributes (`data-*`, `aria-*`) and component CSS, and the few values only known at run time are set through the CSSOM.
- `shared/` is code used by both the page and the worker: the agent tools and search (`agent-tools.js`), the translated languages (`langs.js`), and type declarations for browser APIs TypeScript doesn't describe yet (`globals.d.ts`).
- `astro.config.mjs` builds `src/` into `site/`, with a Content-Security-Policy (hashes for the two inline scripts) on every page. `integrations/` holds the build's own steps: `markdown.mjs` (code blocks) and `post-build.mjs`, which opens the finished site in Chromium to write ask.sh's search index and the worker's data, the social preview images, `cv.pdf` and the service worker.
- `tools/` holds the scripts CI runs (stats, live results, evals, redirects, fonts, the blog import). `tools/lib/` holds modules they share (the static server, the redirect rules, the blog posts' front matter).
- `worker/` is the ask.sh Cloudflare Worker (see below).
- `tests/` holds the tests: `unit/` (Node's test runner), `e2e/`, `a11y/` and `visual/` (Playwright), and `smoke/` (the deployed worker).
- `site/` and the worker's data (`worker/knowledge.json`, `worker/agent-data.json`) are build output. CI builds them; they aren't committed.

## Development

Node 22 (see `.node-version`) and pnpm (the version in `package.json`'s `packageManager`; `corepack enable` sets it up).

```sh
pnpm install
pnpm exec playwright install chromium
pnpm run dev           # Astro's dev server, with live reload
pnpm run build         # src/ → site/
pnpm run serve         # site/ at http://127.0.0.1:4173/
pnpm run verify        # lint, format check, type check and unit tests
pnpm run test:e2e      # end-to-end tests on a desktop and a phone
pnpm run test:a11y     # the WCAG 2.2 AA suite
pnpm run test:visual   # screenshots against the baselines
```

- **Lint and format:** [oxlint](https://oxc.rs/docs/guide/usage/linter) (`.oxlintrc.json`) and [oxfmt](https://oxc.rs/docs/guide/usage/formatter) (`.oxfmtrc.json`); `pnpm run format` rewrites files. `.editorconfig` sets the basics for editors.
- **Types:** the page's scripts are TypeScript, and the rest is JavaScript type-checked from its JSDoc (`checkJs`), in three projects for the three places code runs: `tsconfig.json` (the site, strict, checked by `astro check` along with the `.astro` files), `tsconfig.worker.json` (the Workers runtime, strict; its bindings are typed in `worker/src/env.d.ts`) and `tsconfig.node.json` (the tools and tests). Type-checking needs a build first, since the worker imports the passages the build writes.
- **Unit tests** (`tests/unit/`, mirroring the source tree) run on Node's own test runner with coverage, and fail under 95% of lines, 80% of branches or 90% of functions in `worker/src/`, `shared/` and `tools/lib/`. Code that needs a browser (the page's scripts, `src/i18n.js` beyond its pure functions) is covered by the end-to-end tests instead.
- **Playwright** (`playwright.config.mjs`) serves `site/` itself. Its projects: `desktop` and `mobile` (a Pixel 7) for behaviour, where a test tagged `@desktop` or `@mobile` runs on that one only; `a11y-desktop` and `a11y-mobile`; and `visual`. Shared fixtures (`tests/fixtures.mjs`) keep every test off the network (ask.sh's answers come from stand-ins the test sets), fail a test on any page error, and offer a stand-in for the browser's Translator API. Set `BASE_URL` to test a deployed site instead.

## CI and deploys

`.github/workflows/ci.yml` runs on every push and pull request:

- **lint** (oxlint, oxfmt) and **build** (`build.yml`, a reusable workflow that uploads `site/` and the worker's data as the `build` artifact), side by side;
- on that build: **types and unit tests**, **end-to-end** tests on each project, the **WCAG suite** in four shards (merged into one report), and the **screenshot** comparison;
- on `main`, once lint, unit, end-to-end and WCAG pass: **deploy** to GitHub Pages (the live site, with `live.json` and the commit stamped in, is stored on the `pages` branch, then Craga89/standards' `pages-deploy.yml` publishes it), and **deploy the worker**, then its smoke tests (`tests/smoke/`). Those ask real questions only when the worker's code changed, to save the day's AI allowance.

**Branch previews.** Every push to another branch is built under `/preview/<branch>-<hash>/` (the branch name lowercased with anything other than letters and digits as `-`, then six characters of a hash of the exact name, so branches that read alike never share a folder) and published there within a few minutes, without waiting for the tests. The flow comes from [Craga89/standards](https://github.com/Craga89/standards) (`guidelines/previews.md`): `.github/workflows/preview.yml` builds and stores it, `preview-deploy.yml` publishes it, and the commit's **Preview** status links to it: pending while it builds, then green with the address once it's live (red if either step fails; every publish marks all the previews it carries, so none is left pending). The pull request gets one comment with the link (from `preview.yml`, or `preview-comment.yml` when the pull request is opened after the push), never repeated. It's usually live about two minutes after the push. Deleting the branch removes its preview, and previews of branches that are gone are pruned on every update; <https://craigthompson.dev/preview/> lists them. Previews are `noindex`, don't count visits and don't register the service worker. Pages serves one site, so the live site and the previews are kept together on the `pages` branch (the live site at the root, previews under `preview/`, one commit that each change replaces; neither ever overwrites the other), and every deploy, of main or of a preview, publishes all of it. The base path comes from `PREVIEW_BASE` (`astro.config.mjs`); links in components go through `url()` (`src/lib/url.ts`) and links in Markdown through the `baseLinks` plugin (`integrations/markdown.mjs`). Try one locally with `PREVIEW_BASE=/preview/test/ pnpm run build`, then `node tools/lib/serve.mjs site 4173 /preview/test/`.

It also runs daily, so `live.json` picks up the latest results. Report branches (`accessibility`, `lighthouse`, `evals`, `indexnow`, `oss`, `visual-baselines`, `redirect-data`, `blog-import`; they get no preview) are written by Craga89/standards' `publish-branch` and `report-meta`. pnpm, Node and Chromium are set up by its `setup-node` and `setup-playwright` (cached). Actions, Craga89/standards included, are pinned to commit SHAs, and Dependabot (`.github/dependabot.yml`) proposes updates weekly. `.github/workflows/bootstrap.yml` (run by hand) refreshes `pnpm-lock.yaml` and applies the formatter.

## Performance

- Fonts are self-hosted from `src/assets/fonts/` (fetched once from Google Fonts by `.github/workflows/fetch-fonts.yml`), with the `@font-face` rules in `src/styles/fonts.css`. Pages preload the ones used for first paint, and size-matched system fallbacks keep text from moving when the web fonts arrive.
- Every page is static HTML with all its content. Scripts and styles are content-hashed modules in `assets/`; the home page's script, the command palette and translation each load only on the pages, or at the moment, they're needed.
- The portrait is served as AVIF/WebP at the sizes it's shown. The build also renders the social preview card (`og.png`) and the home-screen icon.
- `.github/workflows/lighthouse.yml` runs Lighthouse (3 runs each, mobile and desktop) after every deploy and saves a summary to the `lighthouse` branch (`reports/summary.json`).

## Extras

- **Downloads:** the build prints the plain CV to `cv.pdf` (Chromium, the CV's own print styles) and writes a `craig-thompson.vcf` contact card. Both are linked from the sidebar, the mobile links and the CV page.
- **Text files:** `llms.txt` (a summary for AI assistants, built from `cv.json`), `humans.txt` and `.well-known/security.txt`.
- **Offline:** `sw.js` makes pages network-first and assets cache-first, so return visits are instant and the site works offline. It only registers over https.
- **Version stamp:** the sidebar shows `main@<commit> · 3 days ago`, with the full date on hover. The Pages workflow fills in the commit and its time at deploy; local builds show the placeholder.
- **Command palette:** Ctrl/⌘+K (or the button by EXPLORER) searches sections, every responsibilities and case-study file, the FAQ and actions (copy email, cv.pdf, theme, animations…); anything else becomes an ask.sh question. `/` and `?` are single-key shortcuts, which the shortcuts dialog can turn off (WCAG 2.1.4). Both are native modal `<dialog>`s. The file pages, the blog and the CV have the same search and jump (Ctrl/⌘+K, `/` or their search button), where a file opens its own page. The entries are built into `/palette.json` (`src/pages/palette.json.ts`), which loads only when search is first used.
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

The deploy (on every push to `main`, and daily) collects the latest CI results from their report branches into `site/live.json` (`tools/live.mjs`): Lighthouse scores (`lighthouse`), the WCAG suite (`accessibility`), the ask.sh answer tests with each answer (`evals`, from `.github/workflows/evals.yml`) and the open-source counts (`oss`, from `.github/workflows/oss-stats.yml`, weekly via the GitHub API). The page fetches it once it's idle and shows it in the sidebar, the `this-site.md` case study, the open-source section and "how ask.sh is tested"; until then (or offline, or locally) it shows static fallbacks. The service worker always fetches `live.json` from the network first.

### Costs: designed to be free

Nothing on the site needs a paid plan. The services and their free limits:

| Service                                                   | Used for                               | Free limit                       | Over the limit                              |
| --------------------------------------------------------- | -------------------------------------- | -------------------------------- | ------------------------------------------- |
| GitHub Pages and Actions                                  | hosting, CI                            | free for public repositories     | —                                           |
| Cloudflare Workers (Free plan)                            | ask.sh, read-aloud, MCP, visit counts  | 100,000 requests a day           | requests fail until midnight UTC            |
| Workers AI                                                | ask.sh answers, read-aloud voice       | 10,000 neurons a day             | Free plan: requests fail; Paid plan: billed |
| D1                                                        | question log, visit counts, AI budget  | 5M rows read, 100k written a day | queries fail until midnight UTC             |
| Cloudflare Web Analytics                                  | page views                             | free                             | —                                           |
| The browser's built-in AI (Translator, Language Detector) | translation, ask.sh in other languages | runs on the visitor's device     | —                                           |

On the Workers Free plan nothing can be billed: going over a limit makes requests fail, and every AI feature falls back (search answers, the browser's own voice). Keep the account on the Free plan to keep it that way.

On top of that, `worker/src/budget.js` keeps Workers AI inside the free allowance on any plan. Spending is recorded per UTC day in D1 (`ai_budget`), split into shares so one feature can't use up another's:

| Share                                               | Neurons a day | Roughly                                                                                     |
| --------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------- |
| `ask`: visitors' ask.sh answers (site, WebMCP, MCP) | 6,000         | ~140 answers (~40 neurons each on Gemma 4)                                                  |
| `speak`: read-aloud in the natural voice            | 2,500         | a few answers (Aura 2 is ~2.7 neurons a character); then the browser's voice, which is free |
| `test`: CI smoke tests and answer tests             | 1,000         | about one full test run                                                                     |

When a share is used up the Worker answers 503 `{"error":"budget"}`: ask.sh says it's used today's free allowance and answers from the site's search, and read-aloud uses the browser's voice. If Workers AI reports the account's free allocation is used up, every share closes for the day. If D1 can't be read, AI is off rather than unmetered. Shares can be changed with `AI_CAP_ASK`, `AI_CAP_SPEAK` and `AI_CAP_TEST` variables. The weekly stats show spending per share.

To keep CI's share small, the answer tests run after a Worker deploy only when the worker's code, prompt, shared search or test cases changed (content-only deploys skip them), and the smoke test's voice check reads a short phrase.

The natural voice plays at 1.15× with its pitch kept (an audio element with `preservesPitch`); the browser's voice reads at 1.1×.

### On-device translation

Visitors whose browser prefers another language (38 are supported, Arabic and Hebrew right-to-left) are offered the site in it, using the browser's built-in [Translator API](https://developer.chrome.com/docs/ai/translator-api) (Chrome and Edge on desktop). The language model runs on the visitor's computer: nothing is sent anywhere. Anyone else can pick a language from the menu next to "pause animations" (and on the plain CV). Browsers without the API see no change.

- **Loading:** a small boot snippet on every page decides whether to offer a language (the visitor's first preferred language is supported and isn't English), or to start straight away (they chose one before). Only then does it load `src/i18n.js` (built to `/assets/i18n.<hash>.js`). The offer is written in each language in `src/i18n.js`, since no model is on the device yet; "No thanks" is remembered.
- **Translation units:** text is grouped into units (a paragraph, a list item, a button). Inline markup becomes numbered tokens (`{0}text{/0}`), so whole sentences are translated and the markup goes back round the right words. If the tokens don't come back intact, each run of text is translated on its own instead. The name, email addresses, domains and file names are protected tokens, and elements marked `translate="no"` (file links, commands, the sidebar's file names, code) are left alone. That attribute also helps the browser's own page translation. Attributes (`aria-label`, `title`, `placeholder`, `alt`) and the page title are translated too.
- **In place:** every page is static HTML, so it's translated where it stands, visible text first and the rest in the background, and "Show original" puts the stashed English back. What scripts add later (ask.sh's answers, say) is translated as it arrives. Its styles are in `src/styles/translate.css`.
- **Saying it's machine translation:** the offer, the banner and the sidebar all say the page is translated by the browser, not by a person. The offer and banner use a note written for each language in `src/i18n.js` (so the disclaimer itself isn't machine-translated), and the banner's info button opens a popover (Popover API, placed with CSS anchor positioning) explaining what that means. The sidebar's language menu shows "machine translation" while a language is on, and an ask.sh answer translated back from English says so.
- **The browser's own page translation** (Chrome's "Translate this page") also survives: scripts change only the parts that change (a tab, an answer), so they don't undo text that the browser swapped in.
- **Caching:** translations are kept per language in the visitor's browser (`localStorage`), so returning visits and tab switches are instant.
- **Language and direction:** the page gets `lang` (and `dir="rtl"` for Arabic and Hebrew); text not translated yet is marked `lang="en"` so screen readers pronounce it right. Arrows in running text are swapped in right-to-left languages; diagrams are mirrored by CSS. The CSS uses logical properties throughout (`margin-inline-start`, `inset-inline-end`, `padding-inline` and so on), so the layout mirrors. Charts and commands stay left-to-right.
- **ask.sh in other languages:** a question in another language is detected (Language Detector API), translated to English on the device, answered as usual, and the answer translated back (unless the whole page is already in that language). Read-aloud uses the browser's voice for that language.
- **Stats:** the anonymous visit beacon records the translated language and what the visitor did with the offer (`lang`, `offer` in D1); the weekly stats show both.
- **Tests:** CI has no language models, so `tools/translator-stub.mjs` stands in for the API. `tests/e2e/translation.spec.mjs` covers the offer, full-page translation with names and files kept, the machine-translation notices, no flicker, the token fallback, tabs, ask.sh in German, "Show original", returning visitors, "No thanks", Arabic right-to-left with no sideways scroll, and the CV. `tests/a11y/translated.spec.mjs` runs axe on the offer, the banner and translated pages in German and Arabic. The pure parts (which language to offer, whether a translation kept its markup) have unit tests.

### Agent tools: WebMCP and MCP

The site's content is available to AI agents as tools, in two places, from one definition:

- **`shared/agent-tools.js`** defines the tools (`get_profile`, `get_career`, `list_files`, `read_file`, `search_site`, `ask`, `get_open_source`, `get_site_report`, and the page-only `show_section`), their JSON Schemas and argument checks, and the site's keyword search (tokens, synonyms, ranking). Each surface passes a small "source" saying where the data comes from. The page's WebMCP script (`src/scripts/webmcp.ts`) and the worker both import it. ask.sh's search on the page, the worker's choice of context for the model, and the `search_site` tool all use the same ranking, so they can't drift apart (the old copies had).
- **WebMCP (the page).** Where the browser supports [WebMCP](https://webmachinelearning.github.io/webmcp/) (`document.modelContext`, or `navigator.modelContext` before Chrome 150), the home page registers the tools once it's idle, reading what the page already loads (`cv.json`, the ask.sh index, `live.json`, and `oss.json`, the open-source counts the build was made with). `read_file` can also open the file on screen. They unregister on `pagehide` through an `AbortSignal`. Browsers without the API skip it.
- **MCP (the worker).** `POST https://craga-ask.craga89.workers.dev/mcp` is a public, read-only MCP server (Streamable HTTP, JSON responses, no sessions). It serves both protocol eras on one endpoint: **2026-07-28** (no handshake; `server/discover`; the version in each request's `_meta`, mirrored in `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers, which are checked) and **2025-11-25 and earlier** (`initialize`, `ping`, batches for 2025-03-26). Data: the passages and CV bundled at deploy (`worker/knowledge.json`, `worker/agent-data.json`, both written by the build), and `live.json` fetched from `SITE_URL` (cached 5 minutes). Limits: 60 requests a minute per client (`MCP_LIMITER`), and `ask` calls share ask.sh's limit. Browsers may only call it from the site's own origins. Questions asked through it are logged anonymously with `via = 'mcp'` (`'webmcp'` from the page's tools).
- To use it: add `https://craga-ask.craga89.workers.dev/mcp` as a custom connector (Claude, ChatGPT) or a remote MCP server (Cursor, VS Code, Claude Code: `claude mcp add --transport http craigthompson https://craga-ask.craga89.workers.dev/mcp`).

Tests: `tests/e2e/webmcp.spec.mjs` runs the page's tools against a stand-in `modelContext` (the `ask` call is answered by a stand-in, so tests never reach the real service). `tests/unit/shared/agent-tools.test.mjs` covers search, files and argument checks, and `tests/unit/worker/mcp.test.mjs` the MCP endpoint in both eras: header checks, version errors, origins, rate limits, tool errors and logging. After each worker deploy, `tests/smoke/worker.test.mjs` calls the live `/mcp` in both eras and with the official MCP TypeScript SDK client.

In Chrome 149–156 WebMCP is an origin trial. Tokens live in `src/origin-trials.txt`, one per line. The page's script (`src/scripts/origin-trials.ts`) reads the origin out of each token (and skips expired ones), and adds the token for the origin it's served from as a `<meta http-equiv="origin-trial">` before the tools register. They're added by script, not written into the HTML, because tokens registered for third-party matching only count when an external script on their origin adds them. To try it without a token, enable `chrome://flags/#enable-webmcp-testing`.

The `webmcp.md` case study explains the tools, shows the MCP server address, and shows whether the visitor's browser has WebMCP; its file page leaves out the parts that need JavaScript.

The open-source section has a heatmap of merged pull requests to other projects by year and quarter. `tools/oss-stats.mjs` writes the per-quarter `timeline` (count and repos); the build renders the latest snapshot (from the `oss` branch) into the page, and `live.json` replaces it when newer. It uses one green ramp per theme (checked for contrast and colour-blind separation), hover tips per cell, and a "as a table" view for screen readers and print.

## Visits and questions (anonymous)

- **Cloudflare Web Analytics** (cookieless): Cloudflare adds the beacon to each page as it serves it (automatic setup, now that the domain is on Cloudflare), so the site has no snippet of its own; the Content-Security-Policy allows the beacon's script and endpoint. Settings and the dashboard: Cloudflare → Analytics & Logs → Web Analytics.

- The Worker keeps two tables in the D1 database `craga-ask` (schema in `worker/schema.sql`). `questions` holds each ask.sh question, whether it was answered, the model and the sources. `visits` holds one row per page view: path, referring site, country, device class, sections seen and seconds on the page. No IP addresses, cookies or user agents are stored. Bots, CI traffic (`x-craga-test: 1`) and Do Not Track / Global Privacy Control visitors are skipped. The page says so in ask.sh, the chat and the FAQ.
- `.github/workflows/stats.yml` writes a weekly summary to its run page: visits, referrers, how far people read, devices, countries, and the questions ask.sh couldn't answer (FAQ candidates). You can also query the tables in the Cloudflare dashboard (D1 → craga-ask → Console).

## Quality checks in CI

- **ask.sh evals** (`worker/evals.json`, `tools/ask-evals.mjs`, `.github/workflows/evals.yml`): after a worker deploy that could change answers, and weekly, known questions must get answers with the right facts, no invented ones, no salary figures, and no response to prompt injection. Results (with the answers) are saved to the `evals` branch and shown on the site.
- **Lighthouse thresholds:** performance at least 95 and accessibility and best practices at 100 on mobile and desktop. SEO counts once the site is open to search engines.
- **Screenshot comparison** (`tests/visual/`): 14 views compared against baselines on the `visual-baselines` branch with Playwright's `toHaveScreenshot`. Put `[visual]` in a commit message on `main`, or run CI by hand with "update screenshots", to accept an intended change.
- **Link check** (`.github/workflows/links.yml`): every outbound link in a fresh build, weekly.

## Accessibility (WCAG 2.2 AA)

`pnpm run test:a11y` (`tests/a11y/`) checks the built site against WCAG 2.2 AA:

- axe-core (through `@axe-core/playwright`) with every WCAG 2.0, 2.1 and 2.2 A/AA rule. It runs in both themes, on a desktop and a phone, on every responsibilities and case-study tab, with the FAQ open, in stack search, in ask.sh and the chat with an answer, in the command palette and shortcuts dialog, on translated pages, and on the plain CV, the 404 page and every file page in the sitemap: 392 axe runs.
- Checks automated rule engines can't make: a keyboard-only walk through the whole page with a visible focus indicator at every stop (2.4.7), nothing focused hidden behind the sticky header or chat bar (2.4.11), reflow at 320px (1.4.10), text spacing (1.4.12), reduced motion and a pause control for the auto-playing tour (2.2.2, 2.3.3), and an off switch for single-key shortcuts (2.1.4).

`tests/reporters/a11y-report.mjs` collects the results into one report (`a11y.json`). CI runs the suite on every build and gates the deploy on it; on `main` the report goes to the `accessibility` branch, which the site shows. `.github/workflows/accessibility.yml` runs it against the live site every Monday.

Automated checks can't cover all of WCAG; screen reader passes (VoiceOver, NVDA) are still worth doing after big content or layout changes.

## Search engines

The live site is open to search engines: CI builds it with `ALLOW_INDEXING=true` (`.github/workflows/build.yml`), so `robots.txt` allows crawling and points to the sitemap. Branch previews stay out of results through their `<meta name="robots" content="noindex">` tag; `robots.txt` doesn't block `/preview/`, because a crawler can only read that tag on a page it's allowed to fetch. Building without `ALLOW_INDEXING=true` (locally, or set it to `false` in `build.yml`) keeps the whole site out: `robots.txt` disallows everything and every page carries the noindex tag.

- **Sitemap:** one flat `sitemap.xml` lists every page except the 404 and the social-card pages (the build merges `@astrojs/sitemap`'s index and numbered files into it, `tools/lib/sitemap.mjs`; some engines count an index's child as a single page). Blog posts carry their date as `lastmod`; other pages have no reliable date of their own, so they go without.
- **Each page** has a unique title and description, a self-referencing canonical address, `lang="en-GB"`, Open Graph and X card tags with its own social image, and structured data: `ProfilePage` and `Person` on the home page, `BlogPosting` on posts, `Article` on case studies and responsibilities. The 404 page is `noindex` and has no canonical address.
- **IndexNow:** after each deploy, CI tells Bing, Yandex, Seznam, Naver and Yep which pages changed, so they recrawl them soon (`tools/indexnow.mjs`, `tools/lib/indexnow.mjs`). It compares the live site just published (the root of the `pages` branch) with the `indexnow` branch, the site as IndexNow was last told about it, which only moves on once Pages has published and IndexNow has accepted the pages, so a failed deploy or submission is sent again next time. The comparison ignores the sidebar's version link, the structured data's `dateModified` and asset file names, and nothing else. The key is in `public/<key>.txt`, which proves the site owns it.
- **Google** doesn't use IndexNow, and no longer takes sitemap pings: it finds the sitemap through `robots.txt`, or submit it in Search Console.

## Between pages

- **Transitions:** moving between pages cross-fades (cross-document view transitions, `@view-transition { navigation: auto }`), and a post's title moves from the list into place on its page. It's off with reduced motion, and when animations are paused on the site (`pagereveal` skips it). Browsers without it just load the page.
- **Loading ahead:** speculation rules prerender a page on hover or touch (`eagerness: moderate`) for the home page, the CV, the blog, case studies and responsibilities, so they open instantly. The visit beacon waits until a prerendered page is actually shown (`document.prerendering`), so nothing is counted for pages no one opened.
- **Reading progress** on blog posts is a CSS scroll-driven animation (`animation-timeline: scroll(root)`), with no script; it's hidden where unsupported.
- **The language menus** are customizable selects (`appearance: base-select`) where the browser supports them, styled like the site; each language is written in its own script. Elsewhere they're the browser's own menu.

## Blog (the old craigsworks posts)

The posts from the old blogs (craigsworks.com/blog in 2010, blog.craigsworks.com 2012–16) live in `src/content/blog/` as Markdown, one file per post, with front matter: `title`, `date`, `tags`, `original` (the old address) and `archived` (the Wayback Machine copy they came from), checked at build time. Images go in `src/content/blog/img/`. The build renders each to `/blog/<slug>/` (with its own social preview and `BlogPosting` data), writes `/blog/` listing them all, lists them on the home page (`$ ls -t ./blog`), adds them to ask.sh's index and the agent tools (`list_files`, `read_file`), and puts them in the sitemap. Each old post address redirects to its new page (see below).

- To edit a post, edit its Markdown. To add one, add a file.
- How they were recovered: the **Recover old blog posts** workflow (`tools/blog-fetch.mjs`) finds each post in the Wayback Machine's list of archived addresses, saves its last good snapshot from before the blog went offline, its images and the code from its embedded GitHub gists, to the `blog-import` branch. `node tools/blog-import.mjs <dir>` turned those into the Markdown files. The live demos some posts embedded didn't survive.

## Old domains (craigsworks.com and others)

`redirects/old-domains.json` lists where each old address goes: the domains, the rules, and test URLs. The craigsworks.com rules carry over what the old site's `.htaccess` files did ([Craga89/craigsworks](https://github.com/Craga89/craigsworks)): `/projects/qtip2/…` and `/projects/qtip/…` (which went to qtip2.com and qtip1.com, both now offline) go to the qTip2 and qTip 1 GitHub projects, as do the old qTip forums. Simpletip's page goes to its repository, and its script files (`/projects/simpletip/download/…`) go to the same files through jsDelivr, so old sites that still load them keep working. `/projects/` goes to the open-source section, `/cv.pdf` to the CV, and everything else (www, blog and the other domains) goes to the home page. All are permanent (301) redirects.

- `node tools/redirects.mjs csv` writes `redirects/cloudflare-bulk.csv` for Cloudflare Bulk Redirects (Rules → Bulk Redirects: create a list from the CSV, then a rule that uses it). Each old domain has to be added to Cloudflare with proxied DNS records (a placeholder such as `A 192.0.2.1`, proxied, for the bare domain and `www`; also `blog` for craigsworks.com).
- `node tools/redirects.mjs match <url>` shows which rule a URL hits, offline.
- The **Old-domain redirects** workflow (run it from the Actions tab): `discover` lists every URL the Wayback Machine has archived on the old domains and where each will go (saved to the `redirect-data` branch; `archive/archived.md` lists the ones going to the home page, to review). `check` requests the test URLs and every archived URL, and checks each gives a single 301 to the right place and that the destination loads.

## ask.sh

The `ask.sh` section at the bottom of the home page answers questions about the CV.

- The build extracts the page's text into passages: `site/assets/ask-index.json` for the page and `worker/knowledge.json` for the Worker. Rebuilding after a content change keeps both in step.
- `worker/` is a Cloudflare Worker that runs on Workers AI's free daily allowance. It picks the passages that best match the question and asks the model to answer only from those. When the allowance is used up it fails rather than charging, and the page falls back to its own search over the same passages. It tries Gemma 4 26B first, then Qwen3 30B, then Llama 3.1 8B. It only accepts requests from craigthompson.dev, craga89.github.io and localhost, and it allows each visitor 8 questions a minute.
- `ask.config.json` holds the Worker URL. When it's empty, ask.sh works as search only.

Deploying the Worker:

1. Create a free Cloudflare account and an API token from the **Edit Cloudflare Workers** template (it covers Workers AI).
2. Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository secrets. CI then deploys it from every push to `main`, with the passages from that build. You can also run `pnpm run build && cd worker && pnpm exec wrangler deploy`.
3. Put the Worker URL in `ask.config.json`, for example `{ "endpoint": "https://craga-ask.<subdomain>.workers.dev/ask" }`, then rebuild and push.

Its unit tests (`tests/unit/worker/`, in `pnpm run test:unit`) run without Cloudflare: Workers AI, D1 and the rate limiters are stand-ins. `WORKER_URL=… pnpm run test:smoke` tests a deployed one.
